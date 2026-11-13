import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarApp } from '../app-do-claude.mjs';
import { principal, lerArgumentos } from '../cli.mjs';
import { CONTA_A, CONTA_B, ORG, SENTINELAS, configDe, controleFalso, entrada, montar, textoDeConfig } from './fabrica.mjs';

const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'cli.mjs');
async function roda(m, argv, controle = controleFalso(), adicionarOpcoes = {}) {
  const saida = [];
  const erro = [];
  const codigo = await principal({ argv, env: m.env, saida: (t) => saida.push(t), erro: (t) => erro.push(t), controle, adicionarOpcoes });
  return { codigo, saida: saida.join('\n'), erro: erro.join('\n'), controle };
}
const semToken = (t) => { for (const s of SENTINELAS) assert.ok(!t.includes(s), `a saída vazou ${s}`); };

describe('cli: argumentos', () => {
  it('lê as opções e recusa a desconhecida', () => {
    assert.deepEqual(lerArgumentos(['--json']).json, true);
    assert.equal(lerArgumentos(['b', '--sem-retomar']).retomar, false);
    assert.match(lerArgumentos(['--xis']).erro, /desconhecido/);
  });

  it('--voltar é lido e, sem ele, é falso', () => {
    assert.equal(lerArgumentos(['adicionar', '--voltar']).voltar, true);
    assert.deepEqual(lerArgumentos(['adicionar', '--voltar']).pos, ['adicionar']);
    assert.equal(lerArgumentos(['adicionar']).voltar, false);
  });
});

