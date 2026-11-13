import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarApp } from '../app-do-claude.mjs';
import { criarTroca, ErroDeTroca } from '../troca.mjs';
import { lerResiduo } from '../conversas.mjs';
import { CONTA_A, CONTA_B, ORG, controleFalso, entrada, lerJson, montar, textoDeConfig, configDe } from './fabrica.mjs';

/** A (ativa, com uma conversa) e B (login salvo, com outra conversa), pelo caminho de verdade: adicionar, "entrar" com B, voltar. */
async function duasContas(opcoes = {}) {
  const m = montar();
  const controle = controleFalso(opcoes);
  const app = criarApp({ dir: m.appDir, controle });
  const logs = [];
  const troca = criarTroca({ env: m.env, app, dados: m.dados, projetos: m.projetos, log: (t) => logs.push(t) });
  return { m, controle, app, troca, logs };
}

/** Simula o que o usuário faz no app depois de "adicionar": entra com a conta B (config com as 3 chaves dela, cookies dela). */
function entrarComB(m) {
  const cfg = JSON.parse(m.lerConfig());
  Object.assign(cfg, { 'oauth:tokenCacheV2': configDe(CONTA_B)['oauth:tokenCacheV2'], 'oauth:tokenCache': configDe(CONTA_B)['oauth:tokenCache'], lastKnownAccountUuid: CONTA_B });
  writeFileSync(join(m.appDir, 'config.json'), textoDeConfig(cfg));
  writeFileSync(join(m.appDir, 'Cookies'), 'SENTINELA-COOKIE-B');
}

