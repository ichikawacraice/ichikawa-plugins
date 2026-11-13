// O uso de cada conta (F495, fatia 4): cifra, escolha do token, erros, cache, releitura em segundo plano e a rota.
// Nenhum teste toca o Keychain, a rede ou ~/.claude: `lerSenha` e `fetch` entram falsos, tudo em pasta temporária.
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createCipheriv, pbkdf2Sync } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, statSync, existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chaveDe, decifrar, tokenDaConta, lerUso, atualizarUso, releituraSePreciso, estadoDaChave, estadoDoUso, aguardarUso, iniciarUso, lerCacheDeUso, lerSenhaDoKeychain, esquecerUso, ENDERECO, ENDERECO_DO_PERFIL, emailLimpo, emailsDasContas } from '../uso.mjs';
import { lerContas } from '../contas.mjs';
import { criarServidor } from '../servidor.mjs';
import { montar, CONTA_A, CONTA_B, textoDeConfig, configDe } from '../../troca/test/fabrica.mjs';

const PUBLICO = join(dirname(fileURLToPath(import.meta.url)), '..', 'publico');
afterEach(() => esquecerUso());

const SENHA = 'SENHA-FALSA-DO-KEYCHAIN';
const AGORA = Date.parse('2026-11-08T15:00:00.000Z');
const TOKEN_A = 'TOKEN-FALSO-A-bom';
const TOKEN_B = 'TOKEN-FALSO-B-bom';

/** O que o app grava: 'v10' + AES-128-CBC (IV de 16 espaços) do JSON, em base64. */
function cifrar(obj, senha = SENHA) {
  const c = createCipheriv('aes-128-cbc', chaveDe(senha), Buffer.alloc(16, ' '));
  const miolo = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return Buffer.concat([Buffer.from('v10'), miolo]).toString('base64');
}
const entrada = (token, expiresAt) => ({ token, refreshToken: `REFRESH-${token}`, expiresAt, refreshExpiresAt: expiresAt + 1 });
const cacheDe = (conta, token, { expiresAt = AGORA + 86_400_000 } = {}) => ({
  [`acct:${conta}|org-1|user:profile user:inference`]: entrada(token, expiresAt),
});

/** A conta A logada no app, a B salva em contas/<uuid>/config.json; os dois logins cifrados com SENHA. */
function ambiente({ cacheA = cacheDe(CONTA_A, TOKEN_A), cacheB = cacheDe(CONTA_B, TOKEN_B) } = {}) {
  const m = montar();
  writeFileSync(join(m.appDir, 'config.json'), textoDeConfig({ ...configDe(CONTA_A), 'oauth:tokenCacheV2': cifrar(cacheA) }));
  const estado = { ativa: CONTA_A, contas: { [CONTA_A]: { nome: 'Pessoal' }, [CONTA_B]: { nome: 'Trabalho' } } };
  writeFileSync(join(m.dados, 'estado.json'), JSON.stringify(estado));
  for (const [id, cache] of [[CONTA_A, cacheA], [CONTA_B, cacheB]]) {
    mkdirSync(join(m.dados, 'contas', id), { recursive: true });
    writeFileSync(join(m.dados, 'contas', id, 'config.json'), textoDeConfig({ ...configDe(id), 'oauth:tokenCacheV2': cifrar(cache) }));
  }
  return m;
}
const corpoDeUso = (sessao = 51, semana = 37) => ({ five_hour: { utilization: sessao, resets_at: '2026-11-08T16:10:00.000Z' }, seven_day: { utilization: semana, resets_at: '2026-11-14T00:00:00.000Z' }, extra: { ignorado: true } });
const resposta = (corpo, status = 200, headers = {}) => new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status, headers });

/** fetch falso: `porToken[token]` é uma função (ou valor) que devolve a Response do uso; `perfilPorToken[token]`, a do perfil
 * (padrão: 404, sem e-mail). Registra o uso em `chamadas` e o perfil em `perfis`. */
function fetchFalso(porToken = {}, perfilPorToken = {}) {
  const f = async (url, opcoes) => {
    const auth = opcoes?.headers?.Authorization ?? '';
    const token = auth.replace('Bearer ', '');
    const perfil = url === ENDERECO_DO_PERFIL;
    (perfil ? f.perfis : f.chamadas).push({ url, opcoes });
    const r = perfil ? (perfilPorToken[token] ?? (() => resposta('{}', 404))) : (porToken[token] ?? (() => resposta(corpoDeUso())));
    const v = typeof r === 'function' ? r() : r;
    if (v instanceof Error) throw v;
    return v;
  };
  f.chamadas = [];
  f.perfis = [];
  return f;
}
const senhaOk = () => { const l = async () => { l.chamadas++; return `${SENHA}\n`; }; l.chamadas = 0; return l; };
const opcoes = (m, extra = {}) => ({ env: m.env, lerSenha: senhaOk(), fetch: fetchFalso(), agora: () => AGORA, ...extra });
const cacheEmDisco = (m) => JSON.parse(readFileSync(join(m.dados, 'uso.json'), 'utf8'));

// ---- cifra ----
test('chaveDe: PBKDF2-SHA1 da senha, sal saltysalt, 1003 voltas, 16 bytes', () => {
  const k = chaveDe(SENHA);
  assert.ok(Buffer.isBuffer(k));
  assert.equal(k.length, 16);
  assert.ok(k.equals(pbkdf2Sync(SENHA, 'saltysalt', 1003, 16, 'sha1')));
  assert.ok(!k.equals(chaveDe('outra')));
});

test('decifrar: ida e volta com senha falsa; prefixo, chave e base64 ruins recusam sem repassar conteúdo', () => {
  const texto = JSON.stringify({ a: 'valor-secreto-123' });
  const b64 = cifrar({ a: 'valor-secreto-123' });
  assert.ok(b64.length > 0);
  assert.equal(decifrar(b64, chaveDe(SENHA)), texto);
  const semPrefixo = Buffer.concat([Buffer.from('v11'), Buffer.from(b64, 'base64').subarray(3)]).toString('base64');
  const ruins = [semPrefixo, 'isto-nao-e-base64!!', '', Buffer.from('v10curto').toString('base64'), 12345];
  for (const ruim of ruins) {
    assert.throws(() => decifrar(ruim, chaveDe(SENHA)), (e) => {
      assert.ok(e instanceof Error);
      assert.ok(e.message.length > 0);
      assert.ok(!e.message.includes('valor-secreto') && (String(ruim).length < 8 || !e.message.includes(String(ruim))) && !e.message.includes(SENHA));
      return true;
    });
  }
  assert.throws(() => decifrar(b64, chaveDe('senha-errada')), (e) => e instanceof Error && !e.message.includes('valor-secreto'));
});

