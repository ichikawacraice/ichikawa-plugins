// As contas do app do Claude na página (F495): leitura, lançamento do CLI solto, nomear e as rotas. Tudo em pasta temporária.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, statSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawn as spawnProcesso, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lerContas, lancar, nomear, cancelarAdicionar, esquecerFilho, CLI_DA_TROCA } from '../contas.mjs';
import { criarServidor } from '../servidor.mjs';
import { montar, entrada, CONTA_A, CONTA_B, SENTINELAS, textoDeConfig, configDe } from '../../troca/test/fabrica.mjs';
import { gravarResiduo } from '../../troca/conversas.mjs';
import { criarApp } from '../../troca/app-do-claude.mjs';

const PUBLICO = join(dirname(fileURLToPath(import.meta.url)), '..', 'publico');
afterEach(() => esquecerFilho());

/** A conta A logada e a B salva (perfil e estado), mais um nome para a A. */
function ambiente({ bSalva = true } = {}) {
  const m = montar();
  const estado = { ativa: CONTA_A, contas: { [CONTA_A]: { nome: 'Pessoal', salvoEm: '2026-11-01T10:00:00.000Z' }, [CONTA_B]: { nome: 'Trabalho', salvoEm: '2026-11-02T10:00:00.000Z' } } };
  writeFileSync(join(m.dados, 'estado.json'), JSON.stringify(estado));
  mkdirSync(join(m.dados, 'contas', CONTA_A), { recursive: true });
  writeFileSync(join(m.dados, 'contas', CONTA_A, 'config.json'), textoDeConfig(configDe(CONTA_A)));
  if (bSalva) {
    mkdirSync(join(m.dados, 'contas', CONTA_B), { recursive: true });
    writeFileSync(join(m.dados, 'contas', CONTA_B, 'config.json'), textoDeConfig(configDe(CONTA_B)));
  }
  return m;
}
const pidMorto = () => spawnSync(process.execPath, ['-e', ''], { timeout: 20_000, killSignal: 'SIGKILL' }).pid;
function espiao() {
  const chamadas = [];
  const spawn = (cmd, args, opcoes) => { chamadas.push({ cmd, args, opcoes }); return { pid: process.pid, unref() {} }; }; // pid vivo: o filho conta como em andamento };
  return { chamadas, spawn };
}

test('lerContas: lista sem token, marca a ativa e responde andamento e ultima nulos', () => {
  const m = ambiente();
  assert.ok(Object.keys(JSON.parse(m.lerConfig())).includes('oauth:tokenCacheV2'), 'o config falso tem as chaves de login');
  const r = lerContas({ env: m.env });
  assert.equal(r.ativa, CONTA_A);
  assert.equal(r.contas.length, 2);
  const a = r.contas.find((c) => c.uuid === CONTA_A);
  assert.deepEqual(a, { uuid: CONTA_A, nome: 'Pessoal', salva: true, ativa: true, salvoEm: '2026-11-01T10:00:00.000Z' });
  assert.equal(r.contas.find((c) => c.uuid === CONTA_B).ativa, false);
  assert.equal(r.andamento, null);
  assert.equal(r.ultima, null);
  const texto = JSON.stringify(r);
  for (const s of SENTINELAS) assert.ok(!texto.includes(s));
});

test('lerContas: config do app ausente ou torto não derruba: contas vazias e erro curto', () => {
  const m = ambiente();
  rmSync(join(m.appDir, 'config.json'));
  const r = lerContas({ env: m.env });
  assert.deepEqual(r.contas, []);
  assert.equal(typeof r.erro, 'string');
  assert.ok(r.erro.length > 0 && r.erro.length <= 200 && !r.erro.includes(m.raiz));
  writeFileSync(join(m.appDir, 'config.json'), '{"a": 1}');
  assert.match(lerContas({ env: m.env }).erro, /formato|conhece/);
});

test('lerContas: erro de leitura leva erroCodigo (semConfig, formato, outro) e a leitura boa não leva', () => {
  const m = ambiente();
  assert.equal('erroCodigo' in lerContas({ env: m.env }), false, 'sem erro, sem código');
  const config = join(m.appDir, 'config.json');
  const original = readFileSync(config, 'utf8');
  assert.ok(original.length > 0);
  rmSync(config);
  const sem = lerContas({ env: m.env });
  assert.equal(typeof sem.erro, 'string');
  assert.equal(sem.erroCodigo, 'semConfig');
  writeFileSync(config, '{"a": 1}');
  assert.equal(lerContas({ env: m.env }).erroCodigo, 'formato');
  writeFileSync(config, 'isto não é json');
  const lixo = lerContas({ env: m.env });
  assert.equal(typeof lixo.erro, 'string');
  assert.equal(lixo.erroCodigo, 'outro');
  writeFileSync(config, original);
  assert.equal('erroCodigo' in lerContas({ env: m.env }), false, 'voltou a ler: o código some');
});

test('lerContas: andamento pela trava viva; trava morta ou ilegível não conta', () => {
  const m = ambiente();
  const trava = join(m.dados, 'troca.lock');
  writeFileSync(trava, String(pidMorto()));
  assert.equal(lerContas({ env: m.env }).andamento, null);
  writeFileSync(trava, 'lixo');
  assert.equal(lerContas({ env: m.env }).andamento, null);
  writeFileSync(trava, String(process.pid));
  const antes = (Date.now() - 60_000) / 1000;
  utimesSync(trava, antes, antes);
  const r = lerContas({ env: m.env });
  assert.equal(r.andamento.pid, process.pid);
  assert.equal(r.andamento.desde, new Date(statSync(trava).mtimeMs).toISOString());
});