describe('troca: fluxo completo', () => {
  it('adicionar guarda a ativa, limpa o login e abre o app; a conta nova entra e a lista dela ganha as conversas da outra', async () => {
    const { m, controle, troca } = await duasContas();
    entrada(m.sessoes, CONTA_A, ORG, 'daA', { lastActivityAt: 10 });
    await troca.adicionar();
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir']);
    assert.equal(criarApp({ dir: m.appDir, controle }).contaAtiva(), '');
    assert.ok(existsSync(join(m.dados, 'contas', CONTA_A, 'config.json')));
    assert.ok(!existsSync(join(m.appDir, 'Cookies')), 'o login saiu do app sem Sign out');

    entrarComB(m);
    entrada(m.sessoes, CONTA_B, ORG, 'daB', { lastActivityAt: 20 });
    controle.chamadas.length = 0;
    const r = await troca.trocar({ para: CONTA_A.slice(0, 8) });
    assert.equal(r.jaAtiva, false);
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir']);
    assert.equal(criarApp({ dir: m.appDir, controle }).contaAtiva(), CONTA_A);
    assert.equal(readFileSync(join(m.appDir, 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-A');
    assert.ok(existsSync(join(m.sessoes, CONTA_A, ORG, 'local_daB.json')), 'a conversa da B apareceu na lista da A');
    const e = troca.estado();
    assert.equal(e.ativa, CONTA_A);
    assert.deepEqual(e.contas.map((c) => c.uuid).sort(), [CONTA_A, CONTA_B]);
    assert.ok(e.contas.every((c) => c.salva));
  });

  it('troca de ida e volta entre duas contas salvas deixa o config.json idêntico byte a byte e os cookies de cada uma no lugar', async () => {
    const { m, troca } = await duasContas();
    await troca.adicionar();
    entrarComB(m);
    await troca.trocar({ para: CONTA_A });
    const original = m.lerConfig();
    assert.ok(original.length > 0);
    await troca.trocar({ para: CONTA_B });
    const noMeio = JSON.parse(m.lerConfig());
    assert.equal(noMeio.lastKnownAccountUuid, CONTA_B);
    assert.equal(noMeio['oauth:tokenCacheV2'], 'SENTINELA-V2-B');
    assert.equal(noMeio.theme, 'dark');
    assert.equal(readFileSync(join(m.appDir, 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-B');
    await troca.trocar({ para: CONTA_A });
    assert.equal(m.lerConfig(), original);
    assert.equal(readFileSync(join(m.appDir, 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-A');
    assert.equal(readFileSync(join(m.appDir, 'Cookies-journal'), 'utf8'), 'diario-A');
  });

  it('trocar para a conta que já está ativa não fecha o app', async () => {
    const { controle, troca, m } = await duasContas();
    await troca.adicionar();
    entrarComB(m);
    await troca.trocar({ para: CONTA_A });
    controle.chamadas.length = 0;
    const r = await troca.trocar({ para: CONTA_A });
    assert.equal(r.jaAtiva, true);
    assert.deepEqual(controle.chamadas, []);
  });

  it('conta desconhecida vira erro de uso, sem fechar o app', async () => {
    const { controle, troca, m } = await duasContas();
    await assert.rejects(() => troca.trocar({ para: 'nada' }), ErroDeTroca);
    await troca.adicionar();
    entrarComB(m);
    await troca.trocar({ para: CONTA_A });
    controle.chamadas.length = 0;
    troca.nomear(CONTA_A, 'Trabalho');
    troca.nomear(CONTA_B, 'Pessoal');
    await assert.rejects(() => troca.trocar({ para: 'x-nao-existe' }), ErroDeTroca);
    assert.deepEqual(controle.chamadas, []);
    const r = await troca.trocar({ para: 'pessoal' });
    assert.equal(r.conta, CONTA_B, 'acha pelo nome sem diferenciar maiúscula');
  });

  it('pastas de dados 0700 e arquivos 0600', async () => {
    const { m, troca } = await duasContas();
    await troca.adicionar();
    const modo = (p) => statSync(p).mode & 0o777;
    assert.equal(modo(join(m.dados, 'contas')), 0o700);
    assert.equal(modo(join(m.dados, 'contas', CONTA_A)), 0o700);
    assert.equal(modo(join(m.dados, 'backups')), 0o700);
    for (const f of ['estado.json', join('contas', CONTA_A, 'config.json'), join('contas', CONTA_A, 'Cookies')]) assert.equal(modo(join(m.dados, f)), 0o600, f);
  });

  it('o estado.json não tem token', async () => {
    const { m, troca } = await duasContas();
    await troca.adicionar();
    const texto = readFileSync(join(m.dados, 'estado.json'), 'utf8');
    assert.ok(texto.includes(CONTA_A));
    assert.ok(!texto.includes('SENTINELA'));
  });
});

describe('troca: recusas e falhas', () => {
  it('formato inesperado do config.json recusa sem fechar o app e sem gravar nada', async () => {
    const { m, controle, troca } = await duasContas();
    const estranho = JSON.stringify(JSON.parse(m.lerConfig()), null, 2);
    assert.ok(estranho.length > 0);
    writeFileSync(join(m.appDir, 'config.json'), estranho);
    await assert.rejects(() => troca.adicionar(), /formato/);
    assert.deepEqual(controle.chamadas, []);
    assert.equal(m.lerConfig(), estranho);
    assert.ok(!existsSync(join(m.dados, 'contas')));
    assert.ok(!existsSync(join(m.dados, 'backups')));
  });

  it('falha no meio (restaurar quebra) volta o backup e abre o app de novo', async () => {
    const { m, controle, troca } = await duasContas();
    await troca.adicionar();
    entrarComB(m);
    await troca.trocar({ para: CONTA_A }); // salva B, volta A
    // agora A ativa; quebra o perfil salvo da B para a restauração falhar depois de a A ser salva e o cookie mexer
    writeFileSync(join(m.dados, 'contas', CONTA_B, 'config.json'), '{ nao e json');
    const antes = m.lerConfig();
    const cookieAntes = readFileSync(join(m.appDir, 'Cookies'), 'utf8');
    controle.chamadas.length = 0;
    await assert.rejects(() => troca.trocar({ para: CONTA_B }), /restaurar o login/);
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir']);
    assert.equal(m.lerConfig(), antes);
    assert.equal(readFileSync(join(m.appDir, 'Cookies'), 'utf8'), cookieAntes);
    assert.equal(criarApp({ dir: m.appDir, controle }).contaAtiva(), CONTA_A);
  });

  it('falha depois de mexer nos cookies também volta o backup dos cookies', async () => {
    const { m, controle, troca } = await duasContas();
    await troca.adicionar();
    entrarComB(m);
    await troca.trocar({ para: CONTA_A });
    // perfil da B com config válido mas a pasta de lista da conta de destino é um arquivo: sincronizar quebra depois de restaurar
    const antes = m.lerConfig();
    const cookieAntes = readFileSync(join(m.appDir, 'Cookies'), 'utf8');
    mkdirSync(join(m.sessoes, CONTA_B), { recursive: true });
    writeFileSync(join(m.sessoes, CONTA_B, ORG), 'sou um arquivo, não uma pasta');
    entrada(m.sessoes, CONTA_A, ORG, 'x');
    controle.chamadas.length = 0;
    await assert.rejects(() => troca.trocar({ para: CONTA_B }));
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir']);
    assert.equal(m.lerConfig(), antes);
    assert.equal(readFileSync(join(m.appDir, 'Cookies'), 'utf8'), cookieAntes, 'o cookie da B que já tinha sido posto saiu');
  });

  it('se o app não fecha, nada é mexido e o app não é aberto por cima', async () => {
    const { m, controle, troca } = await duasContas({ falhaAoFechar: new Error('o Claude não fechou') });
    const antes = m.lerConfig();
    await assert.rejects(() => troca.adicionar(), /não fechou/);
    assert.deepEqual(controle.chamadas, ['fechar']);
    assert.equal(m.lerConfig(), antes);
    assert.ok(!existsSync(join(m.dados, 'backups')));
  });

  it('se o backup falha o app abre de novo e nada é trocado', async () => {
    const { m, controle, troca } = await duasContas();
    mkdirSync(m.dados, { recursive: true });
    writeFileSync(join(m.dados, 'backups'), 'arquivo no lugar da pasta');
    const antes = m.lerConfig();
    await assert.rejects(() => troca.adicionar(), /backup/);
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir']);
    assert.equal(m.lerConfig(), antes);
  });

  it('erro ao abrir o app aparece, mesmo com a troca feita', async () => {
    const { troca } = await duasContas({ falhaAoAbrir: new Error('sem app') });
    await assert.rejects(() => troca.adicionar(), (e) => e instanceof ErroDeTroca && /mudança foi feita, mas não consegui abrir o Claude/.test(e.message) && e.codigo === 'abriuNao');
  });

  it('sem login salvo para a conta pedida, recusa antes de fechar o app', async () => {
    const { m, controle, troca } = await duasContas();
    mkdirSync(m.dados, { recursive: true });
    writeFileSync(join(m.dados, 'estado.json'), JSON.stringify({ contas: { [CONTA_B]: { nome: 'B' } }, ativa: '' }));
    await assert.rejects(() => troca.trocar({ para: 'B' }), (e) => /não tem login salvo/.test(e.message) && e.codigo === 'semLogin');
    assert.deepEqual(controle.chamadas, []);
  });
});

describe('troca: retomada das conversas', () => {
  async function comConversaEmAndamento() {
    const ctx = await duasContas();
    const { m, troca } = ctx;
    await troca.adicionar();
    entrarComB(m);
    entrada(m.sessoes, CONTA_B, ORG, 'viva', { lastActivityAt: 100 });
    await troca.trocar({ para: CONTA_A }); // A ativa; B guardada; a lista da A já tem a 'viva'
    // um transcrito com turno aberto, escrito agora
    const pasta = join(m.projetos, '-proj');
    mkdirSync(pasta, { recursive: true });
    writeFileSync(join(pasta, 'cli-viva.jsonl'), JSON.stringify({ type: 'user', message: { content: 'continue' } }));
    return ctx;
  }

  it('conversa com turno aberto ganha a marca na conta de destino e a cópia da outra perde a marca', async () => {
    const { m, troca } = await comConversaEmAndamento();
    // a cópia da B tinha a marca de uma troca anterior: sai de lá
    const deB = join(m.sessoes, CONTA_B, ORG, 'local_viva.json');
    const b = lerJson(deB);
    writeFileSync(deB, JSON.stringify({ ...b, interruptedByQuitAt: Date.now() + 60_000, interruptedUnseenResume: true }, null, 2));
    const r = await troca.trocar({ para: CONTA_B });
    assert.equal(r.cortadas.length, 1);
    const alvo = lerJson(join(m.sessoes, CONTA_B, ORG, 'local_viva.json'));
    assert.ok(Number.isFinite(alvo.interruptedByQuitAt));
    const deA = lerJson(join(m.sessoes, CONTA_A, ORG, 'local_viva.json'));
    assert.ok(!('interruptedByQuitAt' in deA));
  });

  it('--sem-retomar tira a marca das conversas cortadas', async () => {
    const { m, troca } = await comConversaEmAndamento();
    const r = await troca.trocar({ para: CONTA_B, retomar: false });
    assert.deepEqual(r.cortadas, []);
    const alvo = lerJson(join(m.sessoes, CONTA_B, ORG, 'local_viva.json'));
    assert.ok(!('interruptedByQuitAt' in alvo));
    assert.ok(!('interruptedAwaitingPerson' in alvo));
  });
});

describe('troca: sincronizar e nomear', () => {
  it('sincronizar copia a lista das outras contas para a ativa, fechando e abrindo o app', async () => {
    const { m, controle, troca } = await duasContas();
    entrada(m.sessoes, CONTA_A, ORG, 'a1');
    entrada(m.sessoes, CONTA_B, ORG, 'b1');
    entrada(m.sessoes, CONTA_B, ORG, 'b2');
    const r = await troca.sincronizar();
    assert.equal(r.copiadas, 2);
    assert.equal(r.removidas, 0);
    assert.equal(r.entraram, 2);
    assert.equal(r.conta, CONTA_A);
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir']);
    assert.deepEqual(readdirSync(join(m.sessoes, CONTA_A, ORG)).sort(), ['local_a1.json', 'local_b1.json', 'local_b2.json']);
  });

  it('sincronizar sem conta logada recusa sem fechar o app', async () => {
    const { m, controle, troca } = await duasContas();
    await troca.adicionar();
    controle.chamadas.length = 0;
    await assert.rejects(() => troca.sincronizar(), (e) => e instanceof ErroDeTroca && e.codigo === 'semAtiva');
    assert.deepEqual(controle.chamadas, []);
  });

  it('nomear grava o nome sem token e aceita o começo do uuid', async () => {
    const { m, troca } = await duasContas();
    const r = troca.nomear(CONTA_A.slice(0, 6), '  Trabalho ');
    assert.equal(r.nome, 'Trabalho');
    assert.equal(troca.estado().contas.find((c) => c.uuid === CONTA_A).nome, 'Trabalho');
    assert.throws(() => troca.nomear(CONTA_A, '   '), ErroDeTroca);
    assert.throws(() => troca.nomear('zzzz', 'x'), ErroDeTroca);
  });

  it('nomear recusa o nome de outra conta (aparado, sem diferença de maiúsculas) com o código repetido', async () => {
    const { m, troca } = await duasContas();
    await troca.adicionar();
    entrarComB(m);
    // o nome padrão (8 primeiros do uuid) de outra conta também é nome: a tela o mostra
    assert.throws(() => troca.nomear(CONTA_B, CONTA_A.slice(0, 8)), (e) => e instanceof ErroDeTroca && e.codigo === 'repetido');
    troca.nomear(CONTA_A, 'Dev');
    const antes = readFileSync(join(m.dados, 'estado.json'), 'utf8');
    assert.ok(antes.includes('"Dev"'));
    for (const nome of ['Dev', 'dev', '  DEV  ']) {
      assert.throws(() => troca.nomear(CONTA_B, nome), (e) => e instanceof ErroDeTroca && e.codigo === 'repetido', nome);
    }
    assert.equal(readFileSync(join(m.dados, 'estado.json'), 'utf8'), antes, 'a recusa não grava');
    // a mesma conta pode mudar a caixa do próprio nome; e um nome livre passa
    assert.equal(troca.nomear(CONTA_A, 'DEV').nome, 'DEV');
    assert.equal(troca.nomear(CONTA_B, 'Claude').nome, 'Claude');
  });
});

describe('troca: organizações, trava e estado', () => {
  it('a lista vai para todas as pastas de organização da conta ativa', async () => {
    const { m, troca } = await duasContas();
    entrada(m.sessoes, CONTA_A, ORG, 'a1');
    entrada(m.sessoes, CONTA_A, 'org-2', 'a2');
    entrada(m.sessoes, CONTA_B, ORG, 'b1');
    await troca.sincronizar();
    assert.deepEqual(readdirSync(join(m.sessoes, CONTA_A, ORG)).sort(), ['local_a1.json', 'local_a2.json', 'local_b1.json']);
    assert.deepEqual(readdirSync(join(m.sessoes, CONTA_A, 'org-2')).sort(), ['local_a1.json', 'local_a2.json', 'local_b1.json']);
  });

  it('conta sem pasta recebe a lista nas da conta que sai, e a pasta que o app cria depois também é preenchida', async () => {
    const { m, troca } = await duasContas();
    entrada(m.sessoes, CONTA_A, 'org-x', 'a1', { lastActivityAt: 50 });
    await troca.adicionar();
    entrarComB(m);
    await troca.trocar({ para: CONTA_A });
    await troca.trocar({ para: CONTA_B });
    assert.ok(existsSync(join(m.sessoes, CONTA_B, 'org-x', 'local_a1.json')), 'palpite: a pasta da conta que sai');
    // o app, logado em B, cria a pasta real da organização dela, com uma conversa mais velha que as copiadas
    entrada(m.sessoes, CONTA_B, 'org-y', 'b1', { lastActivityAt: 10 });
    await troca.sincronizar();
    assert.ok(existsSync(join(m.sessoes, CONTA_B, 'org-y', 'local_a1.json')), 'a lista chega à pasta que o app mostra');
    assert.ok(existsSync(join(m.sessoes, CONTA_A, 'org-x', 'local_a1.json')));
  });

  it('chave do estado.json que não serve de nome de pasta é ignorada', async () => {
    const { m, controle, troca } = await duasContas();
    mkdirSync(join(m.dados, 'contas', 'x'), { recursive: true });
    writeFileSync(join(m.dados, 'estado.json'), JSON.stringify({ contas: { '../../fora': { nome: 'mal' } }, ativa: '../x' }));
    await assert.rejects(() => troca.trocar({ para: 'mal' }), (e) => e instanceof ErroDeTroca && /desconhecida/.test(e.message));
    assert.deepEqual(controle.chamadas, []);
    assert.ok(!troca.estado().contas.some((c) => c.nome === 'mal'));
  });

  it('uma troca por vez: a segunda é recusada enquanto a primeira roda, e a trava sai no fim', async () => {
    const { m, troca } = await duasContas();
    entrada(m.sessoes, CONTA_A, ORG, 'a1');
    entrada(m.sessoes, CONTA_B, ORG, 'b1');
    const primeira = troca.sincronizar();
    await assert.rejects(() => troca.sincronizar(), (e) => e instanceof ErroDeTroca && /outra troca está em andamento/.test(e.message));
    assert.equal((await primeira).copiadas, 1);
    assert.ok(!existsSync(join(m.dados, 'troca.lock')));
    await troca.sincronizar();
  });

  it('trava deixada por processo morto é retomada', async () => {
    const { m, troca } = await duasContas();
    mkdirSync(m.dados, { recursive: true });
    writeFileSync(join(m.dados, 'troca.lock'), '2147483646');
    await troca.sincronizar();
    assert.ok(!existsSync(join(m.dados, 'troca.lock')));
  });
});

describe('troca: lista espelho, resíduo e o que entrou (F559)', () => {
  it('sincronizar grava o resíduo da conta ativa: o alias local fica de fora e o resíduo o conta', async () => {
    const { m, troca } = await duasContas();
    entrada(m.sessoes, CONTA_A, ORG, 'aliasA', { cliSessionId: 'cli-1' });
    entrada(m.sessoes, CONTA_B, ORG, 'aliasB', { cliSessionId: 'cli-1' });
    entrada(m.sessoes, CONTA_B, ORG, 'b2');
    assert.equal(lerResiduo(m.dados, CONTA_A), 0);
    const r = await troca.sincronizar();
    assert.deepEqual(readdirSync(join(m.sessoes, CONTA_A, ORG)).sort(), ['local_aliasA.json', 'local_b2.json']);
    assert.equal(lerResiduo(m.dados, CONTA_A), 1, 'local_aliasB.json ainda falta pelo nome');
    assert.equal(r.entraram, 1, 'antes faltavam 2 pelo nome; o resíduo é 1');
    assert.equal(lerJson(join(m.dados, 'lista.json'))[CONTA_A].residuo, 1);
  });

  it('trocar também grava o resíduo da conta de destino e continua devolvendo copiadas', async () => {
    const { m, troca } = await duasContas();
    entrada(m.sessoes, CONTA_A, ORG, 'aliasA', { cliSessionId: 'cli-1' });
    await troca.adicionar();
    entrarComB(m);
    entrada(m.sessoes, CONTA_B, ORG, 'aliasB', { cliSessionId: 'cli-1' });
    const r = await troca.trocar({ para: CONTA_A });
    assert.equal(typeof r.copiadas, 'number');
    assert.equal(lerResiduo(m.dados, CONTA_A), 1);
    assert.equal(r.entraram, undefined, 'entraram só existe no sincronizar');
  });

  it('entraram desconta o que só foi atualizado', async () => {
    const { m, troca } = await duasContas();
    const velha = entrada(m.sessoes, CONTA_A, ORG, 'c1', { title: 'velho' });
    const nova = entrada(m.sessoes, CONTA_B, ORG, 'c1', { title: 'arquivada', isArchived: true });
    entrada(m.sessoes, CONTA_B, ORG, 'c2');
    utimesSync(velha, 1_700_000_000, 1_700_000_000);
    utimesSync(nova, 1_700_001_000, 1_700_001_000);
    const r = await troca.sincronizar();
    assert.equal(r.copiadas, 2, 'uma entrou e uma foi atualizada');
    assert.equal(r.entraram, 1, 'só uma entrou na lista');
    assert.equal(lerJson(velha).isArchived, true);
  });

  it('falha ao gravar o resíduo vai ao log e não derruba a troca', async () => {
    const { m, troca, logs } = await duasContas();
    entrada(m.sessoes, CONTA_A, ORG, 'a1');
    entrada(m.sessoes, CONTA_B, ORG, 'b1');
    mkdirSync(join(m.dados, 'lista.json'), { recursive: true }); // diretório no lugar do arquivo: o rename falha
    const r = await troca.sincronizar();
    assert.equal(r.copiadas, 1);
    assert.ok(existsSync(join(m.sessoes, CONTA_A, ORG, 'local_b1.json')));
    assert.ok(logs.some((t) => /resíduo/.test(t)), logs.join('|'));
  });

  it('a apagada em outra conta sai da lista da ativa para a reserva da troca, e removidas conta', async () => {
    const { m, troca } = await duasContas();
    const x = entrada(m.sessoes, CONTA_A, ORG, 'x', { lastActivityAt: 10 });
    entrada(m.sessoes, CONTA_B, ORG, 'b1');
    writeFileSync(join(m.sessoes, CONTA_B, ORG, 'deleted_x'), '99999');
    const r = await troca.sincronizar();
    assert.equal(r.removidas, 1);
    assert.equal(existsSync(x), false);
    assert.ok(existsSync(join(m.dados, 'lista-reserva', CONTA_A, ORG, 'local_x.json')));
    assert.equal(readFileSync(join(m.sessoes, CONTA_A, ORG, 'deleted_x'), 'utf8'), '99999');
  });
});

describe('troca: adicionar com voltar (F556)', () => {
  const PRAZO = 10_000;
  const INTERVALO = 2000;
  const ASSENTAR = 8000;
  const CAMINHO = (m) => join(m.dados, 'adicionar.json');

  /** Como `duasContas`, mas com relógio parado (só `esperar` o move) e um `esperar` roteirizado: `roteiro(n, ms, sinal)` roda na n-ésima espera. */
  async function comRelogio({ roteiro = () => {}, controleOpcoes = {} } = {}) {
    const m = montar();
    const rel = { t: Date.now() };
    const esperas = [];
    const esperar = async (ms, sinal) => { esperas.push(ms); rel.t += ms; await roteiro(esperas.length, ms, sinal); };
    const aoFecharEm = [];
    const controle = controleFalso({ ...controleOpcoes, aoFechar: () => { aoFecharEm.push({ t: rel.t, adicionar: existsSync(CAMINHO(m)) ? lerJson(CAMINHO(m)) : null }); controleOpcoes.aoFechar?.(aoFecharEm.length); } });
    const app = criarApp({ dir: m.appDir, controle });
    const logs = [];
    const troca = criarTroca({ env: m.env, app, dados: m.dados, projetos: m.projetos, agora: () => rel.t, log: (t) => logs.push(t) });
    const opcoes = { voltar: true, prazoMs: PRAZO, intervaloMs: INTERVALO, assentarMs: ASSENTAR, esperar };
    return { m, rel, esperas, aoFecharEm, controle, app, troca, logs, opcoes };
  }
  const configEm = (m, obj) => writeFileSync(join(m.appDir, 'config.json'), typeof obj === 'string' ? obj : textoDeConfig(obj));
  const aTem = (m, c) => existsSync(join(m.dados, 'contas', c, 'config.json'));

  it('entrou B: guarda B, volta para A (ativa = A) e o app fecha 2 vezes', async () => {
    const ctx = await comRelogio({ roteiro: (n, ms, sinal) => { if (n === 2) entrarComB(ctx.m); } });
    const { m, controle, esperas, troca, opcoes } = ctx;
    entrada(m.sessoes, CONTA_A, ORG, 'daA', { lastActivityAt: 10 });
    const r = await troca.adicionar(opcoes);
    assert.equal(r.conta, CONTA_B);
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir', 'fechar', 'abrir']);
    assert.deepEqual(esperas, [INTERVALO, INTERVALO, ASSENTAR], 'lê a cada intervalo e, ao ver a entrada, espera o app assentar');
    assert.ok(aTem(m, CONTA_B), 'B guardada');
    assert.match(readFileSync(join(m.dados, 'contas', CONTA_B, 'config.json'), 'utf8'), /SENTINELA-V2-B/);
    assert.equal(readFileSync(join(m.dados, 'contas', CONTA_B, 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-B');
    assert.ok(aTem(m, CONTA_A));
    assert.equal(criarApp({ dir: m.appDir, controle }).contaAtiva(), CONTA_A);
    assert.equal(readFileSync(join(m.appDir, 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-A');
    assert.match(m.lerConfig(), /SENTINELA-V2-A/);
    const e = lerJson(join(m.dados, 'estado.json'));
    assert.equal(e.ativa, CONTA_A);
    assert.deepEqual(Object.keys(e.contas).sort(), [CONTA_A, CONTA_B]);
    assert.ok(!existsSync(CAMINHO(m)));
    assert.ok(!existsSync(join(m.dados, 'troca.lock')));
  });

  it('B igual a A: a pessoa entrou de novo com A; só A é guardada, com o login mais novo', async () => {
    const ctx = await comRelogio({
      roteiro: (n) => {
        if (n !== 2) return;
        const cfg = configDe(CONTA_A);
        configEm(ctx.m, cfg);
        writeFileSync(join(ctx.m.appDir, 'Cookies'), 'SENTINELA-COOKIE-A-NOVO');
      },
    });
    const { m, controle, troca, opcoes } = ctx;
    const r = await troca.adicionar(opcoes);
    assert.equal(r.conta, CONTA_A);
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir', 'fechar', 'abrir']);
    assert.equal(readFileSync(join(m.dados, 'contas', CONTA_A, 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-A-NOVO', 'o perfil de A é o mais novo');
    assert.ok(!aTem(m, CONTA_B));
    assert.equal(criarApp({ dir: m.appDir, controle }).contaAtiva(), CONTA_A);
    assert.deepEqual(Object.keys(lerJson(join(m.dados, 'estado.json')).contas), [CONTA_A]);
  });

  it('prazo: volta para A sem guardar ninguém e recusa com o código prazo', async () => {
    const { m, controle, esperas, aoFecharEm, troca, opcoes } = await comRelogio();
    await assert.rejects(() => troca.adicionar(opcoes), (e) => e instanceof ErroDeTroca && e.codigo === 'prazo' && e.voltarPara === CONTA_A && /voltou para a conta de antes/.test(e.message));
    assert.equal(aoFecharEm[1].adicionar.fase, 'voltando');
    assert.equal(aoFecharEm[1].adicionar.motivo, 'prazo', 'o voltando diz por que está voltando');
    assert.deepEqual(esperas, Array(PRAZO / INTERVALO).fill(INTERVALO), 'espera até o prazo e para');
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir', 'fechar', 'abrir']);
    assert.equal(criarApp({ dir: m.appDir, controle }).contaAtiva(), CONTA_A);
    assert.equal(readFileSync(join(m.appDir, 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-A');
    assert.ok(aTem(m, CONTA_A), 'a de antes continua guardada');
    assert.ok(!aTem(m, CONTA_B), 'ninguém novo');
    assert.equal(lerJson(join(m.dados, 'estado.json')).ativa, CONTA_A);
    assert.ok(!existsSync(CAMINHO(m)));
    assert.ok(!existsSync(join(m.dados, 'troca.lock')));
  });

  it('cancelado pelo AbortSignal na espera: volta para A com o código cancelado', async () => {
    const ctl = new AbortController();
    const { m, controle, esperas, aoFecharEm, troca, opcoes } = await comRelogio({ roteiro: (n) => { if (n === 2) ctl.abort(); } });
    await assert.rejects(() => troca.adicionar({ ...opcoes, sinal: ctl.signal }), (e) => e instanceof ErroDeTroca && e.codigo === 'cancelado' && e.voltarPara === CONTA_A && /voltou para a conta de antes/.test(e.message));
    assert.equal(aoFecharEm[1].adicionar.fase, 'voltando', 'o voltando é gravado assim que o sinal chega');
    assert.equal(aoFecharEm[1].adicionar.motivo, 'cancelado');
    assert.deepEqual(esperas, [INTERVALO, INTERVALO], 'parou na hora, sem esperar até o prazo');
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir', 'fechar', 'abrir']);
    assert.equal(criarApp({ dir: m.appDir, controle }).contaAtiva(), CONTA_A);
    assert.ok(!aTem(m, CONTA_B));
    assert.ok(!existsSync(CAMINHO(m)));
    assert.ok(!existsSync(join(m.dados, 'troca.lock')));
  });

  it('sinal que chega no primeiro fechamento: a espera nem começa e o app volta para A', async () => {
    const ctl = new AbortController();
    const { m, controle, esperas, aoFecharEm, troca, opcoes } = await comRelogio({ controleOpcoes: { aoFechar: (n) => { if (n === 1) ctl.abort(); } } });
    await assert.rejects(() => troca.adicionar({ ...opcoes, sinal: ctl.signal }), (e) => e.codigo === 'cancelado');
    assert.deepEqual(esperas, []);
    assert.equal(aoFecharEm.length, 2);
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir', 'fechar', 'abrir']);
    assert.equal(criarApp({ dir: m.appDir, controle }).contaAtiva(), CONTA_A);
    assert.ok(!existsSync(CAMINHO(m)));
  });

  it('sinal durante o assentamento, já em voltando, não muda nada: B é guardada e o desfecho é ok', async () => {
    const ctl = new AbortController();
    const vistoNoAssentamento = [];
    const ctx = await comRelogio({ roteiro: (n, ms) => { if (n === 2) entrarComB(ctx.m); if (ms === ASSENTAR) { vistoNoAssentamento.push(lerJson(CAMINHO(ctx.m))); ctl.abort(); } } });
    const { m, controle, esperas, troca, opcoes } = ctx;
    const r = await troca.adicionar({ ...opcoes, sinal: ctl.signal });
    assert.deepEqual(esperas, [INTERVALO, INTERVALO, ASSENTAR], 'a medida enxerga o assentamento');
    assert.equal(vistoNoAssentamento.length, 1);
    assert.equal(vistoNoAssentamento[0].fase, 'voltando', 'o voltando já está gravado quando o app assenta');
    assert.equal(vistoNoAssentamento[0].motivo, 'entrou');
    assert.equal(r.conta, CONTA_B, 'o que foi guardado decide, não o sinal');
    assert.equal(r.voltarPara, CONTA_A);
    assert.ok(aTem(m, CONTA_B));
    assert.equal(criarApp({ dir: m.appDir, controle }).contaAtiva(), CONTA_A);
    assert.equal(readFileSync(join(m.appDir, 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-A');
  });

  it('o sinal chega junto da entrada, antes do voltando: B entrou e foi guardada, então o desfecho é ok com B (não cancelado)', async () => {
    const ctl = new AbortController();
    const ctx = await comRelogio({ roteiro: (n) => { if (n === 2) { entrarComB(ctx.m); ctl.abort(); } } });
    const { m, aoFecharEm, troca, opcoes } = ctx;
    const r = await troca.adicionar({ ...opcoes, sinal: ctl.signal });
    assert.equal(aoFecharEm[1].adicionar.motivo, 'cancelado', 'o motivo da parada foi o sinal');
    assert.equal(r.conta, CONTA_B, 'mas o desfecho vem do que foi guardado');
    assert.ok(aTem(m, CONTA_B));
    assert.ok(!existsSync(CAMINHO(m)));
  });

  it('sem conta ativa: recusa com semAtiva antes de fechar o app', async () => {
    const { m, controle, esperas, troca, opcoes } = await comRelogio();
    await troca.adicionar(); // o jeito antigo: guarda A e deixa o app sem login
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir'], 'a medida enxerga um fechamento');
    controle.chamadas.length = 0;
    await assert.rejects(() => troca.adicionar(opcoes), (e) => e instanceof ErroDeTroca && e.codigo === 'semAtiva' && e.voltarPara === null);
    assert.deepEqual(controle.chamadas, []);
    assert.deepEqual(esperas, []);
    assert.ok(!existsSync(CAMINHO(m)));
    assert.ok(!existsSync(join(m.dados, 'troca.lock')));
  });

  it('a retomada usa o saiuEm e o andamento do primeiro fechamento, com A já ativa', async () => {
    // a espera dura 40 min: sozinho, o segundo fechamento não veria o transcrito (mexido há mais de 30 min)
    const ctx = await comRelogio({});
    const { m, aoFecharEm, controle, troca } = ctx;
    const caminho = entrada(m.sessoes, CONTA_A, ORG, 'viva', { lastActivityAt: 100 });
    const pasta = join(m.projetos, '-proj');
    mkdirSync(pasta, { recursive: true });
    writeFileSync(join(pasta, 'cli-viva.jsonl'), JSON.stringify({ type: 'user', message: { content: 'continue' } }));
    assert.ok(!('interruptedByQuitAt' in lerJson(caminho)));
    await assert.rejects(() => troca.adicionar({ voltar: true, prazoMs: 40 * 60_000, intervaloMs: 10 * 60_000, assentarMs: 0, esperar: ctx.opcoes.esperar }), (e) => e.codigo === 'prazo');
    assert.equal(aoFecharEm.length, 2);
    assert.ok(aoFecharEm[1].t - aoFecharEm[0].t >= 40 * 60_000);
    const marcada = lerJson(caminho);
    assert.equal(marcada.interruptedByQuitAt, aoFecharEm[0].t, 'a marca é a hora do primeiro fechamento');
    assert.equal(marcada.interruptedAwaitingPerson, false);
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir', 'fechar', 'abrir']);
  });

  it('adicionar.json: fechando no primeiro fechamento, esperando com os campos (0600, sem segredo), voltando no segundo, ausente no fim; a trava fica presa o tempo todo', async () => {
    const vistos = [];
    const ctx = await comRelogio({
      controleOpcoes: { aoFechar: (n) => { if (n === 1) ctx.rel.t += 5000; } }, // o primeiro fechamento leva 5 s
      roteiro: async (n, ms) => {
        if (ms === ASSENTAR) return; // o assentamento já é do voltando
        const lido = lerJson(CAMINHO(ctx.m));
        vistos.push({ n, lido, modo: statSync(CAMINHO(ctx.m)).mode & 0o777, bruto: readFileSync(CAMINHO(ctx.m), 'utf8'), trava: readFileSync(join(ctx.m.dados, 'troca.lock'), 'utf8') });
        // outra troca, no meio da espera, é recusada pela trava e não mexe no app
        const antes = ctx.controle.chamadas.length;
        await assert.rejects(() => ctx.troca.adicionar(), (e) => e instanceof ErroDeTroca && e.codigo === 'ocupado');
        assert.equal(ctx.controle.chamadas.length, antes);
        if (n === 2) entrarComB(ctx.m);
      },
    });
    const { m, aoFecharEm, troca, opcoes, rel } = ctx;
    const inicio = rel.t;
    await troca.adicionar(opcoes);
    const iso = (t) => new Date(t).toISOString();
    const fechando = aoFecharEm[0].adicionar;
    assert.ok(fechando, 'no primeiro fechamento o arquivo já diz fechando');
    assert.deepEqual(Object.keys(fechando).sort(), ['desde', 'fase', 'faseDesde', 'pid', 'prazoEm', 'voltarPara']);
    assert.equal(fechando.fase, 'fechando');
    assert.equal(fechando.prazoEm, null, 'o prazo corre da espera, não do fechamento');
    assert.equal(fechando.faseDesde, iso(inicio));
    assert.equal(fechando.desde, iso(inicio));
    const voltando = aoFecharEm[1].adicionar;
    assert.equal(voltando.fase, 'voltando');
    assert.equal(voltando.motivo, 'entrou');
    assert.equal(voltando.voltarPara, CONTA_A);
    assert.ok(vistos.length >= 2, 'a medida enxerga a espera');
    for (const v of vistos) {
      assert.deepEqual(Object.keys(v.lido).sort(), ['desde', 'fase', 'faseDesde', 'pid', 'prazoEm', 'voltarPara'], 'sem motivo na espera e sem abriuSozinho quando o app abriu');
      assert.equal(v.lido.fase, 'esperando');
      assert.equal(v.lido.pid, process.pid);
      assert.equal(v.lido.voltarPara, CONTA_A);
      assert.equal(v.lido.desde, iso(inicio));
      assert.equal(v.lido.faseDesde, iso(inicio + 5000), 'a espera começa depois do primeiro fechamento');
      assert.equal(v.lido.prazoEm, iso(inicio + 5000 + PRAZO));
      assert.equal(v.modo, 0o600);
      assert.ok(!v.bruto.includes('SENTINELA'));
      assert.equal(v.trava, String(process.pid), 'a trava está presa durante a espera');
    }
    assert.equal(voltando.faseDesde, iso(inicio + 5000 + 2 * INTERVALO), 'o voltando conta da entrada percebida, não da espera');
    assert.equal(voltando.prazoEm, iso(inicio + 5000 + PRAZO), 'o prazo continua o mesmo');
    assert.ok(!existsSync(CAMINHO(m)));
    assert.ok(!existsSync(join(m.dados, 'troca.lock')));
  });

  it('o app não abriu no primeiro fechamento: não encerra, segue para a espera com abriuSozinho false e a entrada ainda guarda B', async () => {
    const vistos = [];
    const ctx = await comRelogio({ roteiro: (n, ms) => { if (ms !== ASSENTAR) vistos.push(lerJson(CAMINHO(ctx.m))); if (n === 2) entrarComB(ctx.m); } });
    const { m, controle, esperas, aoFecharEm, troca, opcoes } = ctx;
    const abrir = controle.abrir;
    let abertas = 0;
    controle.abrir = async () => { abertas++; if (abertas === 1) { controle.chamadas.push('abrir'); throw new Error('sem app'); } return abrir(); };
    const r = await troca.adicionar(opcoes);
    assert.equal(r.conta, CONTA_B);
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir', 'fechar', 'abrir']);
    assert.deepEqual(esperas, [INTERVALO, INTERVALO, ASSENTAR], 'a espera aconteceu');
    assert.ok(vistos.length >= 2);
    for (const v of vistos) { assert.equal(v.fase, 'esperando'); assert.strictEqual(v.abriuSozinho, false); }
    assert.strictEqual(aoFecharEm[1].adicionar.abriuSozinho, false, 'a marca segue nas fases seguintes');
    assert.ok(aTem(m, CONTA_B));
    assert.equal(criarApp({ dir: m.appDir, controle }).contaAtiva(), CONTA_A);
  });

  it('o app não abriu na volta com B guardada: abriuNao leva conta B e voltarPara A; a mudança fica feita', async () => {
    const ctx = await comRelogio({ roteiro: (n) => { if (n === 2) entrarComB(ctx.m); } });
    const { m, controle, troca, opcoes } = ctx;
    const abrir = controle.abrir;
    let abertas = 0;
    controle.abrir = async () => { abertas++; if (abertas === 2) { controle.chamadas.push('abrir'); throw new Error('sem app'); } return abrir(); };
    await assert.rejects(() => troca.adicionar(opcoes), (e) => e instanceof ErroDeTroca && e.codigo === 'abriuNao' && e.conta === CONTA_B && e.voltarPara === CONTA_A);
    assert.ok(aTem(m, CONTA_B), 'B ficou guardada');
    assert.equal(lerJson(join(m.dados, 'estado.json')).ativa, CONTA_A);
    assert.ok(!existsSync(CAMINHO(m)));
    assert.ok(!existsSync(join(m.dados, 'troca.lock')));
  });

  it('o app não abriu na volta sem B guardada (prazo): abriuNao leva conta null', async () => {
    const { m, controle, troca, opcoes } = await comRelogio();
    const abrir = controle.abrir;
    let abertas = 0;
    controle.abrir = async () => { abertas++; if (abertas === 2) { controle.chamadas.push('abrir'); throw new Error('sem app'); } return abrir(); };
    await assert.rejects(() => troca.adicionar(opcoes), (e) => e.codigo === 'abriuNao' && e.conta === null && e.voltarPara === CONTA_A);
    assert.ok(!aTem(m, CONTA_B));
  });

  it('adicionar.json e trava saem também quando o segundo fechamento dá erro (e o app abre de novo)', async () => {
    const ctx = await comRelogio({ roteiro: (n) => { if (n === 2) { entrarComB(ctx.m); writeFileSync(join(ctx.m.dados, 'contas', CONTA_A, 'config.json'), '{ nao e json'); } } });
    const { m, controle, troca, opcoes } = ctx;
    await assert.rejects(() => troca.adicionar(opcoes), /restaurar o login/);
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir', 'fechar', 'abrir']);
    assert.ok(!existsSync(CAMINHO(m)));
    assert.ok(!existsSync(join(m.dados, 'troca.lock')));
    // o login de A não pôde ser lido: o app volta do backup do 2º fechamento, que está em B (é o limite do que dá para fazer)
    assert.equal(criarApp({ dir: m.appDir, controle }).contaAtiva(), CONTA_B, 'sem o login de A, o app fica em B e a falha diz isso');
  });

  it('não consegui guardar B no 2º fechamento: o app volta para A mesmo assim e o erro diz que B não foi guardada', async () => {
    const ctx = await comRelogio({
      roteiro: (n) => {
        if (n === 2) { entrarComB(ctx.m); mkdirSync(join(ctx.m.dados, 'contas'), { recursive: true }); writeFileSync(join(ctx.m.dados, 'contas', CONTA_B), 'arquivo no lugar da pasta'); }
      },
    });
    const { m, controle, troca, opcoes, logs } = ctx;
    await assert.rejects(() => troca.adicionar(opcoes), (e) => e instanceof ErroDeTroca && e.codigo === 'naoGuardou' && e.voltarPara === CONTA_A && !e.conta);
    assert.deepEqual(controle.chamadas, ['fechar', 'abrir', 'fechar', 'abrir']);
    assert.equal(criarApp({ dir: m.appDir, controle }).contaAtiva(), CONTA_A, 'o app termina em A, não em B');
    assert.equal(lerJson(join(m.dados, 'estado.json')).ativa, CONTA_A);
    assert.ok(!(CONTA_B in lerJson(join(m.dados, 'estado.json')).contas), 'B não entrou na lista de guardadas');
    assert.ok(logs.some((l) => /não guardei a conta que entrou/.test(l)), 'a causa fica no log');
    for (const l of logs) assert.ok(!l.includes('SENTINELA'), l);
    assert.ok(!existsSync(CAMINHO(m)));
    assert.ok(!existsSync(join(m.dados, 'troca.lock')));
  });

  it('se o primeiro fechamento falha, não há espera, arquivo nem trava', async () => {
    const { m, controle, esperas, troca, opcoes } = await comRelogio({ controleOpcoes: { falhaAoFechar: new Error('o Claude não fechou') } });
    await assert.rejects(() => troca.adicionar(opcoes), /não fechou/);
    assert.deepEqual(controle.chamadas, ['fechar']);
    assert.deepEqual(esperas, []);
    assert.ok(!existsSync(CAMINHO(m)));
    assert.ok(!existsSync(join(m.dados, 'troca.lock')));
  });

  it('config.json torto ou em outro formato no meio da espera conta como "ainda não" e não derruba nada', async () => {
    const ctx = await comRelogio({
      roteiro: (n) => {
        if (n === 1) configEm(ctx.m, '{ "theme": "da'); // o app no meio da escrita
        if (n === 2) configEm(ctx.m, JSON.stringify(configDe(CONTA_B), null, 2)); // formato que a troca não conhece
        if (n === 3) { configEm(ctx.m, textoDeConfig(configDe(CONTA_B))); writeFileSync(join(ctx.m.appDir, 'Cookies'), 'SENTINELA-COOKIE-B'); }
      },
    });
    const { m, controle, esperas, troca, opcoes } = ctx;
    const r = await troca.adicionar(opcoes);
    assert.equal(r.conta, CONTA_B);
    assert.deepEqual(esperas, [INTERVALO, INTERVALO, INTERVALO, ASSENTAR], 'sem login, torto e outro formato valem ainda não; a quarta leitura vê a entrada');
    assert.ok(aTem(m, CONTA_B));
    assert.equal(criarApp({ dir: m.appDir, controle }).contaAtiva(), CONTA_A);
  });

  it('os logs e as mensagens não carregam token', async () => {
    const ctx = await comRelogio({ roteiro: (n) => { if (n === 2) entrarComB(ctx.m); } });
    await ctx.troca.adicionar(ctx.opcoes);
    assert.ok(ctx.logs.length > 0);
    for (const l of ctx.logs) assert.ok(!l.includes('SENTINELA'), l);
  });
});