// ---- escolha do token ----
test('tokenDaConta: o de maior expiresAt entre os não vencidos da conta com user:profile; senão null', () => {
  const cache = {
    [`acct:${CONTA_A}|org-1|user:profile`]: entrada('curto', AGORA + 1000),
    [`acct:${CONTA_A}|org-2|user:profile user:inference`]: entrada('longo', AGORA + 9000),
    [`acct:${CONTA_A}|org-3|user:profile`]: entrada('vencido', AGORA - 1),
    [`acct:${CONTA_A}|org-4|user:inference`]: entrada('sem-escopo', AGORA + 99_000),
    [`acct:${CONTA_B}|org-1|user:profile`]: entrada('de-outra-conta', AGORA + 99_000),
  };
  assert.equal(tokenDaConta(cache, CONTA_A, AGORA), 'longo');
  assert.equal(tokenDaConta(cache, CONTA_B, AGORA), 'de-outra-conta');
  assert.equal(tokenDaConta(cache, 'cccccccc', AGORA), null);
  assert.equal(tokenDaConta(cache, CONTA_A, AGORA + 10_000), null, 'todos vencidos');
  assert.equal(tokenDaConta({}, CONTA_A, AGORA), null);
  assert.equal(tokenDaConta(null, CONTA_A, AGORA), null);
  assert.equal(tokenDaConta({ [`acct:${CONTA_A}|x|user:profile`]: { token: '', expiresAt: AGORA + 1 } }, CONTA_A, AGORA), null, 'token vazio não vale');
  assert.equal(tokenDaConta({ [`acct:${CONTA_A}|x|user:profile`]: { token: 't', expiresAt: AGORA } }, CONTA_A, AGORA), null, 'expiresAt tem de ser maior que agora');
});

// ---- a leitura ----
test('lerUso: a ativa lê o config do app, a salva o login guardado; chamada com endereço e cabeçalhos fixos; cache 0600 sem token', async () => {
  const m = ambiente();
  const f = fetchFalso({ [TOKEN_A]: () => resposta(corpoDeUso(51, 37)), [TOKEN_B]: () => resposta(corpoDeUso(0, 12)) });
  const o = opcoes(m, { fetch: f });
  await atualizarUso(o);
  assert.equal(f.chamadas.length, 2);
  const porToken = Object.fromEntries(f.chamadas.map((c) => [c.opcoes.headers.Authorization, c]));
  assert.deepEqual(Object.keys(porToken).sort(), [`Bearer ${TOKEN_A}`, `Bearer ${TOKEN_B}`]);
  for (const c of f.chamadas) {
    assert.equal(c.url, 'https://api.anthropic.com/api/oauth/usage');
    assert.equal(c.url, ENDERECO);
    assert.deepEqual(Object.keys(c.opcoes.headers).sort(), ['Authorization', 'anthropic-beta']);
    assert.equal(c.opcoes.headers['anthropic-beta'], 'oauth-2025-04-20');
    assert.ok(c.opcoes.signal instanceof AbortSignal);
    assert.ok(!c.opcoes.method || c.opcoes.method === 'GET');
    assert.equal(c.opcoes.body, undefined);
  }
  const disco = cacheEmDisco(m);
  assert.deepEqual(Object.keys(disco).sort(), [CONTA_A, CONTA_B].sort());
  const hoje = new Date(AGORA).toISOString();
  assert.deepEqual(disco[CONTA_A], { sessao: 51, sessaoReinicia: '2026-11-08T16:10:00.000Z', semana: 37, semanaReinicia: '2026-11-14T00:00:00.000Z', lidoEm: hoje, erro: null, email: null });
  assert.equal(disco[CONTA_B].sessao, 0);
  assert.equal(disco[CONTA_B].semana, 12);
  assert.equal(statSync(join(m.dados, 'uso.json')).mode & 0o777, 0o600);
  const bruto = readFileSync(join(m.dados, 'uso.json'), 'utf8');
  for (const proibido of [TOKEN_A, TOKEN_B, `REFRESH-${TOKEN_A}`, SENHA, 'Bearer']) assert.ok(!bruto.includes(proibido), `uso.json guardou ${proibido}`);
  assert.deepEqual(lerCacheDeUso(m.env), disco);
});

test('lerUso: resets_at null vira null; o corpo traz só sessao e semana numéricas', async () => {
  const m = ambiente();
  const f = fetchFalso({ [TOKEN_A]: () => resposta({ five_hour: { utilization: 0, resets_at: null }, seven_day: { utilization: 3.5, resets_at: null } }) });
  await atualizarUso(opcoes(m, { fetch: f }));
  const a = cacheEmDisco(m)[CONTA_A];
  assert.deepEqual([a.sessao, a.sessaoReinicia, a.semana, a.semanaReinicia, a.erro], [0, null, 3.5, null, null]);
});

test('lerUso: cada falha vira um código; o erro de uma conta não toca a outra', async () => {
  const casos = [
    ['401 venceu', () => resposta('{}', 401), 'venceu'],
    ['429 limite', () => resposta('{}', 429), 'limite'],
    ['500 rede', () => resposta('{}', 500), 'rede'],
    ['fetch lança', () => new TypeError('fetch failed SEGREDO-DA-REDE'), 'rede'],
    ['prazo', () => Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }), 'rede'],
    ['não é JSON', () => resposta('<html>', 200), 'formato'],
    ['sem five_hour', () => resposta({ seven_day: { utilization: 1, resets_at: null } }), 'formato'],
    ['sem seven_day', () => resposta({ five_hour: { utilization: 1, resets_at: null } }), 'formato'],
    ['utilization texto', () => resposta({ five_hour: { utilization: '5', resets_at: null }, seven_day: { utilization: 1, resets_at: null } }), 'formato'],
    ['null', () => resposta('null', 200), 'formato'],
  ];
  for (const [nome, r, codigo] of casos) {
    const m = ambiente();
    const f = fetchFalso({ [TOKEN_B]: r });
    await atualizarUso(opcoes(m, { fetch: f }));
    const disco = cacheEmDisco(m);
    assert.equal(disco[CONTA_B].erro, codigo, nome);
    assert.equal(disco[CONTA_B].sessao, null, `${nome}: sem uso anterior`);
    assert.equal(disco[CONTA_A].erro, null, `${nome}: a outra segue boa`);
    assert.equal(disco[CONTA_A].sessao, 51);
    assert.ok(!readFileSync(join(m.dados, 'uso.json'), 'utf8').includes('SEGREDO-DA-REDE'), `${nome}: a mensagem do erro não vai ao arquivo`);
    esquecerUso();
  }
});