test('lerContas: ultima só com os campos e tipos esperados', () => {
  const m = ambiente();
  const arq = join(m.dados, 'ultima-acao.json');
  const boa = { comando: 'trocar', conta: CONTA_B, ok: true, mensagem: 'Conta trocada; o Claude foi aberto de novo.', inicio: '2026-11-08T10:00:00.000Z', fim: '2026-11-08T10:00:20.000Z', pid: 123 };
  writeFileSync(arq, JSON.stringify({ ...boa, extra: 'não passa' }));
  assert.deepEqual(lerContas({ env: m.env }).ultima, { ...boa, codigo: null, voltarPara: null }, 'arquivo antigo, sem codigo nem voltarPara: vira null');
  for (const ruim of [{ ...boa, comando: 'rm' }, { ...boa, ok: 'sim' }, { ...boa, conta: 5 }, { ...boa, fim: 'ontem' }, { ...boa, pid: '1' }, { ...boa, mensagem: undefined }, []]) {
    writeFileSync(arq, JSON.stringify(ruim));
    assert.equal(lerContas({ env: m.env }).ultima, null, JSON.stringify(ruim));
  }
  writeFileSync(arq, '{quebrado');
  assert.equal(lerContas({ env: m.env }).ultima, null);
  writeFileSync(arq, JSON.stringify({ ...boa, conta: null }));
  assert.equal(lerContas({ env: m.env }).ultima.conta, null);
});

test('lerContas: ultima.voltarPara (a conta de antes do "adicionar e voltar") passa só se for texto; o resto vira null', () => {
  const m = ambiente();
  const arq = join(m.dados, 'ultima-acao.json');
  const boa = { comando: 'adicionar', conta: CONTA_B, ok: true, mensagem: 'Conta guardada; o Claude voltou para a conta de antes.', inicio: '2026-11-08T10:00:00.000Z', fim: '2026-11-08T10:00:20.000Z', pid: 123 };
  writeFileSync(arq, JSON.stringify({ ...boa, voltarPara: CONTA_A }));
  assert.equal(lerContas({ env: m.env }).ultima.voltarPara, CONTA_A, 'a medida enxerga o caso bom');
  for (const ruim of [7, ['x'], { a: 1 }, true]) {
    writeFileSync(arq, JSON.stringify({ ...boa, voltarPara: ruim }));
    assert.equal(lerContas({ env: m.env }).ultima.voltarPara, null, JSON.stringify(ruim));
  }
  writeFileSync(arq, JSON.stringify({ ...boa, voltarPara: null }));
  assert.equal(lerContas({ env: m.env }).ultima.voltarPara, null);
});

test('lerContas: ultima.codigo repassa só a causa conhecida; o resto vira null', () => {
  const m = ambiente();
  const arq = join(m.dados, 'ultima-acao.json');
  const falha = { comando: 'trocar', conta: null, ok: false, mensagem: 'não deu', inicio: '2026-11-08T10:00:00.000Z', fim: '2026-11-08T10:00:20.000Z', pid: 123 };
  for (const codigo of ['formato', 'abriuNao', 'semLogin', 'repetido', 'outro', 'semAtiva', 'prazo', 'cancelado', 'naoGuardou']) {
    writeFileSync(arq, JSON.stringify({ ...falha, codigo }));
    const u = lerContas({ env: m.env }).ultima;
    assert.ok(u, codigo);
    assert.equal(u.codigo, codigo);
  }
  for (const codigo of ['rm -rf', '', 7, ['formato'], { a: 1 }, 'FORMATO']) {
    writeFileSync(arq, JSON.stringify({ ...falha, codigo }));
    const u = lerContas({ env: m.env }).ultima;
    assert.ok(u, JSON.stringify(codigo));
    assert.equal(u.codigo, null, JSON.stringify(codigo));
  }
  writeFileSync(arq, JSON.stringify({ ...falha, ok: true, codigo: null }));
  assert.equal(lerContas({ env: m.env }).ultima.codigo, null);
});

test('lerContas: andamento sabe comando e conta do filho lançado pela página; a trava sozinha deixa os dois nulos', () => {
  const m = ambiente();
  const trava = join(m.dados, 'troca.lock');
  writeFileSync(trava, String(process.pid));
  const soTrava = lerContas({ env: m.env }).andamento;
  assert.equal(soTrava.pid, process.pid, 'a trava viva vale como andamento');
  assert.equal(soTrava.comando, null);
  assert.equal(soTrava.conta, null);
  rmSync(trava);

  const e = espiao();
  const t = lancar({ comando: 'trocar', conta: CONTA_B, env: m.env, cli: '/x/cli.mjs', spawn: e.spawn });
  assert.equal(t.ok, true);
  assert.equal(t.andamento.comando, 'trocar');
  assert.equal(t.andamento.conta, CONTA_B);
  const lido = lerContas({ env: m.env }).andamento;
  assert.ok(lido, 'o filho vivo é andamento');
  assert.equal(lido.comando, 'trocar');
  assert.equal(lido.conta, CONTA_B);
  assert.equal(lido.desde, t.andamento.desde);

  // com a trava do mesmo pid o filho ainda diz o que está rodando (a trava só guarda o pid)
  writeFileSync(trava, String(process.pid));
  const comTrava = lerContas({ env: m.env }).andamento;
  assert.equal(comTrava.comando, 'trocar');
  assert.equal(comTrava.conta, CONTA_B);

  // trava de outro pid vivo que não é o filho: nada a dizer
  esquecerFilho();
  rmSync(trava);
  const a = lancar({ comando: 'adicionar', env: m.env, cli: '/x/cli.mjs', spawn: e.spawn });
  assert.equal(a.andamento.comando, 'adicionar');
  assert.equal(a.andamento.conta, null);
  assert.equal(lerContas({ env: m.env }).andamento.comando, 'adicionar');
  assert.equal(lerContas({ env: m.env }).andamento.conta, null);
});