describe('cli: comandos', () => {
  it('sem argumento lista as contas e marca a ativa, sem fechar o app', async () => {
    const m = montar();
    const r = await roda(m, []);
    assert.equal(r.codigo, 0);
    assert.ok(r.saida.length > 0);
    assert.match(r.saida, new RegExp(`\\* .*${CONTA_A}`));
    assert.deepEqual(r.controle.chamadas, []);
  });

  it('--json devolve a lista como objeto', async () => {
    const m = montar();
    const r = await roda(m, ['--json']);
    const j = JSON.parse(r.saida);
    assert.equal(j.ativa, CONTA_A);
    assert.equal(j.contas.length, 1);
  });

  it('o ciclo inteiro pelo cli não imprime nenhum valor de login (nem em erro)', async () => {
    const m = montar();
    const todas = [];
    todas.push(await roda(m, ['adicionar']));
    assert.equal(todas[0].codigo, 0);
    assert.deepEqual(todas[0].controle.chamadas, ['fechar', 'abrir']);
    todas.push(await roda(m, []));
    todas.push(await roda(m, ['nomear', CONTA_A.slice(0, 8), 'Trabalho']));
    todas.push(await roda(m, ['Trabalho']));
    todas.push(await roda(m, ['nao-existe']));
    todas.push(await roda(m, ['sincronizar']));
    todas.push(await roda(m, ['--json']));
    for (const r of todas) { assert.ok(r.saida.length + r.erro.length > 0 || r.codigo === 0); semToken(r.saida); semToken(r.erro); }
    assert.equal(todas[4].codigo, 1);
  });

  it('config com formato desconhecido: erro legível, código 1, token fora da mensagem', async () => {
    const m = montar();
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(m.appDir, 'config.json'), JSON.stringify(JSON.parse(m.lerConfig()), null, 2));
    const r = await roda(m, ['adicionar']);
    assert.equal(r.codigo, 1);
    assert.match(r.erro, /formato/);
    semToken(r.erro);
    assert.deepEqual(r.controle.chamadas, []);
  });

  it('adicionar/sincronizar/nomear com argumento errado dão uso e código 2', async () => {
    const m = montar();
    for (const argv of [['adicionar', 'x'], ['nomear', 'so-um'], ['sincronizar', 'x'], ['b', 'c']]) {
      const r = await roda(m, argv);
      assert.equal(r.codigo, 2, argv.join(' '));
      assert.match(r.erro, /uso:/);
    }
  });

  it('como programa (subprocesso): lista as contas e termina por process.exitCode', () => {
    const m = montar();
    const r = spawnSync('node', [CLI], { env: { ...process.env, ...m.env }, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL' });
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.includes(CONTA_A));
    semToken(r.stdout + r.stderr);
    const ruim = spawnSync('node', [CLI, '--xis'], { env: { ...process.env, ...m.env }, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL' });
    assert.equal(ruim.status, 2);
  });
});

describe('cli: sinais', () => {
  it('segura Ctrl-C e afins só enquanto a troca roda', async () => {
    const m = montar();
    const antes = process.listenerCount('SIGINT');
    assert.ok(antes >= 0);
    let durante = -1;
    const controle = controleFalso({ aoFechar: () => { durante = process.listenerCount('SIGINT'); } });
    entrada(m.sessoes, CONTA_B, ORG, 'b1');
    const r = await roda(m, ['sincronizar'], controle);
    assert.equal(r.codigo, 0, r.erro);
    assert.equal(durante, antes + 1, 'o aviso estava preso ao SIGINT durante a troca');
    assert.equal(process.listenerCount('SIGINT'), antes);
    assert.equal(process.listenerCount('SIGHUP'), process.listenerCount('SIGHUP'));
  });
});

describe('cli: ultima-acao.json', () => {
  const caminho = (m) => join(m.dados, 'ultima-acao.json');
  const lido = (m) => JSON.parse(readFileSync(caminho(m), 'utf8'));
  const CAMPOS = ['codigo', 'comando', 'conta', 'fim', 'inicio', 'mensagem', 'ok', 'pid'];

  it('listar não grava', async () => {
    const m = montar();
    assert.equal((await roda(m, [])).codigo, 0);
    assert.equal((await roda(m, ['--json'])).codigo, 0);
    assert.equal(existsSync(caminho(m)), false);
  });

  it('adicionar, trocar, sincronizar e nomear gravam o desfecho (0600) com a última linha impressa', async () => {
    const m = montar();
    const ad = await roda(m, ['adicionar']);
    assert.equal(ad.codigo, 0, ad.erro);
    let u = lido(m);
    assert.deepEqual(Object.keys(u).sort(), CAMPOS);
    assert.equal(u.comando, 'adicionar');
    assert.equal(u.ok, true);
    assert.equal(u.codigo, null, 'sucesso não tem código');
    assert.equal(u.conta, null);
    assert.equal(u.pid, process.pid);
    assert.ok(u.mensagem.length > 0);
    assert.equal(u.mensagem, ad.saida.split('\n').at(-2), 'a dica depois da mensagem não é o desfecho');
    assert.ok(Date.parse(u.inicio) <= Date.parse(u.fim));
    assert.equal(statSync(caminho(m)).mode & 0o777, 0o600);

    const nm = await roda(m, ['nomear', CONTA_A.slice(0, 8), 'Trabalho']);
    u = lido(m);
    assert.equal(u.comando, 'nomear');
    assert.equal(u.conta, CONTA_A);
    assert.equal(u.mensagem, nm.saida);

    const tr = await roda(m, ['Trabalho']);
    assert.equal(tr.codigo, 0, tr.erro);
    u = lido(m);
    assert.equal(u.comando, 'trocar');
    assert.equal(u.conta, CONTA_A);
    assert.equal(u.ok, true);
    assert.equal(u.mensagem, 'Conta trocada; o Claude foi aberto de novo.');

    entrada(m.sessoes, CONTA_A, ORG, 'a1');
    entrada(m.sessoes, CONTA_B, ORG, 'b1');
    const sy = await roda(m, ['sincronizar']);
    assert.equal(sy.codigo, 0, sy.erro);
    u = lido(m);
    assert.equal(u.comando, 'sincronizar');
    assert.equal(u.conta, CONTA_A, 'a conta ativa');
    assert.equal(u.entraram, 1);
    assert.equal(u.removidas, 0, 'sem apagada em outra conta, removidas é 0');
    assert.equal(u.mensagem, 'Lista sincronizada.');
    assert.match(sy.saida, /1 conversa\(s\) entraram na lista da conta/);
    assert.doesNotMatch(sy.saida, /apagada\(s\)/);
    // entraram só existe no sincronizar
    assert.equal('entraram' in (await (async () => { await roda(m, ['nomear', CONTA_A.slice(0, 8), 'Outro']); return lido(m); })()), false);
  });

  it('sincronizar sem conta aberta grava o código semAtiva', async () => {
    const m = montar();
    await roda(m, ['adicionar']);
    const r = await roda(m, ['sincronizar']);
    assert.equal(r.codigo, 1);
    const u = lido(m);
    assert.equal(u.ok, false);
    assert.equal(u.codigo, 'semAtiva');
  });

  it('a falha do sincronizar com conta ativa grava a conta no desfecho; sem conta ativa, não', async () => {
    const m = montar();
    entrada(m.sessoes, CONTA_B, ORG, 'b1');
    const r = await roda(m, ['sincronizar'], controleFalso({ falhaAoFechar: new Error('não fechou') }));
    assert.equal(r.codigo, 1);
    const u = lido(m);
    assert.equal(u.comando, 'sincronizar');
    assert.equal(u.ok, false);
    assert.equal(u.codigo, 'outro');
    assert.equal(u.conta, CONTA_A, 'a ativa que o comando conhecia antes do erro');
    // sem conta ativa: continua sem conta
    const n = montar();
    await roda(n, ['adicionar']);
    await roda(n, ['sincronizar']);
    assert.deepEqual([lido(n).codigo, lido(n).conta], ['semAtiva', null]);
    // outro comando que falha não ganha conta por isso
    const o = await roda(m, ['nao-existe']);
    assert.equal(o.codigo, 1);
    assert.equal(lido(m).conta, null);
  });

  it('o adicionar sem --voltar termina com a dica de sincronizar; o uso do sincronizar diz que iguala a lista', async () => {
    const m = montar();
    const r = await roda(m, ['adicionar']);
    assert.equal(r.codigo, 0, r.erro);
    assert.equal(r.saida.split('\n').at(-1), 'Depois de entrar com a outra conta, rode "trocar-conta sincronizar" (ou use Sincronizar a lista no painel) para trazer a lista de conversas.');
    const ajuda = await roda(m, ['--ajuda']);
    assert.match(ajuda.saida, /deixa a lista de conversas da conta ativa igual à das outras contas/);
  });

  it('o sincronizar que remove diz quantas saíram e onde ficou a cópia', async () => {
    const m = montar();
    entrada(m.sessoes, CONTA_A, ORG, 'x', { lastActivityAt: 10 });
    entrada(m.sessoes, CONTA_B, ORG, 'b1');
    writeFileSync(join(m.sessoes, CONTA_B, ORG, 'deleted_x'), '99999');
    const r = await roda(m, ['sincronizar']);
    assert.equal(r.codigo, 0, r.erro);
    assert.equal(lido(m).removidas, 1, 'o desfecho grava quantas saíram');
    assert.equal(lido(m).entraram, 1, 'a b1 entrou; a x saiu');
    assert.match(r.saida, new RegExp(`1 conversa\\(s\\) apagada\\(s\\) em outra conta saíram da lista \\(cópia em ${join(m.dados, 'lista-reserva').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)`));
  });

  it('erro grava ok:false com a mensagem que o cli imprimiu', async () => {
    const m = montar();
    const r = await roda(m, ['nao-existe']);
    assert.equal(r.codigo, 1);
    const u = lido(m);
    assert.equal(u.ok, false);
    assert.equal(u.comando, 'trocar');
    assert.equal(u.conta, null);
    assert.equal(u.mensagem, r.erro.split('\n').at(-1));
    assert.match(u.mensagem, /desconhecida/);
    assert.equal(u.codigo, 'outro');
  });

  it('o erro grava o código da causa: semLogin, abriuNao, formato, repetido; o resto é outro', async () => {
    // semLogin: a conta B está no estado, sem perfil salvo
    let m = montar();
    mkdirSync(m.dados, { recursive: true });
    writeFileSync(join(m.dados, 'estado.json'), JSON.stringify({ contas: { [CONTA_B]: { nome: 'Trabalho' } }, ativa: CONTA_A }));
    let r = await roda(m, ['Trabalho']);
    assert.equal(r.codigo, 1);
    assert.match(r.erro, /não tem login salvo/);
    assert.equal(lido(m).codigo, 'semLogin');
    assert.equal(lido(m).ok, false);
    assert.deepEqual(r.controle.chamadas, []);

    // abriuNao: a mudança foi feita e o app não abriu
    m = montar();
    r = await roda(m, ['adicionar'], controleFalso({ falhaAoAbrir: new Error('sem app') }));
    assert.equal(r.codigo, 1);
    assert.match(r.erro, /mudança foi feita, mas não consegui abrir o Claude/);
    assert.equal(lido(m).codigo, 'abriuNao');

    // formato: o config do app que a troca não sabe reler
    m = montar();
    writeFileSync(join(m.appDir, 'config.json'), `${m.lerConfig()}\n`);
    r = await roda(m, ['adicionar']);
    assert.equal(r.codigo, 1);
    assert.match(r.erro, /formato que a troca não conhece/);
    assert.equal(lido(m).codigo, 'formato');
    assert.deepEqual(r.controle.chamadas, []);

    // repetido: dois nomes iguais (outra conta já tem o nome)
    m = montar();
    mkdirSync(m.dados, { recursive: true });
    writeFileSync(join(m.dados, 'estado.json'), JSON.stringify({ contas: { [CONTA_B]: { nome: 'Dev' } }, ativa: CONTA_A }));
    r = await roda(m, ['nomear', CONTA_A, ' dev ']);
    assert.equal(r.codigo, 1);
    assert.equal(lido(m).codigo, 'repetido');
    assert.equal(JSON.parse(readFileSync(join(m.dados, 'estado.json'), 'utf8')).contas[CONTA_B].nome, 'Dev');
  });

  it('uso errado (código 2) não grava', async () => {
    const m = montar();
    assert.equal((await roda(m, ['adicionar', 'x'])).codigo, 2);
    assert.equal(existsSync(caminho(m)), false);
  });

  it('recusa por trava não sobrescreve o desfecho da troca que roda', async () => {
    const m = montar();
    const primeiro = await roda(m, ['nomear', CONTA_A.slice(0, 8), 'Trabalho']);
    assert.equal(primeiro.codigo, 0);
    const antes = readFileSync(caminho(m), 'utf8');
    writeFileSync(join(m.dados, 'troca.lock'), String(process.pid)); // este processo está vivo
    const r = await roda(m, ['sincronizar']);
    assert.equal(r.codigo, 1);
    assert.match(r.erro, /em andamento/);
    assert.equal(readFileSync(caminho(m), 'utf8'), antes);
    assert.deepEqual(r.controle.chamadas, []);
    // sem a trava, a mesma ação grava: a medida distingue recusa de gravação
    rmSync(join(m.dados, 'troca.lock'));
    const livre = await roda(m, ['sincronizar']);
    assert.equal(livre.codigo, 0, livre.erro);
    assert.notEqual(readFileSync(caminho(m), 'utf8'), antes);
  });

  it('falha ao gravar o desfecho vai ao erro e não muda o código de saída', async () => {
    const m = montar();
    mkdirSync(caminho(m)); // diretório no lugar do arquivo: o rename falha
    const r = await roda(m, ['adicionar']);
    assert.equal(r.codigo, 0);
    assert.match(r.erro, /desfecho/);
  });
});

describe('cli: adicionar --voltar (F556)', () => {
  const lido = (m) => JSON.parse(readFileSync(join(m.dados, 'ultima-acao.json'), 'utf8'));
  /** O que a pessoa faz no app: entra com a conta B (config e cookies dela). */
  const entrarComB = (m) => {
    writeFileSync(join(m.appDir, 'config.json'), textoDeConfig(configDe(CONTA_B)));
    writeFileSync(join(m.appDir, 'Cookies'), 'SENTINELA-COOKIE-B');
  };
  const rapido = (esperar) => ({ esperar, prazoMs: 10_000, intervaloMs: 2000, assentarMs: 0 });

  it('--voltar com outro comando é uso errado (código 2), sem mexer no app nem gravar desfecho', async () => {
    const m = montar();
    for (const argv of [['--voltar'], ['sincronizar', '--voltar'], ['nomear', 'a', 'b', '--voltar'], ['b', '--voltar']]) {
      const r = await roda(m, argv);
      assert.equal(r.codigo, 2, argv.join(' '));
      assert.match(r.erro, /uso:/);
      assert.deepEqual(r.controle.chamadas, []);
    }
    assert.equal(existsSync(join(m.dados, 'ultima-acao.json')), false);
    const sub = spawnSync('node', [CLI, 'sincronizar', '--voltar'], { env: { ...process.env, ...m.env }, encoding: 'utf8', timeout: 20_000, killSignal: 'SIGKILL' });
    assert.equal(sub.status, 2, sub.stderr);
    assert.match(sub.stderr, /uso:/);
    // a mesma linha sem o erro de uso é aceita: a medida distingue recusa de aceite
    const ok = await roda(m, ['adicionar', '--voltar'], controleFalso(), rapido(async () => { entrarComB(m); }));
    assert.equal(ok.codigo, 0, ok.erro);
  });

  it('deu certo: guarda B, o app volta para A, o desfecho leva a conta B e o texto diz isso', async () => {
    const m = montar();
    let n = 0;
    const r = await roda(m, ['adicionar', '--voltar'], controleFalso(), rapido(async () => { if (++n === 2) entrarComB(m); }));
    assert.equal(r.codigo, 0, r.erro);
    assert.deepEqual(r.controle.chamadas, ['fechar', 'abrir', 'fechar', 'abrir']);
    const u = lido(m);
    assert.equal(u.comando, 'adicionar');
    assert.equal(u.ok, true);
    assert.equal(u.codigo, null);
    assert.equal(u.conta, CONTA_B);
    assert.equal(u.voltarPara, CONTA_A, 'o desfecho diz para onde o app voltou');
    assert.equal(u.mensagem, r.saida.split('\n').at(-1));
    assert.match(u.mensagem, /guardada/);
    assert.match(u.mensagem, /voltou para a conta de antes/);
    assert.ok(existsSync(join(m.dados, 'contas', CONTA_B, 'config.json')));
    assert.match(m.lerConfig(), new RegExp(CONTA_A));
    assert.equal(existsSync(join(m.dados, 'adicionar.json')), false);
    semToken(r.saida); semToken(r.erro);
  });

  it('o jeito antigo (sem --voltar) segue igual: um fechamento e a conta nova fica', async () => {
    const m = montar();
    const r = await roda(m, ['adicionar']);
    assert.equal(r.codigo, 0);
    assert.deepEqual(r.controle.chamadas, ['fechar', 'abrir']);
    assert.match(r.saida, /entre com a outra conta/);
    assert.ok(!('voltarPara' in lido(m)), 'sem --voltar o desfecho não leva voltarPara: é isso que separa os dois fluxos');
  });

  it('prazo, semAtiva e cancelado saem com código 1 e o desfecho leva o código novo (sem conta)', async () => {
    let m = montar();
    let r = await roda(m, ['adicionar', '--voltar'], controleFalso(), rapido(async () => {}));
    assert.equal(r.codigo, 1);
    assert.match(r.erro, /não entrou/);
    assert.match(r.erro, /voltou para a conta de antes/);
    let u = lido(m);
    assert.deepEqual([u.ok, u.codigo, u.conta, u.comando, u.voltarPara], [false, 'prazo', null, 'adicionar', CONTA_A]);
    assert.equal(u.mensagem, r.erro.split('\n').at(-1));
    assert.deepEqual(r.controle.chamadas, ['fechar', 'abrir', 'fechar', 'abrir']);
    semToken(r.erro);

    // semAtiva: o app sem conta logada recusa sem fechar nada
    m = montar();
    assert.equal((await roda(m, ['adicionar'])).codigo, 0);
    r = await roda(m, ['adicionar', '--voltar'], controleFalso(), rapido(async () => {}));
    assert.equal(r.codigo, 1);
    u = lido(m);
    assert.deepEqual([u.ok, u.codigo, u.conta, u.voltarPara], [false, 'semAtiva', null, null]);
    assert.ok('voltarPara' in u, 'a chave existe mesmo sem conta de antes');
    assert.deepEqual(r.controle.chamadas, []);

    // cancelado: SIGHUP na espera (o SIGINT e o SIGTERM são do corredor de testes: aqui só se emite o que ele não escuta)
    m = montar();
    const antes = { SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM'), SIGHUP: process.listenerCount('SIGHUP') };
    const durante = {};
    let n = 0;
    r = await roda(m, ['adicionar', '--voltar'], controleFalso(), rapido(async () => {
      if (++n === 2) {
        for (const s of Object.keys(antes)) durante[s] = process.listenerCount(s);
        process.emit('SIGHUP');
      }
    }));
    assert.equal(r.codigo, 1, r.erro);
    assert.match(r.erro, /cancelado/);
    assert.match(r.erro, /voltou para a conta de antes/);
    u = lido(m);
    assert.deepEqual([u.ok, u.codigo, u.conta, u.voltarPara], [false, 'cancelado', null, CONTA_A]);
    assert.deepEqual(r.controle.chamadas, ['fechar', 'abrir', 'fechar', 'abrir'], 'o sinal cancelou e voltou, não matou o processo no meio');
    for (const s of Object.keys(antes)) {
      assert.equal(durante[s], antes[s] + 1, `${s}: na espera há um ouvinte do cancelamento`);
      assert.equal(process.listenerCount(s), antes[s], `${s}: solto no fim`);
    }
    assert.match(m.lerConfig(), new RegExp(CONTA_A));
  });

  it('sinal depois da entrada (já voltando) não cancela: B guardada, ok com conta B e voltarPara A', async () => {
    const m = montar();
    let n = 0;
    const r = await roda(m, ['adicionar', '--voltar'], controleFalso(), rapido(async () => {
      if (++n === 2) entrarComB(m);
      else if (n === 3) process.emit('SIGHUP'); // o assentamento, já em voltando
    }));
    assert.equal(r.codigo, 0, r.erro);
    const u = lido(m);
    assert.deepEqual([u.ok, u.codigo, u.conta, u.voltarPara], [true, null, CONTA_B, CONTA_A]);
    assert.ok(existsSync(join(m.dados, 'contas', CONTA_B, 'config.json')));
  });

  it('o app não abriu na volta com B guardada: abriuNao, conta B e voltarPara A no desfecho', async () => {
    const m = montar();
    const controle = controleFalso();
    const abrir = controle.abrir;
    let abertas = 0;
    controle.abrir = async () => { if (++abertas === 2) { controle.chamadas.push('abrir'); throw new Error('sem app'); } return abrir(); };
    let n = 0;
    const r = await roda(m, ['adicionar', '--voltar'], controle, rapido(async () => { if (++n === 2) entrarComB(m); }));
    assert.equal(r.codigo, 1);
    const u = lido(m);
    assert.deepEqual([u.ok, u.codigo, u.conta, u.voltarPara], [false, 'abriuNao', CONTA_B, CONTA_A]);
    assert.ok(existsSync(join(m.dados, 'contas', CONTA_B, 'config.json')));
  });

  it('não consegui guardar B na volta: naoGuardou, sem conta e voltarPara A no desfecho; o app termina em A', async () => {
    const m = montar();
    let n = 0;
    const r = await roda(m, ['adicionar', '--voltar'], controleFalso(), rapido(async () => {
      if (++n === 2) { entrarComB(m); mkdirSync(join(m.dados, 'contas'), { recursive: true }); writeFileSync(join(m.dados, 'contas', CONTA_B), 'arquivo no lugar da pasta'); }
    }));
    assert.equal(r.codigo, 1);
    const u = lido(m);
    assert.deepEqual([u.ok, u.codigo, u.conta, u.voltarPara], [false, 'naoGuardou', null, CONTA_A]);
    assert.match(u.mensagem, /não consegui guardar/);
    assert.equal(criarApp({ dir: m.appDir, controle: r.controle }).contaAtiva(), CONTA_A);
    semToken(r.erro);
  });

  it('o app não abriu no primeiro fechamento: não é o fim; a entrada de B ainda dá ok', async () => {
    const m = montar();
    const controle = controleFalso();
    const abrir = controle.abrir;
    let abertas = 0;
    controle.abrir = async () => { if (++abertas === 1) { controle.chamadas.push('abrir'); throw new Error('sem app'); } return abrir(); };
    let n = 0;
    const r = await roda(m, ['adicionar', '--voltar'], controle, rapido(async () => { if (++n === 2) entrarComB(m); }));
    assert.equal(r.codigo, 0, r.erro);
    assert.deepEqual([lido(m).ok, lido(m).conta, lido(m).voltarPara], [true, CONTA_B, CONTA_A]);
  });
});

describe('cli: enxugar (F560)', () => {
  // A mesma conversa na lista de duas contas: dois arquivos idênticos, o disco gasto duas vezes.
  const acervo = () => {
    const m = montar();
    const p = { a: entrada(m.sessoes, CONTA_A, ORG, 'x'), b: entrada(m.sessoes, CONTA_B, ORG, 'x'), so: entrada(m.sessoes, CONTA_B, ORG, 'y') };
    assert.equal(readFileSync(p.a, 'utf8'), readFileSync(p.b, 'utf8'), 'o cenário não tem repetição para medir');
    return { m, p };
  };
  const inos = (p) => Object.fromEntries(Object.entries(p).map(([k, c]) => [k, statSync(c).ino]));

  it('a seco mede a repetição, não toca em arquivo nenhum e não fecha o app', async () => {
    const { m, p } = acervo();
    const antes = inos(p);
    const r = await roda(m, ['enxugar']);
    assert.equal(r.codigo, 0, r.erro);
    assert.match(r.saida, /3 conversa\(s\) na lista, 1 cópia\(s\) repetida\(s\)/);
    assert.match(r.saida, /--aplicar/);
    assert.deepEqual(inos(p), antes, 'o enxugo a seco reescreveu algum arquivo');
    assert.deepEqual(r.controle.chamadas, [], 'o enxugo fechou ou abriu o app');
    assert.equal(existsSync(join(m.dados, 'ultima-acao.json')), false, 'o enxugo sobrescreveu a última ação da troca');
  });

  it('--aplicar re-clona a cópia sem mudar o conteúdo nem fechar o app', async () => {
    const { m, p } = acervo();
    const antes = { ...inos(p), texto: readFileSync(p.b, 'utf8') };
    const r = await roda(m, ['enxugar', '--aplicar']);
    assert.equal(r.codigo, 0, r.erro);
    assert.match(r.saida, /1 de 1 cópia\(s\) re-clonada\(s\)/);
    assert.equal(readFileSync(p.b, 'utf8'), antes.texto);
    // A conta logada (A) é a doadora: ela não se reescreve, nem o arquivo que não se repete.
    assert.equal(statSync(p.a).ino, antes.a);
    assert.equal(statSync(p.so).ino, antes.so);
    assert.notEqual(statSync(p.b).ino, antes.b, 'a cópia não foi re-clonada');
    assert.deepEqual(r.controle.chamadas, []);
    // Medir de novo acha a mesma repetição: o enxugo não muda o que se mede.
    assert.match((await roda(m, ['enxugar'])).saida, /1 cópia\(s\) repetida\(s\)/);
  });

  it('--json dá o que mediu, e sem repetição diz que não há', async () => {
    const m = montar();
    entrada(m.sessoes, CONTA_A, ORG, 'x');
    const r = await roda(m, ['enxugar', '--json']);
    assert.equal(r.codigo, 0, r.erro);
    const j = JSON.parse(r.saida);
    assert.deepEqual({ arquivos: j.arquivos, copias: j.copias, bytes: j.bytes, referencia: j.referencia }, { arquivos: 1, copias: 0, bytes: 0, referencia: CONTA_A });
    assert.match((await roda(m, ['enxugar'])).saida, /Nada repetido/);
  });

  it('--aplicar fora do enxugar recusa, e o enxugar não aceita argumento sobrando', async () => {
    const m = montar();
    const r = await roda(m, ['sincronizar', '--aplicar']);
    assert.equal(r.codigo, 2);
    assert.match(r.erro, /--aplicar só vale com "enxugar"/);
    assert.equal((await roda(m, ['enxugar', 'x'])).codigo, 2);
  });
});

describe('cli: enxugar sem saber a conta em uso', () => {
  it('mede, recusa o --aplicar e não reescreve nada', async () => {
    const m = montar();
    const a = entrada(m.sessoes, CONTA_A, ORG, 'x');
    const b = entrada(m.sessoes, CONTA_B, ORG, 'x');
    assert.equal(readFileSync(a, 'utf8'), readFileSync(b, 'utf8'), 'o cenário não tem repetição para medir');
    const antes = [statSync(a).ino, statSync(b).ino];
    // Config sem o token: ninguém está logado, e o enxugo não sabe de qual pasta o app é dono.
    writeFileSync(join(m.appDir, 'config.json'), textoDeConfig({ theme: 'dark', lastKnownAccountUuid: CONTA_A }));
    const r = await roda(m, ['enxugar', '--aplicar']);
    assert.equal(r.codigo, 1, r.saida);
    assert.match(r.erro, /conta está em uso/);
    assert.match(r.saida, /1 cópia\(s\) repetida\(s\)/, 'a medição, que não mexe em nada, devia sair mesmo assim');
    assert.doesNotMatch(r.saida, /re-clonada/);
    assert.deepEqual([statSync(a).ino, statSync(b).ino], antes, 'reescreveu arquivo sem saber de quem é a pasta');
    const j = JSON.parse((await roda(m, ['enxugar', '--aplicar', '--json'])).saida);
    assert.deepEqual({ aplicado: j.aplicado, recusa: j.recusa, reclonados: j.reclonados }, { aplicado: false, recusa: 'conta-em-uso-desconhecida', reclonados: 0 });
  });
});