test('lerUso: o erro de uma conta mantém o último uso bom dela e grava o erro', async () => {
  const m = ambiente();
  let falha = false;
  const f = fetchFalso({ [TOKEN_B]: () => (falha ? resposta('{}', 401) : resposta(corpoDeUso(20, 30))) });
  const o = opcoes(m, { fetch: f });
  await atualizarUso(o);
  const bom = cacheEmDisco(m)[CONTA_B];
  assert.equal(bom.sessao, 20);
  falha = true;
  const o2 = { ...o, agora: () => AGORA + 600_000 };
  await atualizarUso(o2);
  const depois = cacheEmDisco(m)[CONTA_B];
  assert.deepEqual({ ...depois, erro: null }, bom, 'números e lidoEm do último uso bom ficam');
  assert.equal(depois.erro, 'venceu');
  assert.equal(depois.lidoEm, bom.lidoEm);
});

test('lerUso: sem token válido (vencido, sem login ou config torto) é venceu e não chama a rede por ela', async () => {
  const m = ambiente({ cacheB: cacheDe(CONTA_B, 'vencido', { expiresAt: AGORA - 1000 }) });
  const f = fetchFalso();
  await atualizarUso(opcoes(m, { fetch: f }));
  assert.equal(cacheEmDisco(m)[CONTA_B].erro, 'venceu');
  assert.equal(f.chamadas.length, 1, 'só a ativa foi à rede');
  assert.equal(cacheEmDisco(m)[CONTA_A].erro, null);
  // login guardado ilegível
  writeFileSync(join(m.dados, 'contas', CONTA_B, 'config.json'), 'lixo');
  esquecerUso();
  await atualizarUso(opcoes(m, { fetch: fetchFalso() }));
  assert.equal(cacheEmDisco(m)[CONTA_B].erro, 'venceu');
  // chave errada: nenhum login decifra
  esquecerUso();
  const f3 = fetchFalso();
  await atualizarUso(opcoes(m, { fetch: f3, lerSenha: async () => 'outra-senha' }));
  assert.equal(cacheEmDisco(m)[CONTA_A].erro, 'venceu');
  assert.equal(f3.chamadas.length, 0);
});

test('lerUso: 429 guarda o Retry-After e não relê a conta antes; depois relê', async () => {
  const m = ambiente();
  let limitar = true;
  const f = fetchFalso({ [TOKEN_B]: () => (limitar ? resposta('{}', 429, { 'Retry-After': '120' }) : resposta(corpoDeUso(9, 9))) });
  let agora = AGORA;
  const o = opcoes(m, { fetch: f, agora: () => agora });
  await atualizarUso(o);
  assert.equal(cacheEmDisco(m)[CONTA_B].erro, 'limite');
  const chamadasB = () => f.chamadas.filter((c) => c.opcoes.headers.Authorization.endsWith(TOKEN_B)).length;
  assert.equal(chamadasB(), 1);
  limitar = false;
  agora = AGORA + 119_000;
  await atualizarUso({ ...o, agora: () => agora });
  assert.equal(chamadasB(), 1, 'dentro do Retry-After não relê');
  assert.equal(cacheEmDisco(m)[CONTA_B].erro, 'limite');
  agora = AGORA + 121_000;
  await atualizarUso({ ...o, agora: () => agora });
  assert.equal(chamadasB(), 2);
  assert.equal(cacheEmDisco(m)[CONTA_B].erro, null);
  assert.equal(cacheEmDisco(m)[CONTA_B].sessao, 9);
});

test('lerUso: sem a chave na memória não lê nada nem chama a rede', async () => {
  const m = ambiente();
  const f = fetchFalso();
  const r = await lerUso(opcoes(m, { fetch: f }));
  assert.equal(r.ok, false);
  assert.equal(r.codigo, 'sem');
  assert.equal(f.chamadas.length, 0);
  assert.equal(existsSync(join(m.dados, 'uso.json')), false);
});

// ---- a chave ----
test('chave: sem → lendo → pronta; a senha é lida uma vez só; negada fica negada até o próximo gesto', async () => {
  const m = ambiente();
  assert.equal(estadoDaChave(), 'sem');
  let liberar;
  const lerSenha = () => { lerSenha.chamadas++; return new Promise((r) => { liberar = r; }); };
  lerSenha.chamadas = 0;
  const o = opcoes(m, { lerSenha });
  const primeiro = atualizarUso(o);
  assert.equal(estadoDaChave(), 'lendo');
  const segundo = await atualizarUso(o);
  assert.deepEqual(segundo, { ok: false, codigo: 'ocupado' });
  assert.equal(lerSenha.chamadas, 1);
  liberar(SENHA);
  const r = await primeiro;
  assert.equal(r.ok, true);
  assert.equal(r.chave, 'pronta');
  assert.equal(estadoDaChave(), 'pronta');
  assert.deepEqual(Object.keys(r.uso).sort(), [CONTA_A, CONTA_B].sort());
  await atualizarUso(o);
  assert.equal(lerSenha.chamadas, 1, 'a chave já está na memória');

  esquecerUso();
  const f = fetchFalso();
  const negou = async () => { throw new Error(`o macOS disse não; senha ${SENHA}`); };
  const n = await atualizarUso(opcoes(m, { lerSenha: negou, fetch: f }));
  assert.deepEqual(n, { ok: false, codigo: 'negada' });
  assert.equal(estadoDaChave(), 'negada');
  assert.equal(estadoDoUso().chaveMotivo, 'negou');
  assert.equal(estadoDoUso().chaveDesde, new Date(AGORA).toISOString());
  assert.equal(f.chamadas.length, 0);
  assert.equal(releituraSePreciso(opcoes(m, { fetch: f })), null, 'negada não relê sozinha');
  const semResp = await atualizarUso(opcoes(m, { fetch: f, lerSenha: async () => { throw Object.assign(new Error('x'), { motivo: 'semResposta' }); } }));
  assert.deepEqual(semResp, { ok: false, codigo: 'negada' });
  assert.equal(estadoDoUso().chaveMotivo, 'semResposta');
  const de = await atualizarUso(opcoes(m, { fetch: f }));
  assert.equal(de.ok, true, 'o próximo gesto tenta de novo');
  assert.equal(estadoDaChave(), 'pronta');
  assert.equal(estadoDoUso().chaveMotivo, null, 'pronta não leva motivo');
});

test('chave: senha vazia ou só quebra de linha é negada', async () => {
  const m = ambiente();
  for (const vazia of ['', '\n', undefined, null, 42]) {
    esquecerUso();
    const r = await atualizarUso(opcoes(m, { lerSenha: async () => vazia }));
    assert.deepEqual(r, { ok: false, codigo: 'negada' }, String(vazia));
  }
});