const escreverAdicionar = (m, campos) => writeFileSync(join(m.dados, 'adicionar.json'), JSON.stringify({ pid: process.pid, fase: 'esperando', voltarPara: CONTA_A, desde: '2026-11-09T10:00:00.000Z', prazoEm: '2026-11-09T10:15:00.000Z', faseDesde: '2026-11-09T10:00:05.000Z', ...campos }));
const prenderTrava = (m, pid = process.pid) => writeFileSync(join(m.dados, 'troca.lock'), String(pid));

test('lerContas: andamento leva comando adicionar, fase, voltarPara, prazoEm e faseDesde do adicionar.json quando o pid é o da trava e está vivo', () => {
  const m = ambiente();
  prenderTrava(m);
  assert.deepEqual(Object.keys(lerContas({ env: m.env }).andamento).sort(), ['comando', 'conta', 'desde', 'pid'], 'sem adicionar.json, nada a mais');
  assert.equal(lerContas({ env: m.env }).andamento.comando, null, 'sem adicionar.json e sem filho desta instância, o comando é desconhecido');
  escreverAdicionar(m, {});
  const r = lerContas({ env: m.env }).andamento;
  assert.equal(r.pid, process.pid);
  assert.equal(r.comando, 'adicionar', 'o arquivo diz o comando mesmo sem o filho ser desta instância (outra aba, F5, servidor reiniciado)');
  assert.equal(r.conta, null);
  assert.equal(r.fase, 'esperando');
  assert.equal(r.voltarPara, CONTA_A);
  assert.equal(r.prazoEm, '2026-11-09T10:15:00.000Z');
  assert.equal(r.faseDesde, '2026-11-09T10:00:05.000Z');
  assert.ok(!('motivo' in r) && !('abriuSozinho' in r), 'só o que o arquivo tem');
  assert.ok(!JSON.stringify(r).includes('SENTINELA'));
});

test('lerContas: andamento por fase: fechando (prazoEm null), voltando com motivo, abriuSozinho false', () => {
  const m = ambiente();
  prenderTrava(m);
  escreverAdicionar(m, { fase: 'fechando', prazoEm: null });
  let r = lerContas({ env: m.env }).andamento;
  assert.equal(r.fase, 'fechando');
  assert.strictEqual(r.prazoEm, null);
  assert.equal(r.comando, 'adicionar');
  for (const motivo of ['entrou', 'cancelado', 'prazo']) {
    escreverAdicionar(m, { fase: 'voltando', motivo });
    r = lerContas({ env: m.env }).andamento;
    assert.equal(r.fase, 'voltando');
    assert.equal(r.motivo, motivo);
  }
  escreverAdicionar(m, { fase: 'voltando', motivo: 'rm -rf' });
  assert.ok(!('motivo' in lerContas({ env: m.env }).andamento), 'motivo desconhecido não passa');
  escreverAdicionar(m, { fase: 'esperando', motivo: 'entrou' });
  assert.ok(!('motivo' in lerContas({ env: m.env }).andamento), 'motivo só existe no voltando');
  escreverAdicionar(m, { abriuSozinho: false });
  assert.strictEqual(lerContas({ env: m.env }).andamento.abriuSozinho, false);
  escreverAdicionar(m, { abriuSozinho: true });
  assert.ok(!('abriuSozinho' in lerContas({ env: m.env }).andamento), 'só o false é repassado');
});

test('lerContas: adicionar.json de pid diferente da trava, de pid morto ou torto é ignorado', () => {
  const m = ambiente();
  prenderTrava(m);
  escreverAdicionar(m, {});
  assert.equal(lerContas({ env: m.env }).andamento.fase, 'esperando', 'a medida enxerga o caso bom');
  escreverAdicionar(m, { pid: process.ppid }); // vivo, mas não é quem prende a trava
  assert.ok(process.ppid !== process.pid);
  let a = lerContas({ env: m.env }).andamento;
  assert.equal(a.pid, process.pid);
  assert.ok(!('fase' in a) && !('voltarPara' in a) && !('prazoEm' in a) && !('faseDesde' in a));
  assert.equal(a.comando, null, 'arquivo de outro pid não diz o comando');
  escreverAdicionar(m, { pid: pidMorto() });
  assert.ok(!('fase' in lerContas({ env: m.env }).andamento));
  // trava e arquivo do mesmo pid morto: sem andamento nenhum
  const morto = pidMorto();
  prenderTrava(m, morto);
  escreverAdicionar(m, { pid: morto });
  assert.equal(lerContas({ env: m.env }).andamento, null);
  prenderTrava(m);
  for (const torto of [{ fase: 'dormindo' }, { fase: undefined }, { voltarPara: 7 }, { prazoEm: 'ontem' }, { faseDesde: 'ontem' }, { faseDesde: undefined }, { pid: '1' }]) {
    escreverAdicionar(m, torto);
    const a2 = lerContas({ env: m.env }).andamento;
    assert.ok(!('fase' in a2) && a2.comando === null, JSON.stringify(torto));
  }
  writeFileSync(join(m.dados, 'adicionar.json'), '{quebrado');
  assert.ok(!('fase' in lerContas({ env: m.env }).andamento));
  writeFileSync(join(m.dados, 'adicionar.json'), '[]');
  assert.ok(!('fase' in lerContas({ env: m.env }).andamento));
});

const CLI_REAL = '/usr/bin/node /repo/src/troca/cli.mjs adicionar --voltar';
function espiaoDeKill(comando = CLI_REAL) {
  const mortes = [];
  const consultas = [];
  return { mortes, consultas, kill: (pid, sinal) => { mortes.push({ pid, sinal }); }, comandoDoPid: (pid) => { consultas.push(pid); return comando; } };
}

test('cancelarAdicionar: na espera, com pid da trava, vivo e comando do CLI, manda SIGTERM a esse pid', () => {
  const m = ambiente();
  prenderTrava(m);
  escreverAdicionar(m, {});
  const e = espiaoDeKill();
  assert.deepEqual(cancelarAdicionar({ env: m.env, kill: e.kill, comandoDoPid: e.comandoDoPid }), { ok: true });
  assert.deepEqual(e.mortes, [{ pid: process.pid, sinal: 'SIGTERM' }]);
  assert.deepEqual(e.consultas, [process.pid]);
});