test('lerSenhaDoKeychain: security com argv fixo e prazo de 60 s, sem shell; saída ≠ 0 recusa', async () => {
  const chamadas = [];
  const execFile = (cmd, args, op, cb) => { chamadas.push({ cmd, args, op }); cb(null, 'SENHA-FALSA\n', ''); };
  assert.equal(await lerSenhaDoKeychain({ execFile }), 'SENHA-FALSA');
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].cmd, 'security');
  assert.deepEqual(chamadas[0].args, ['find-generic-password', '-w', '-s', 'Claude Safe Storage']);
  assert.equal(chamadas[0].op.timeout, 60000);
  assert.ok(!chamadas[0].op.shell);
  const falha = (cmd, args, op, cb) => cb(Object.assign(new Error('Command failed: security … SEGREDO'), { code: 44 }), '', 'saida de erro');
  await assert.rejects(() => lerSenhaDoKeychain({ execFile: falha }), (e) => e instanceof Error && !e.message.includes('SEGREDO') && e.motivo === 'negou');
  const prazo = (cmd, args, op, cb) => cb(Object.assign(new Error('timeout'), { killed: true, signal: 'SIGTERM' }), '', '');
  await assert.rejects(() => lerSenhaDoKeychain({ execFile: prazo }), (e) => e.motivo === 'semResposta');
});

// ---- releitura em segundo plano ----
test('releituraSePreciso: só com a chave pronta, a cada mais de 5 min e uma por vez', async () => {
  const m = ambiente();
  const f = fetchFalso();
  let agora = AGORA;
  const o = opcoes(m, { fetch: f, agora: () => agora });
  assert.equal(releituraSePreciso(o), null, 'sem chave não relê');
  await atualizarUso(o);
  assert.equal(f.chamadas.length, 2);
  agora = AGORA + 5 * 60_000;
  assert.equal(releituraSePreciso(o), null, 'com 5 min cravados ainda não');
  agora = AGORA + 5 * 60_000 + 1;
  const p = releituraSePreciso(o);
  assert.ok(p instanceof Promise);
  assert.equal(releituraSePreciso(o), null, 'já há uma leitura em curso');
  assert.deepEqual(await atualizarUso(o), { ok: false, codigo: 'ocupado' }, 'o gesto também espera');
  await p;
  assert.equal(f.chamadas.length, 4, 'uma releitura: uma chamada por conta');
  assert.equal(releituraSePreciso(o), null, 'acabou de ler');
  agora += 5 * 60_000 + 1;
  await releituraSePreciso(o);
  assert.equal(f.chamadas.length, 6);
});

// ---- releitura depois de um "adicionar e voltar" que guardou conta nova (F556) ----
const okDoAdicionar = (agora, extra = {}) => ({ comando: 'adicionar', conta: CONTA_B, voltarPara: CONTA_A, ok: true, codigo: null, mensagem: 'Conta guardada; o Claude voltou para a conta de antes.', inicio: new Date(agora - 40_000).toISOString(), fim: new Date(agora - 5_000).toISOString(), pid: 4242, ...extra });

test('releituraSePreciso com ultima: um ok novo do adicionar --voltar relê na hora (antes dos 5 min), uma vez por desfecho, sem pedir senha', async () => {
  const m = ambiente();
  const f = fetchFalso();
  const o = opcoes(m, { fetch: f, agora: () => AGORA });
  await atualizarUso(o);
  assert.equal(f.chamadas.length, 2);
  assert.equal(o.lerSenha.chamadas, 1);
  assert.equal(releituraSePreciso(o), null, 'sem o ok novo, 5 min ainda não passaram: a medida enxerga a diferença');
  const ultima = okDoAdicionar(AGORA);
  const p = releituraSePreciso({ ...o, ultima });
  assert.ok(p instanceof Promise, 'ok novo relê');
  await p;
  assert.equal(f.chamadas.length, 4, 'uma chamada por conta, a de B incluída');
  assert.ok(f.chamadas.some((c) => c.opcoes.headers.Authorization === `Bearer ${TOKEN_B}`), 'o uso de B foi pedido');
  assert.equal(o.lerSenha.chamadas, 1, 'o Keychain não foi tocado de novo');
  assert.equal(releituraSePreciso({ ...o, ultima }), null, 'o mesmo desfecho não relê duas vezes');
  assert.ok(releituraSePreciso({ ...o, ultima: okDoAdicionar(AGORA, { pid: 4243 }) }) instanceof Promise, 'outro desfecho relê');
});

test('releituraSePreciso com ultima: só o ok do adicionar --voltar com conta nova e recente conta', async () => {
  const m = ambiente();
  const f = fetchFalso();
  const o = opcoes(m, { fetch: f, agora: () => AGORA });
  await atualizarUso(o);
  const velho = okDoAdicionar(AGORA, { fim: new Date(AGORA - 2 * 60_000 - 1).toISOString() });
  const casos = {
    'falhou': okDoAdicionar(AGORA, { ok: false, codigo: 'prazo', conta: null }),
    'trocar': okDoAdicionar(AGORA, { comando: 'trocar' }),
    'mesma conta': okDoAdicionar(AGORA, { conta: CONTA_A }),
    'sem voltarPara (adicionar sem volta)': okDoAdicionar(AGORA, { voltarPara: null }),
    'sem conta': okDoAdicionar(AGORA, { conta: null }),
    'de mais de 2 min atrás': velho,
    'fim torto': okDoAdicionar(AGORA, { fim: 'ontem' }),
    'sem desfecho': null,
  };
  for (const [nome, ultima] of Object.entries(casos)) assert.equal(releituraSePreciso({ ...o, ultima }), null, nome);
  assert.equal(f.chamadas.length, 2, 'nenhuma releitura');
  assert.ok(releituraSePreciso({ ...o, ultima: okDoAdicionar(AGORA) }) instanceof Promise, 'a medida enxerga o caso bom');
});

test('releituraSePreciso com ultima: sem chave pronta não pede senha nem rede, e o ok conta como visto; com leitura em curso o ok fica por ver', async () => {
  const m = ambiente();
  const f = fetchFalso();
  const o = opcoes(m, { fetch: f, agora: () => AGORA });
  const ultima = okDoAdicionar(AGORA);
  assert.equal(releituraSePreciso({ ...o, ultima }), null, 'sem chave');
  assert.equal(o.lerSenha.chamadas, 0);
  assert.equal(f.chamadas.length, 0);
  await atualizarUso(o); // o gesto lê todas as contas, B inclusive
  assert.equal(f.chamadas.length, 2);
  assert.equal(releituraSePreciso({ ...o, ultima }), null, 'o ok que chegou sem chave não relê depois: o gesto já leu');

  esquecerUso();
  await atualizarUso(o);
  let solta;
  const trava = new Promise((r) => { solta = r; });
  const lento = async (...a) => { await trava; return f(...a); };
  const lendo = lerUso({ ...o, fetch: lento });
  assert.equal(releituraSePreciso({ ...o, ultima: okDoAdicionar(AGORA, { pid: 77 }) }), null, 'com leitura em curso não começa outra');
  solta();
  await lendo;
  assert.ok(releituraSePreciso({ ...o, ultima: okDoAdicionar(AGORA, { pid: 77 }) }) instanceof Promise, 'terminada a leitura, o mesmo ok ainda relê');
});

// ---- GET e rota ----
const H = { 'X-Painel-De-Contas': '1', 'Content-Type': 'application/json' };
function req(porta, metodo, caminho, corpo, { headers = H, host = `127.0.0.1:${porta}` } = {}) {
  return new Promise((resolve, reject) => {
    const dados = corpo === undefined ? '' : JSON.stringify(corpo);
    const r = http.request({ host: '127.0.0.1', port: porta, method: metodo, path: caminho, headers: { ...headers, Host: host, 'Content-Length': Buffer.byteLength(dados) }, setHost: false }, (res) => {
      const partes = [];
      res.on('data', (d) => partes.push(d));
      res.on('end', () => { const texto = Buffer.concat(partes).toString('utf8'); let json = null; try { json = JSON.parse(texto); } catch { /* vazio */ } resolve({ status: res.statusCode, headers: res.headers, json, texto }); });
    });
    r.on('error', reject);
    r.end(dados);
  });
}
async function subir(m, uso) {
  const servidor = criarServidor({ publico: PUBLICO, contas: { env: m.env, uso } });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  return { porta: servidor.address().port, fechar: () => new Promise((r) => servidor.close(r)) };
}

test('lerContas e GET /api/contas: chave e uso (cache) entram na resposta; resets_at passado não se zera no servidor', async () => {
  const m = ambiente();
  const r0 = lerContas({ env: m.env });
  assert.equal(r0.chave, 'sem');
  assert.equal(r0.chaveDesde, null);
  assert.equal(r0.chaveMotivo, null);
  assert.equal(r0.lendoUso, false);
  assert.deepEqual(r0.uso, {}, 'sem cache, mapa vazio');
  const passado = { sessao: 80, sessaoReinicia: '2020-01-01T00:00:00.000Z', semana: 10, semanaReinicia: '2020-01-02T00:00:00.000Z', lidoEm: '2026-11-08T14:00:00.000Z', erro: null, email: null };
  writeFileSync(join(m.dados, 'uso.json'), JSON.stringify({ [CONTA_A]: passado, 'sem/seguro': passado, [CONTA_B]: { ...passado, erro: 'rodar-comando' } }));
  const s = await subir(m, { lerSenha: senhaOk(), fetch: fetchFalso(), agora: () => AGORA });
  try {
    const r = await req(s.porta, 'GET', '/api/contas');
    assert.equal(r.status, 200);
    assert.equal(r.json.chave, 'sem');
    assert.deepEqual(r.json.uso[CONTA_A], passado, 'o servidor não zera a janela vencida');
    assert.equal('sem/seguro' in r.json.uso, false);
    assert.equal(r.json.uso[CONTA_B].erro, null, 'código de erro desconhecido não passa');
    assert.equal(r.json.contas.length, 2);
    const h = await req(s.porta, 'HEAD', '/api/contas');
    assert.equal(h.texto, '');
  } finally { await s.fechar(); }
});

test('GET /api/contas com a chave pronta e leitura velha dispara a releitura sem esperar e devolve o cache na hora', async () => {
  const m = ambiente();
  let agora = AGORA;
  const f = fetchFalso();
  let solta;
  const trava = new Promise((r) => { solta = r; });
  const lento = async (...a) => { await trava; return f(...a); };
  lento.chamadas = f.chamadas;
  await atualizarUso(opcoes(m, { fetch: f, agora: () => agora }));
  const antes = f.chamadas.length;
  agora = AGORA + 6 * 60_000;
  const s = await subir(m, { lerSenha: senhaOk(), fetch: lento, agora: () => agora });
  try {
    const r = await req(s.porta, 'GET', '/api/contas');
    assert.equal(r.status, 200, 'o GET não esperou a releitura (a rede está presa)');
    assert.equal(r.json.chave, 'pronta');
    assert.equal(r.json.uso[CONTA_A].sessao, 51);
    assert.equal(releituraSePreciso({ env: m.env, fetch: lento, agora: () => agora }), null, 'a releitura já está em curso');
    solta();
    for (let i = 0; i < 100 && f.chamadas.length < antes + 2; i++) await new Promise((x) => setTimeout(x, 10));
    assert.equal(f.chamadas.length, antes + 2);
  } finally { solta(); await s.fechar(); }
});

test('GET /api/contas depois de um adicionar --voltar ok, com a chave pronta: relê na hora, diz que está lendo, a cota de B vem sem gesto e sem senha', async () => {
  const m = ambiente();
  const f = fetchFalso();
  const o = opcoes(m, { fetch: f, agora: () => AGORA });
  await atualizarUso(o);
  assert.equal(f.chamadas.length, 2);
  writeFileSync(join(m.dados, 'ultima-acao.json'), JSON.stringify(okDoAdicionar(AGORA)));
  let solta;
  const trava = new Promise((r) => { solta = r; });
  const lento = async (...a) => { await trava; return f(...a); };
  lento.chamadas = f.chamadas;
  const s = await subir(m, { lerSenha: o.lerSenha, fetch: lento, agora: () => AGORA });
  try {
    const r = await req(s.porta, 'GET', '/api/contas');
    assert.equal(r.status, 200, 'o GET não esperou a rede');
    assert.equal(r.json.ultima.conta, CONTA_B);
    assert.equal(r.json.ultima.voltarPara, CONTA_A);
    assert.equal(r.json.lendoUso, true, 'a resposta já diz que está lendo');
    solta();
    await aguardarUso();
    assert.equal(f.chamadas.length, 4);
    assert.ok(f.chamadas.some((c) => c.opcoes.headers.Authorization === `Bearer ${TOKEN_B}`));
    assert.equal(o.lerSenha.chamadas, 1, 'sem pedir a senha de novo');
    const g = await req(s.porta, 'GET', '/api/contas');
    assert.equal(g.json.lendoUso, false);
    assert.equal(g.json.uso[CONTA_B].sessao, 51, 'a cota de B está no cache');
    assert.equal(f.chamadas.length, 4, 'o mesmo desfecho não relê');
  } finally { solta(); await s.fechar(); }
});

test('GET /api/contas depois de um adicionar --voltar ok, sem chave: não lê nada nem pede senha', async () => {
  const m = ambiente();
  const f = fetchFalso();
  const lerSenha = senhaOk();
  writeFileSync(join(m.dados, 'ultima-acao.json'), JSON.stringify(okDoAdicionar(AGORA)));
  const s = await subir(m, { lerSenha, fetch: f, agora: () => AGORA });
  try {
    const r = await req(s.porta, 'GET', '/api/contas');
    assert.equal(r.json.chave, 'sem');
    assert.equal(r.json.lendoUso, false);
    assert.equal(lerSenha.chamadas, 0);
    assert.equal(f.chamadas.length, 0);
  } finally { await s.fechar(); }
});