test('cancelarAdicionar: recusa com motivo e não mata quando falta qualquer condição', () => {
  const m = ambiente();
  const e = espiaoDeKill();
  const tentar = (comando) => cancelarAdicionar({ env: m.env, kill: e.kill, comandoDoPid: comando !== undefined ? () => comando : e.comandoDoPid });
  const recusado = (r, codigo, quando) => {
    assert.equal(r.ok, false, quando);
    assert.equal(r.codigo, codigo, quando);
    assert.ok(typeof r.motivo === 'string' && r.motivo.length > 0, quando);
    assert.deepEqual(e.mortes, [], quando);
  };
  recusado(tentar(), 'semEspera', 'sem adicionar.json nem trava');
  prenderTrava(m);
  recusado(tentar(), 'semEspera', 'trava sem adicionar.json');
  escreverAdicionar(m, { fase: 'voltando', motivo: 'entrou' });
  recusado(tentar(), 'fase', 'fase voltando: o arquivo existe, mas a espera já acabou');
  escreverAdicionar(m, { fase: 'fechando', prazoEm: null });
  recusado(tentar(), 'fase', 'fase fechando');
  escreverAdicionar(m, { fase: 'esperando', pid: process.ppid });
  recusado(tentar(), 'semEspera', 'pid do arquivo diferente do da trava');
  escreverAdicionar(m, {});
  recusado(tentar('/usr/bin/vim notas.txt'), 'semEspera', 'o pid vive, mas o comando não é o CLI');
  recusado(tentar(''), 'semEspera', 'ps sem resposta');
  const morto = pidMorto();
  prenderTrava(m, morto);
  escreverAdicionar(m, { pid: morto });
  recusado(tentar(), 'semEspera', 'pid morto');
  escreverAdicionar(m, { pid: morto, fase: 'voltando', motivo: 'prazo' });
  recusado(tentar(), 'semEspera', 'arquivo velho de um processo morto, mesmo em outra fase');
  writeFileSync(join(m.dados, 'adicionar.json'), '{quebrado');
  prenderTrava(m);
  recusado(tentar(), 'semEspera', 'arquivo torto');
  // a medida enxerga a morte: com tudo em ordem o mesmo espião registra
  escreverAdicionar(m, {});
  assert.equal(tentar().ok, true);
  assert.equal(e.mortes.length, 1);
});

test('cancelarAdicionar: o ps de verdade lê o comando do processo (o deste teste recusa; um que leva o CLI no comando é aceito)', () => {
  const m = ambiente();
  prenderTrava(m);
  escreverAdicionar(m, {});
  const mortes = [];
  const r = cancelarAdicionar({ env: m.env, kill: (pid, s) => mortes.push([pid, s]) });
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'semEspera');
  assert.deepEqual(mortes, []);
  // um processo de verdade, parado, que leva o caminho do CLI nos argumentos; o kill segue espião (ninguém é morto pelo teste)
  const filha = spawnProcesso(process.execPath, ['-e', 'setTimeout(() => {}, 20000)', '/repo/src/troca/cli.mjs'], { stdio: 'ignore' });
  try {
    prenderTrava(m, filha.pid);
    escreverAdicionar(m, { pid: filha.pid });
    const bom = cancelarAdicionar({ env: m.env, kill: (pid, s) => mortes.push([pid, s]) });
    assert.deepEqual(bom, { ok: true });
    assert.deepEqual(mortes, [[filha.pid, 'SIGTERM']]);
  } finally { try { filha.kill('SIGKILL'); } catch { /* já saiu */ } }
});

test('lancar: o caso bom chama o spawn (a prova de que as recusas abaixo não o chamam por acaso)', () => {
  const m = ambiente();
  const e = espiao();
  const r = lancar({ comando: 'trocar', conta: CONTA_B, env: m.env, cli: '/x/cli.mjs', spawn: e.spawn });
  assert.equal(r.ok, true);
  assert.equal(e.chamadas.length, 1);
  const { cmd, args, opcoes } = e.chamadas[0];
  assert.equal(cmd, process.execPath);
  assert.deepEqual(args, ['/x/cli.mjs', CONTA_B]);
  assert.equal(opcoes.detached, true);
  assert.equal(opcoes.shell, undefined);
  assert.equal(opcoes.stdio[0], 'ignore');
  assert.equal(opcoes.stdio[1], opcoes.stdio[2]);
  assert.equal(typeof r.andamento.desde, 'string');
  assert.ok(existsSync(join(m.dados, 'pagina-troca.log')));
  assert.equal(statSync(join(m.dados, 'pagina-troca.log')).mode & 0o777, 0o600);
  const ad = lancar({ comando: 'adicionar', env: m.env, cli: '/x/cli.mjs', spawn: e.spawn, conta: 'ignorada' });
  assert.equal(ad.codigo, 'ocupado', 'o filho vivo do módulo vale como andamento');
});

test('lancar: adicionar vai sem conta; recusas não chamam o spawn', () => {
  const m = ambiente();
  const e = espiao();
  const pedir = (extra) => lancar({ env: m.env, cli: '/x/cli.mjs', spawn: e.spawn, ...extra });
  assert.equal(pedir({ comando: 'adicionar' }).ok, true);
  assert.deepEqual(e.chamadas[0].args, ['/x/cli.mjs', 'adicionar']);
  esquecerFilho();
  const n = e.chamadas.length;
  assert.equal(pedir({ comando: 'desfazer-importacao' }).codigo, 'invalida');
  assert.equal(pedir({ comando: 'trocar' }).codigo, 'invalida');
  assert.equal(pedir({ comando: 'trocar', conta: 7 }).codigo, 'invalida');
  assert.equal(pedir({ comando: 'trocar', conta: CONTA_B.slice(0, 8) }).codigo, 'sumiu', 'começo do uuid não vale');
  assert.equal(pedir({ comando: 'trocar', conta: 'Trabalho' }).codigo, 'sumiu', 'nome não vale');
  assert.equal(pedir({ comando: 'trocar', conta: '--abc' }).codigo, 'sumiu');
  assert.equal(pedir({ comando: 'trocar', conta: CONTA_A }).codigo, 'jaAtiva');
  assert.equal(e.chamadas.length, n);
});