test('POST /api/contas/uso: guarda; 202 na hora com a chave lendo; o desfecho vem no GET; 409 ocupado; nada de segredo em resposta nem arquivo', async () => {
  const m = ambiente();
  const lerSenha = senhaOk();
  const f = fetchFalso();
  const s = await subir(m, { lerSenha, fetch: f, agora: () => AGORA });
  try {
    for (const [corpo, op] of [[{}, { headers: { 'Content-Type': 'application/json' } }], [{}, { host: `evil.com:${s.porta}` }], [{}, { headers: { ...H, Origin: 'http://evil.com' } }]]) {
      assert.equal((await req(s.porta, 'POST', '/api/contas/uso', corpo, op)).status, 403);
    }
    assert.equal(lerSenha.chamadas, 0, 'a guarda recusa antes de ler a chave');
    assert.equal(f.chamadas.length, 0);
    assert.equal((await req(s.porta, 'POST', '/api/contas/uso', [])).status, 400);

    const r = await req(s.porta, 'POST', '/api/contas/uso', {});
    assert.equal(r.status, 202);
    assert.equal(r.headers['cache-control'], 'no-store');
    assert.deepEqual(r.json, { ok: true, chave: 'lendo', desde: new Date(AGORA).toISOString() });
    await aguardarUso();
    const g = await req(s.porta, 'GET', '/api/contas');
    assert.equal(g.json.chave, 'pronta');
    assert.equal(g.json.chaveMotivo, null);
    assert.equal(g.json.lendoUso, false);
    assert.equal(g.json.uso[CONTA_A].sessao, 51);
    assert.equal(g.json.uso[CONTA_A].semana, 37, 'o número vem como veio, de 0 a 100');
    const arquivo = readFileSync(join(m.dados, 'uso.json'), 'utf8');
    assert.ok(arquivo.length > 2);
    for (const proibido of [TOKEN_A, TOKEN_B, `REFRESH-${TOKEN_A}`, SENHA, 'Bearer']) {
      for (const [onde, texto] of [['POST', r.texto], ['GET', g.texto], ['uso.json', arquivo]]) assert.ok(!texto.includes(proibido), `${onde} vazou ${proibido}`);
    }

    // com a chave pronta o gesto só relê as contas
    const de = await req(s.porta, 'POST', '/api/contas/uso', {});
    assert.equal(de.status, 202);
    assert.equal(de.json.chave, 'pronta');
    await aguardarUso();
    assert.equal(lerSenha.chamadas, 1);

    // ocupado: uma leitura presa
    esquecerUso();
    let solta;
    const presa = new Promise((x) => { solta = x; });
    const s2 = await subir(m, { lerSenha: async () => { await presa; return SENHA; }, fetch: f, agora: () => AGORA });
    try {
      const primeira = await req(s2.porta, 'POST', '/api/contas/uso', {});
      assert.equal(primeira.status, 202, 'não espera o aviso do macOS');
      assert.equal(estadoDaChave(), 'lendo');
      const g2 = await req(s2.porta, 'GET', '/api/contas');
      assert.equal(g2.json.chave, 'lendo');
      assert.equal(g2.json.chaveDesde, new Date(AGORA).toISOString());
      const segunda = await req(s2.porta, 'POST', '/api/contas/uso', {});
      assert.equal(segunda.status, 409);
      assert.equal(segunda.json.ok, false);
      assert.equal(segunda.json.codigo, 'ocupado');
      solta();
      await aguardarUso();
      assert.equal((await req(s2.porta, 'GET', '/api/contas')).json.chave, 'pronta');
    } finally { solta(); await s2.fechar(); }

    // negada: a resposta já foi 202; o GET traz o estado e o motivo
    for (const [motivo, esperado] of [[undefined, 'negou'], ['semResposta', 'semResposta']]) {
      esquecerUso();
      const s3 = await subir(m, { lerSenha: async () => { throw Object.assign(new Error(SENHA), { motivo }); }, fetch: f, agora: () => AGORA });
      try {
        const n = await req(s3.porta, 'POST', '/api/contas/uso', {});
        assert.equal(n.status, 202);
        await aguardarUso();
        const gn = await req(s3.porta, 'GET', '/api/contas');
        assert.equal(gn.json.chave, 'negada');
        assert.equal(gn.json.chaveMotivo, esperado);
        assert.ok(!gn.texto.includes(SENHA));
        assert.equal(gn.json.lendoUso, false);
      } finally { await s3.fechar(); }
    }
  } finally { await s.fechar(); }
});

test('GET /api/contas: tentarDepois só na conta com limite (Retry-After, ou +5 min sem cabeçalho) e lendoUso durante a releitura', async () => {
  const m = ambiente();
  let cabecalho = { 'Retry-After': '120' };
  let solta;
  let presa = Promise.resolve();
  const f = fetchFalso({ [TOKEN_B]: () => resposta('{}', 429, cabecalho) });
  const preso = async (...a) => { await presa; return f(...a); };
  const o = opcoes(m, { fetch: preso });
  await atualizarUso(o);
  const s = await subir(m, { lerSenha: senhaOk(), fetch: preso, agora: () => AGORA });
  try {
    const g = await req(s.porta, 'GET', '/api/contas');
    assert.equal(g.json.uso[CONTA_B].erro, 'limite');
    assert.equal(g.json.uso[CONTA_B].tentarDepois, new Date(AGORA + 120_000).toISOString());
    assert.equal('tentarDepois' in g.json.uso[CONTA_A], false, 'sem limite, sem a chave');
    assert.equal(g.json.lendoUso, false);
  } finally { await s.fechar(); }
  esquecerUso();
  cabecalho = {};
  await atualizarUso(opcoes(m, { fetch: preso }));
  assert.equal(lerContas({ env: m.env }).uso[CONTA_B].tentarDepois, new Date(AGORA + 300_000).toISOString());

  // lendoUso: uma releitura com a rede presa
  presa = new Promise((x) => { solta = x; });
  const velho = { ...opcoes(m, { fetch: preso }), agora: () => AGORA + 400_000 };
  const p = releituraSePreciso(velho);
  assert.ok(p instanceof Promise);
  assert.equal(lerContas({ env: m.env }).lendoUso, true);
  assert.equal(lerContas({ env: m.env }).chave, 'pronta');
  solta();
  await p;
  assert.equal(lerContas({ env: m.env }).lendoUso, false);
});

test('POST /api/contas/uso: lista das contas ilegível é 500 outro, sem derrubar o servidor', async () => {
  const m = ambiente();
  rmSync(join(m.appDir, 'config.json'));
  const s = await subir(m, { lerSenha: senhaOk(), fetch: fetchFalso(), agora: () => AGORA });
  try {
    const r = await req(s.porta, 'POST', '/api/contas/uso', {});
    assert.equal(r.status, 500);
    assert.equal(r.json.codigo, 'outro');
  } finally { await s.fechar(); }
});

// ---- consertos da revisão ----
test('GET /api/contas: com a troca em andamento (troca.lock viva) a releitura não começa; sem a trava, começa', async () => {
  const m = ambiente();
  let agora = AGORA;
  const f = fetchFalso();
  await atualizarUso(opcoes(m, { fetch: f, agora: () => agora }));
  const antes = f.chamadas.length;
  assert.equal(antes, 2);
  agora = AGORA + 6 * 60_000;
  const trava = join(m.dados, 'troca.lock');
  writeFileSync(trava, String(process.pid)); // este processo está vivo: a troca "está rodando"
  const s = await subir(m, { lerSenha: senhaOk(), fetch: f, agora: () => agora });
  try {
    const r = await req(s.porta, 'GET', '/api/contas');
    assert.equal(r.json.andamento?.pid, process.pid, 'a medida enxerga a troca em andamento');
    assert.equal(r.json.chave, 'pronta');
    await new Promise((x) => setTimeout(x, 150));
    assert.equal(f.chamadas.length, antes, 'a troca regrava o app: o painel não lê o config dele agora');
    rmSync(trava);
    const depois = await req(s.porta, 'GET', '/api/contas');
    assert.equal(depois.json.andamento, null);
    for (let i = 0; i < 100 && f.chamadas.length < antes + 2; i++) await new Promise((x) => setTimeout(x, 10));
    assert.equal(f.chamadas.length, antes + 2, 'sem a trava, a releitura volta');
  } finally { await s.fechar(); }
});

test('chave que não decifra o login de nenhuma conta: volta a sem, descarta a chave e não grava erro no cache', async () => {
  const m = ambiente();
  const f = fetchFalso();
  const lerSenha = async () => { lerSenha.chamadas++; return 'OUTRA-SENHA-FALSA'; };
  lerSenha.chamadas = 0;
  const r = await atualizarUso(opcoes(m, { lerSenha, fetch: f }));
  assert.equal(r.ok, false);
  assert.equal(estadoDaChave(), 'sem', 'o botão reaparece');
  assert.equal(estadoDoUso().chave, 'sem');
  assert.equal(estadoDoUso().chaveMotivo, null);
  assert.equal(f.chamadas.length, 0, 'sem token não há chamada');
  assert.equal(existsSync(join(m.dados, 'uso.json')), false, 'não grava venceu em contas que só tinham a chave errada');
  assert.deepEqual(await lerUso(opcoes(m, { fetch: f })), { ok: false, codigo: 'sem' }, 'os bytes foram descartados');
  assert.equal(releituraSePreciso(opcoes(m, { fetch: f, agora: () => AGORA + 10 * 60_000 })), null);
  // o próximo gesto lê a chave de novo
  const bom = senhaOk();
  const de = await atualizarUso(opcoes(m, { lerSenha: bom, fetch: f }));
  assert.equal(de.ok, true);
  assert.equal(bom.chamadas, 1);
  assert.equal(estadoDaChave(), 'pronta');
  assert.equal(f.chamadas.length, 2);
});

test('chave que decifra o login de uma conta só, ou contas sem login: a chave segue pronta', async () => {
  const m = ambiente();
  writeFileSync(join(m.dados, 'contas', CONTA_B, 'config.json'), textoDeConfig({ ...configDe(CONTA_B), 'oauth:tokenCacheV2': cifrar(cacheDe(CONTA_B, TOKEN_B), 'OUTRA-SENHA-FALSA') }));
  const r = await atualizarUso(opcoes(m));
  assert.equal(r.ok, true);
  assert.equal(estadoDaChave(), 'pronta', 'a conta A decifrou: a chave serve');
  assert.equal(r.uso[CONTA_A].sessao, 51);
  assert.equal(r.uso[CONTA_B].erro, 'venceu');
  esquecerUso();
  const n = ambiente();
  for (const id of [CONTA_A, CONTA_B]) {
    const { 'oauth:tokenCacheV2': _login, ...semLogin } = configDe(id);
    for (const cfg of id === CONTA_A ? [join(n.appDir, 'config.json'), join(n.dados, 'contas', id, 'config.json')] : [join(n.dados, 'contas', id, 'config.json')]) writeFileSync(cfg, textoDeConfig(semLogin)); // sem oauth:tokenCacheV2: ainda não entrou
  }
  const sem = await atualizarUso(opcoes(n));
  assert.equal(sem.ok, true);
  assert.equal(estadoDaChave(), 'pronta', 'sem login não é culpa da chave');
  assert.equal(sem.uso[CONTA_A].erro, 'venceu');
  assert.equal(sem.uso[CONTA_B].erro, 'venceu');
});

test('exclusivo: a leitura que acaba não solta a trava de outra que começou depois', async () => {
  const m = ambiente();
  let liberarA; let liberarB;
  const pa = atualizarUso(opcoes(m, { lerSenha: () => new Promise((r) => { liberarA = r; }) }));
  esquecerUso(); // zera a leitura em curso (só os testes fazem isso)
  const pb = atualizarUso(opcoes(m, { lerSenha: () => new Promise((r) => { liberarB = r; }) }));
  assert.equal(typeof liberarB, 'function', 'B começou');
  liberarA(SENHA);
  await pa;
  assert.deepEqual(await atualizarUso(opcoes(m)), { ok: false, codigo: 'ocupado' }, 'B ainda está lendo: a trava é dele');
  liberarB(SENHA);
  await pb;
});

test('lerSenhaDoKeychain: sem o comando security (ENOENT) o motivo é semSecurity, não negou; chega ao estado da chave', async () => {
  const semComando = (cmd, args, op, cb) => cb(Object.assign(new Error('spawn security ENOENT SEGREDO'), { code: 'ENOENT' }), '', '');
  await assert.rejects(() => lerSenhaDoKeychain({ execFile: semComando }), (e) => e instanceof Error && !e.message.includes('SEGREDO') && e.motivo === 'semSecurity');
  const m = ambiente();
  const lerSenha = () => lerSenhaDoKeychain({ execFile: semComando });
  const r = await atualizarUso(opcoes(m, { lerSenha }));
  assert.deepEqual(r, { ok: false, codigo: 'negada' });
  assert.equal(estadoDoUso().chave, 'negada');
  assert.equal(estadoDoUso().chaveMotivo, 'semSecurity');
  assert.equal(lerContas({ env: m.env }).chaveMotivo, 'semSecurity');
});

test('toda rota de ação do painel tem tratador, inclusive a do uso', async () => {
  const { TRATADORES } = await import('../acoes.mjs');
  const rotas = Object.keys(TRATADORES).sort();
  assert.deepEqual(rotas, ['/api/contas/adicionar', '/api/contas/cancelar', '/api/contas/nomear', '/api/contas/sincronizar', '/api/contas/trocar', '/api/contas/uso', '/api/tema']);
});