test('lancar: adicionar com voltar leva --voltar; sem voltar (ou voltar torto) e trocar não levam', () => {
  const m = ambiente();
  const e = espiao();
  const pedir = (extra) => { esquecerFilho(); return lancar({ env: m.env, cli: '/x/cli.mjs', spawn: e.spawn, ...extra }); };
  const r = pedir({ comando: 'adicionar', voltar: true });
  assert.equal(r.ok, true);
  assert.deepEqual(e.chamadas[0].args, ['/x/cli.mjs', 'adicionar', '--voltar']);
  assert.equal(r.andamento.comando, 'adicionar');
  assert.equal(r.andamento.conta, null);
  assert.equal(lerContas({ env: m.env }).andamento.comando, 'adicionar');
  pedir({ comando: 'adicionar' });
  assert.deepEqual(e.chamadas[1].args, ['/x/cli.mjs', 'adicionar']);
  pedir({ comando: 'adicionar', voltar: 'sim' });
  assert.deepEqual(e.chamadas[2].args, ['/x/cli.mjs', 'adicionar']);
  pedir({ comando: 'trocar', conta: CONTA_B, voltar: true });
  assert.deepEqual(e.chamadas[3].args, ['/x/cli.mjs', CONTA_B]);
  assert.equal(e.chamadas.length, 4);
});

test('lancar: conta sem login salvo recusa semLogin; trava viva recusa ocupado', () => {
  const m = ambiente({ bSalva: false });
  const e = espiao();
  assert.equal(lancar({ comando: 'trocar', conta: CONTA_B, env: m.env, spawn: e.spawn }).codigo, 'semLogin');
  const m2 = ambiente();
  writeFileSync(join(m2.dados, 'troca.lock'), String(process.pid));
  assert.equal(lancar({ comando: 'trocar', conta: CONTA_B, env: m2.env, spawn: e.spawn }).codigo, 'ocupado');
  assert.equal(lancar({ comando: 'adicionar', env: m2.env, spawn: e.spawn }).codigo, 'ocupado');
  assert.equal(e.chamadas.length, 0);
});