// ---- o e-mail de cada conta (fatia 5) ----
const perfilDe = (uuid, email) => () => resposta({ account: { uuid, email, full_name: 'Ignorado' }, organization: { uuid: 'org' } });

test('emailLimpo: aceita e-mail plausível e recusa o resto', () => {
  assert.equal(emailLimpo('pessoa@exemplo.com.br'), 'pessoa@exemplo.com.br');
  for (const ruim of ['', 'sem-arroba', 'a@b@c', 'com espaço@x.com', 'a@\nb', `${'a'.repeat(250)}@x.com`, null, 42, {}]) assert.equal(emailLimpo(ruim), null, JSON.stringify(ruim));
});

test('o perfil dá o e-mail na primeira leitura, vai ao cache 0600 e não se busca de novo', async () => {
  const m = ambiente();
  const f = fetchFalso({}, { [TOKEN_A]: perfilDe(CONTA_A, 'pessoal@exemplo.com'), [TOKEN_B]: perfilDe(CONTA_B, 'trabalho@exemplo.com') });
  await atualizarUso(opcoes(m, { fetch: f }));
  assert.equal(f.perfis.length, 2);
  for (const c of f.perfis) {
    assert.equal(c.url, 'https://api.anthropic.com/api/oauth/profile');
    assert.deepEqual(Object.keys(c.opcoes.headers).sort(), ['Authorization', 'anthropic-beta']);
    assert.equal(c.opcoes.redirect, 'error');
  }
  const disco = cacheEmDisco(m);
  assert.equal(disco[CONTA_A].email, 'pessoal@exemplo.com');
  assert.equal(disco[CONTA_B].email, 'trabalho@exemplo.com');
  assert.equal(disco[CONTA_A].sessao, 51, 'o uso segue lido');
  assert.equal(statSync(join(m.dados, 'uso.json')).mode & 0o777, 0o600);
  const texto = readFileSync(join(m.dados, 'uso.json'), 'utf8');
  assert.ok(texto.length > 0);
  for (const segredo of [TOKEN_A, TOKEN_B, SENHA, 'Ignorado']) assert.ok(!texto.includes(segredo), `não grava ${segredo}`);
  assert.deepEqual(emailsDasContas(m.env), { [CONTA_A]: 'pessoal@exemplo.com', [CONTA_B]: 'trabalho@exemplo.com' });
  assert.deepEqual(lerContas({ env: m.env }).emails, emailsDasContas(m.env), 'o GET leva os e-mails');
  await lerUso(opcoes(m, { fetch: f }));
  assert.equal(f.chamadas.length, 4, 'o uso é relido');
  assert.equal(f.perfis.length, 2, 'o perfil não: o e-mail já está guardado');
  assert.equal(cacheEmDisco(m)[CONTA_B].email, 'trabalho@exemplo.com');
});

test('perfil que falha, de outra conta ou com e-mail torto não dá e-mail nem estraga o uso; 401 no uso nem chama o perfil', async () => {
  const casos = [
    ['500', () => resposta('{}', 500)],
    ['rede', () => new TypeError('fetch failed')],
    ['não é JSON', () => resposta('<html>', 200)],
    ['de outra conta', perfilDe(CONTA_B, 'intrusa@exemplo.com')],
    ['e-mail torto', perfilDe(CONTA_A, 'não é e-mail')],
    ['sem account', () => resposta({ email: 'solto@exemplo.com' })],
  ];
  for (const [nome, perfil] of casos) {
    esquecerUso();
    const m = ambiente();
    const f = fetchFalso({}, { [TOKEN_A]: perfil });
    await atualizarUso(opcoes(m, { fetch: f }));
    assert.ok(f.perfis.length > 0, `${nome}: o perfil foi pedido`);
    const a = cacheEmDisco(m)[CONTA_A];
    assert.equal(a.email, null, nome);
    assert.equal(a.sessao, 51, `${nome}: o uso segue`);
  }
  esquecerUso();
  const m = ambiente();
  const f = fetchFalso({ [TOKEN_A]: () => resposta('{}', 401) }, { [TOKEN_A]: perfilDe(CONTA_A, 'pessoal@exemplo.com') });
  await atualizarUso(opcoes(m, { fetch: f }));
  assert.equal(f.perfis.filter((c) => c.opcoes.headers.Authorization.endsWith(TOKEN_A)).length, 0, 'login vencido: sem perfil');
  assert.equal(cacheEmDisco(m)[CONTA_A].erro, 'venceu');
});

test('o erro de uma releitura não apaga o e-mail guardado', async () => {
  const m = ambiente();
  await atualizarUso(opcoes(m, { fetch: fetchFalso({}, { [TOKEN_A]: perfilDe(CONTA_A, 'pessoal@exemplo.com') }) }));
  assert.equal(cacheEmDisco(m)[CONTA_A].email, 'pessoal@exemplo.com');
  await lerUso(opcoes(m, { fetch: fetchFalso({ [TOKEN_A]: () => new TypeError('fetch failed') }) }));
  const a = cacheEmDisco(m)[CONTA_A];
  assert.equal(a.erro, 'rede');
  assert.equal(a.email, 'pessoal@exemplo.com');
});

test('sem gesto, o .claude.json do Claude Code dá o e-mail da conta dele; o do perfil vale mais', () => {
  const m = ambiente();
  assert.deepEqual(emailsDasContas(m.env), {}, 'sem arquivo, sem e-mail');
  const arq = join(m.env.CLAUDE_CONFIG_DIR, '.claude.json');
  writeFileSync(arq, JSON.stringify({ projects: { x: {} }, oauthAccount: { accountUuid: CONTA_B, emailAddress: 'trabalho@exemplo.com', displayName: 'Ignorado' } }));
  assert.deepEqual(emailsDasContas(m.env), { [CONTA_B]: 'trabalho@exemplo.com' });
  assert.deepEqual(lerContas({ env: m.env }).emails, { [CONTA_B]: 'trabalho@exemplo.com' });
  writeFileSync(join(m.dados, 'uso.json'), JSON.stringify({ [CONTA_B]: { email: 'perfil@exemplo.com' } }));
  assert.deepEqual(emailsDasContas(m.env), { [CONTA_B]: 'perfil@exemplo.com' }, 'o do perfil vale mais');
  rmSync(join(m.dados, 'uso.json'));
  writeFileSync(arq, JSON.stringify({ oauthAccount: { accountUuid: '../fora', emailAddress: 'x@y.com' }, extra: 'mudou o tamanho' }));
  assert.deepEqual(emailsDasContas(m.env), {}, 'uuid fora do padrão não vale');
  writeFileSync(arq, '{ torto');
  assert.deepEqual(emailsDasContas(m.env), {}, 'arquivo torto: sem e-mail, sem erro');
});