test('lancar real: o processo recebe os argumentos, sai da sessão da página e a saída vai ao log', () => {
  const m = ambiente();
  const marca = join(m.raiz, 'argumentos.json');
  const script = join(m.raiz, 'cli-falso.mjs');
  writeFileSync(script, `import { writeFileSync } from 'node:fs';\nconsole.log('saida-do-filho');\nwriteFileSync(process.env.MARCA, JSON.stringify({ argv: process.argv.slice(2), pid: process.pid }));\nsetTimeout(() => {}, 3000);\n`);
  const r = lancar({ comando: 'trocar', conta: CONTA_B, env: { ...m.env, MARCA: marca }, cli: script });
  assert.equal(r.ok, true);
  assert.ok(Number.isInteger(r.andamento.pid) && r.andamento.pid !== process.pid);
  try {
    const ps = spawnSync('ps', ['-o', 'pgid=', '-p', String(r.andamento.pid)], { encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL' });
    assert.equal(Number(ps.stdout.trim()), r.andamento.pid, 'o filho é líder do próprio grupo (solto)');
    for (const fim = Date.now() + 15_000; !existsSync(marca) && Date.now() < fim;) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    assert.ok(existsSync(marca), 'o filho rodou');
    const lido = JSON.parse(readFileSync(marca, 'utf8'));
    assert.deepEqual(lido.argv, [CONTA_B]);
    assert.equal(lido.pid, r.andamento.pid);
    assert.match(readFileSync(join(m.dados, 'pagina-troca.log'), 'utf8'), /saida-do-filho/);
    assert.equal(lerContas({ env: m.env }).andamento.pid, r.andamento.pid);
  } finally { try { process.kill(r.andamento.pid, 'SIGKILL'); } catch { /* já saiu */ } }
});

test('o cli padrão é o da troca de conta', () => {
  assert.ok(existsSync(CLI_DA_TROCA));
  assert.match(CLI_DA_TROCA, /troca\/cli\.mjs$/);
});

test('nomear: grava, apara e valida', () => {
  const m = ambiente();
  const r = nomear({ conta: CONTA_B, nome: '  Cliente X  ', env: m.env });
  assert.deepEqual(r, { ok: true, uuid: CONTA_B, nome: 'Cliente X' });
  assert.equal(JSON.parse(readFileSync(join(m.dados, 'estado.json'), 'utf8')).contas[CONTA_B].nome, 'Cliente X');
  assert.equal(lerContas({ env: m.env }).contas.find((c) => c.uuid === CONTA_B).nome, 'Cliente X');
  const antes = readFileSync(join(m.dados, 'estado.json'), 'utf8');
  for (const nome of ['', '   ', 'a'.repeat(61), 'a\nb', 'a\u0000b', 'a\u007fb', 5, undefined]) assert.equal(nomear({ conta: CONTA_B, nome, env: m.env }).codigo, 'invalida', String(nome));
  assert.equal(nomear({ conta: CONTA_B.slice(0, 8), nome: 'x', env: m.env }).codigo, 'sumiu');
  assert.equal(nomear({ conta: 5, nome: 'x', env: m.env }).codigo, 'invalida');
  assert.equal(readFileSync(join(m.dados, 'estado.json'), 'utf8'), antes);
  assert.equal(nomear({ conta: CONTA_B, nome: 'a'.repeat(60), env: m.env }).ok, true);
});

test('nomear: nome de outra conta (aparado, sem diferença de maiúsculas) é repetido e não grava', () => {
  const m = ambiente();
  const antes = readFileSync(join(m.dados, 'estado.json'), 'utf8');
  assert.ok(antes.includes('"Pessoal"'));
  for (const nome of ['Pessoal', 'pessoal', '  PESSOAL  ']) {
    const r = nomear({ conta: CONTA_B, nome, env: m.env });
    assert.equal(r.ok, false, nome);
    assert.equal(r.codigo, 'repetido', nome);
  }
  assert.equal(readFileSync(join(m.dados, 'estado.json'), 'utf8'), antes);
  assert.equal(nomear({ conta: CONTA_A, nome: 'PESSOAL', env: m.env }).ok, true, 'a própria conta pode mudar a caixa do nome');
  assert.equal(nomear({ conta: CONTA_B, nome: 'Outro nome', env: m.env }).ok, true);
});

test('nomear: com troca em andamento recusa ocupado e não grava (a troca regrava o estado.json)', () => {
  const m = ambiente();
  const estado = join(m.dados, 'estado.json');
  const antes = readFileSync(estado, 'utf8');
  assert.ok(antes.includes('"Trabalho"'));
  const trava = join(m.dados, 'troca.lock');
  writeFileSync(trava, String(process.pid));
  const r = nomear({ conta: CONTA_B, nome: 'Outro', env: m.env });
  assert.deepEqual(r, { ok: false, codigo: 'ocupado' });
  assert.equal(readFileSync(estado, 'utf8'), antes);
  assert.equal(nomear({ conta: CONTA_B, nome: '', env: m.env }).codigo, 'invalida', 'o nome inválido segue sendo inválido');
  writeFileSync(trava, String(pidMorto()));
  assert.equal(nomear({ conta: CONTA_B, nome: 'Outro', env: m.env }).ok, true, 'trava morta não conta');
});

// ---- rotas ----
const H = { 'X-Painel-De-Contas': '1', 'Content-Type': 'application/json' };
function req(porta, metodo, caminho, corpo, { headers = H, host = `127.0.0.1:${porta}` } = {}) {
  return new Promise((resolve, reject) => {
    const dados = corpo === undefined ? '' : (typeof corpo === 'string' ? corpo : JSON.stringify(corpo));
    const r = http.request({ host: '127.0.0.1', port: porta, method: metodo, path: caminho, headers: { ...headers, Host: host, 'Content-Length': Buffer.byteLength(dados) }, setHost: false }, (res) => {
      const partes = [];
      res.on('data', (d) => partes.push(d));
      res.on('end', () => { const texto = Buffer.concat(partes).toString('utf8'); let json = null; try { json = JSON.parse(texto); } catch { /* vazio */ } resolve({ status: res.statusCode, headers: res.headers, json, texto }); });
    });
    r.on('error', reject);
    r.end(dados);
  });
}
async function subir(m, extra = {}) {
  const e = espiao();
  const servidor = criarServidor({ publico: PUBLICO, contas: { env: m.env, spawn: e.spawn, cli: '/x/cli.mjs', ...extra } });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  return { porta: servidor.address().port, e, fechar: () => new Promise((r) => servidor.close(r)) };
}

test('rotas: a guarda recusa sem cabeçalho, com Host ou Origin de fora, e o spawn não é chamado', async () => {
  const m = ambiente();
  const s = await subir(m);
  try {
    const corpo = { conta: CONTA_B };
    const antes = readFileSync(join(m.dados, 'estado.json'), 'utf8');
    for (const caminho of ['/api/contas/trocar', '/api/contas/adicionar', '/api/contas/nomear']) {
      const c = caminho.endsWith('nomear') ? { conta: CONTA_B, nome: 'x' } : corpo;
      assert.equal((await req(s.porta, 'POST', caminho, c, { headers: { 'Content-Type': 'application/json' } })).status, 403);
      assert.equal((await req(s.porta, 'POST', caminho, c, { host: `evil.com:${s.porta}` })).status, 403);
      assert.equal((await req(s.porta, 'POST', caminho, c, { headers: { ...H, Origin: 'http://evil.com' } })).status, 403);
    }
    assert.equal(s.e.chamadas.length, 0);
    assert.equal(readFileSync(join(m.dados, 'estado.json'), 'utf8'), antes);
    const ok = await req(s.porta, 'POST', '/api/contas/trocar', corpo, { headers: { ...H, Origin: `http://localhost:${s.porta}` } });
    assert.equal(ok.status, 202);
    assert.equal(s.e.chamadas.length, 1, 'com a guarda satisfeita a mesma rota lança');
  } finally { await s.fechar(); }
});

test('rotas: 400 para corpo inválido, 404 conta sumida, 409 já ativa, sem login e ocupado, 202/200 no sucesso', async () => {
  const m = ambiente();
  const s = await subir(m);
  try {
    const t = (corpo) => req(s.porta, 'POST', '/api/contas/trocar', corpo);
    assert.equal((await t('{quebrado')).status, 400);
    assert.equal((await t([])).status, 400);
    assert.equal((await t({})).status, 400);
    assert.equal((await t({ conta: 5 })).status, 400);
    const sumida = await t({ conta: 'cccccccc-3333-4333-8333-cccccccccccc' });
    assert.equal(sumida.status, 404);
    assert.equal(sumida.json.codigo, 'sumiu');
    const ja = await t({ conta: CONTA_A });
    assert.equal(ja.status, 409);
    assert.equal(ja.json.codigo, 'jaAtiva');
    assert.equal(ja.json.motivo, 'essa já é a conta ativa');
    assert.equal((await req(s.porta, 'POST', '/api/contas/trocar', 'x'.repeat(17 * 1024))).status, 413);
    assert.equal(s.e.chamadas.length, 0);
    for (const r of [sumida, ja]) assert.equal(r.headers['cache-control'], 'no-store');

    const bom = await t({ conta: CONTA_B });
    assert.equal(bom.status, 202);
    assert.equal(bom.json.ok, true);
    assert.equal(typeof bom.json.andamento.pid, 'number');
    assert.equal(bom.headers['cache-control'], 'no-store');
    assert.deepEqual(s.e.chamadas[0].args, ['/x/cli.mjs', CONTA_B]);

    const ocupado = await req(s.porta, 'POST', '/api/contas/adicionar', {});
    assert.equal(ocupado.status, 409);
    assert.equal(ocupado.json.codigo, 'ocupado');
    assert.equal(ocupado.json.motivo, 'outra troca de conta está em andamento');
    esquecerFilho();
    const ad = await req(s.porta, 'POST', '/api/contas/adicionar', {});
    assert.equal(ad.status, 202);
    assert.deepEqual(s.e.chamadas[1].args, ['/x/cli.mjs', 'adicionar', '--voltar'], 'a página só usa o adicionar que volta para a conta de antes');

    const nomeOcupado = await req(s.porta, 'POST', '/api/contas/nomear', { conta: CONTA_B, nome: ' Novo ' });
    assert.equal(nomeOcupado.status, 409, 'com a entrada em andamento o nome não grava');
    assert.equal(nomeOcupado.json.codigo, 'ocupado');
    assert.equal(nomeOcupado.json.motivo, 'outra troca de conta está em andamento');
    esquecerFilho();
    const n = await req(s.porta, 'POST', '/api/contas/nomear', { conta: CONTA_B, nome: ' Novo ' });
    assert.equal(n.status, 200);
    assert.equal(n.json.nome, 'Novo');
    assert.equal((await req(s.porta, 'POST', '/api/contas/nomear', { conta: CONTA_B, nome: '' })).status, 400);
    assert.equal((await req(s.porta, 'POST', '/api/contas/nomear', { conta: 'zzz', nome: 'x' })).status, 404);
    const rep = await req(s.porta, 'POST', '/api/contas/nomear', { conta: CONTA_B, nome: ' pessoal ' });
    assert.equal(rep.status, 409);
    assert.equal(rep.json.codigo, 'repetido');
    assert.equal(rep.json.motivo, 'Esse nome já é de outra conta.');
  } finally { await s.fechar(); }
});

test('rotas: conta sem login salvo é 409 semLogin', async () => {
  const m = ambiente({ bSalva: false });
  const s = await subir(m);
  try {
    const r = await req(s.porta, 'POST', '/api/contas/trocar', { conta: CONTA_B });
    assert.equal(r.status, 409);
    assert.equal(r.json.codigo, 'semLogin');
    assert.equal(r.json.motivo, 'essa conta não tem login salvo; entre com ela de novo');
    assert.equal(s.e.chamadas.length, 0);
  } finally { await s.fechar(); }
});

test('GET /api/contas: no-store, sem nenhum valor de oauth do config, HEAD vazio, e o POST é 405', async () => {
  const m = ambiente();
  const s = await subir(m);
  try {
    const cfg = JSON.parse(m.lerConfig());
    const valores = Object.entries(cfg).filter(([k]) => k.startsWith('oauth:')).map(([, v]) => String(v));
    assert.ok(valores.length >= 2 && valores.every((v) => v.length > 0), 'o config falso tem as chaves oauth:*');
    const r = await req(s.porta, 'GET', '/api/contas');
    assert.equal(r.status, 200);
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.equal(r.json.ativa, CONTA_A);
    assert.equal(r.json.contas.length, 2);
    for (const v of valores) assert.ok(!r.texto.includes(v), `a resposta vazou ${v}`);
    const h = await req(s.porta, 'HEAD', '/api/contas');
    assert.equal(h.status, 200);
    assert.equal(h.texto, '');
    assert.equal(h.headers['cache-control'], 'no-store');
    assert.equal((await req(s.porta, 'POST', '/api/contas', {})).status, 405);
  } finally { await s.fechar(); }
});

// ---- F559: a lista de conversas da conta em uso e o "Sincronizar a lista" ----
/** A conta B tem 3 conversas; a A (ativa) tem só a primeira: faltam 2 pelo nome. */
function comListaIncompleta() {
  const m = ambiente();
  for (const id of ['c1', 'c2', 'c3']) entrada(m.sessoes, CONTA_B, 'org-1', id);
  entrada(m.sessoes, CONTA_A, 'org-1', 'c1');
  return m;
}

test('F559 lerContas: lista traz o que falta e o resíduo da conta ativa; sem registro o resíduo é 0', () => {
  const m = comListaIncompleta();
  const sem = lerContas({ env: m.env }).lista;
  assert.ok(sem, 'a medida enxerga a lista');
  assert.deepEqual(sem, { faltam: 2, residuo: 0 });
  gravarResiduo(m.dados, CONTA_A, 1);
  assert.deepEqual(lerContas({ env: m.env }).lista, { faltam: 2, residuo: 1 });
  gravarResiduo(m.dados, CONTA_B, 7); // o resíduo de outra conta não vale para a ativa
  assert.deepEqual(lerContas({ env: m.env }).lista, { faltam: 2, residuo: 1 });
  assert.equal(JSON.stringify(lerContas({ env: m.env })).includes('SENTINELA'), false);
});

test('F559 lerContas: lista é nula sem conta ativa, com troca em andamento e com a leitura do app falhando', () => {
  const m = comListaIncompleta();
  assert.ok(lerContas({ env: m.env }).lista, 'antes: há lista');
  writeFileSync(join(m.dados, 'troca.lock'), String(process.pid));
  assert.ok(lerContas({ env: m.env }).andamento, 'a trava viva é andamento');
  assert.equal(lerContas({ env: m.env }).lista, null, 'com troca em andamento o número não vale');
  rmSync(join(m.dados, 'troca.lock'));
  assert.ok(lerContas({ env: m.env }).lista);
  const { lastKnownAccountUuid: _fora, ...semConta } = configDe(CONTA_A);
  writeFileSync(join(m.appDir, 'config.json'), textoDeConfig(semConta));
  const sem = lerContas({ env: m.env });
  assert.equal(sem.ativa, '', 'sem conta aberta no app');
  assert.equal(sem.lista, null);
  writeFileSync(join(m.appDir, 'config.json'), '{"a": 1}');
  const torto = lerContas({ env: m.env });
  assert.equal(typeof torto.erro, 'string');
  assert.equal(torto.lista, null);
});

test('F559 lerContas: a leitura da lista que falha vira lista nula, não derruba as contas', () => {
  const m = comListaIncompleta();
  const app = { ...criarApp({ dir: m.appDir }), sessoesDir: () => { throw new Error('sem pasta'); } };
  const r = lerContas({ env: m.env, app });
  assert.equal(r.contas.length, 2, 'as contas continuam');
  assert.equal(r.lista, null);
});

test('F559 lancar sincronizar: lança o CLI solto com o comando certo, sem conta, e guarda comando e conta no filho', () => {
  const m = comListaIncompleta();
  const e = espiao();
  const r = lancar({ comando: 'sincronizar', conta: CONTA_B, env: m.env, cli: '/x/cli.mjs', spawn: e.spawn });
  assert.equal(r.ok, true);
  assert.deepEqual(e.chamadas[0].args, ['/x/cli.mjs', 'sincronizar'], 'a conta do pedido não vira argumento');
  assert.equal(e.chamadas[0].opcoes.detached, true, 'solto, como o trocar');
  assert.equal(r.andamento.comando, 'sincronizar');
  assert.equal(r.andamento.conta, CONTA_A, 'a conta é a ativa, não a do pedido');
  const lido = lerContas({ env: m.env }).andamento;
  assert.ok(lido, 'o filho vivo é andamento');
  assert.equal(lido.comando, 'sincronizar');
  assert.equal(lido.conta, CONTA_A);
});

test('F559 lancar sincronizar: sem conta ativa recusa semAtiva e com troca em andamento recusa ocupado; ninguém é lançado', () => {
  const m = comListaIncompleta();
  const e = espiao();
  const { lastKnownAccountUuid: _fora, ...semConta } = configDe(CONTA_A);
  const m2 = comListaIncompleta();
  writeFileSync(join(m2.appDir, 'config.json'), textoDeConfig(semConta));
  assert.equal(lerContas({ env: m2.env }).ativa, '');
  assert.equal(lancar({ comando: 'sincronizar', env: m2.env, spawn: e.spawn }).codigo, 'semAtiva');
  writeFileSync(join(m.dados, 'troca.lock'), String(process.pid));
  assert.equal(lancar({ comando: 'sincronizar', env: m.env, spawn: e.spawn }).codigo, 'ocupado');
  assert.equal(e.chamadas.length, 0);
  rmSync(join(m.dados, 'troca.lock'));
  assert.equal(lancar({ comando: 'sincronizar', env: m.env, spawn: e.spawn }).ok, true, 'a medida enxerga o aceite');
  assert.equal(e.chamadas.length, 1);
});

test('F559 lerContas: ultima do sincronizar repassa entraram só quando é inteiro >= 0', () => {
  const m = ambiente();
  const arq = join(m.dados, 'ultima-acao.json');
  const boa = { comando: 'sincronizar', conta: CONTA_A, ok: true, mensagem: 'Lista sincronizada.', inicio: '2026-11-09T10:00:00.000Z', fim: '2026-11-09T10:00:20.000Z', pid: 123 };
  for (const n of [0, 1, 1067]) {
    writeFileSync(arq, JSON.stringify({ ...boa, entraram: n }));
    assert.equal(lerContas({ env: m.env }).ultima.entraram, n, String(n));
  }
  assert.equal(lerContas({ env: m.env }).ultima.conta, CONTA_A);
  for (const ruim of [-1, 1.5, '3', null, [2], { a: 1 }, true, NaN]) {
    writeFileSync(arq, JSON.stringify({ ...boa, entraram: ruim }));
    const u = lerContas({ env: m.env }).ultima;
    assert.ok(u, JSON.stringify(ruim));
    assert.equal('entraram' in u, false, `entraram ${JSON.stringify(ruim)} não passa`);
  }
  writeFileSync(arq, JSON.stringify(boa));
  assert.equal('entraram' in lerContas({ env: m.env }).ultima, false, 'sem o campo, sem o campo');
});

test('F559 lerContas: ultima do sincronizar repassa removidas só quando é inteiro >= 0', () => {
  const m = ambiente();
  const arq = join(m.dados, 'ultima-acao.json');
  const boa = { comando: 'sincronizar', conta: CONTA_A, ok: true, mensagem: 'Lista sincronizada.', inicio: '2026-11-09T10:00:00.000Z', fim: '2026-11-09T10:00:20.000Z', pid: 123 };
  for (const n of [0, 1, 1067]) {
    writeFileSync(arq, JSON.stringify({ ...boa, removidas: n }));
    assert.equal(lerContas({ env: m.env }).ultima.removidas, n, String(n));
  }
  for (const ruim of [-1, 1.5, '3', null, [2], { a: 1 }, true, NaN]) {
    writeFileSync(arq, JSON.stringify({ ...boa, removidas: ruim }));
    const u = lerContas({ env: m.env }).ultima;
    assert.ok(u, JSON.stringify(ruim));
    assert.equal('removidas' in u, false, `removidas ${JSON.stringify(ruim)} não passa`);
  }
  writeFileSync(arq, JSON.stringify(boa));
  assert.equal('removidas' in lerContas({ env: m.env }).ultima, false, 'sem o campo, sem o campo');
});
