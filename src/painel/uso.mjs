// O uso de cada conta do app do Claude no painel: as janelas de 5 h e da semana, lidas de
// `GET api.anthropic.com/api/oauth/usage` com o token de cada conta. Na mesma volta, o e-mail da conta que o cache ainda
// não tem sai de `GET /api/oauth/profile` (fatia 5); sem gesto, o `.claude.json` do Claude Code dá o e-mail da conta dele.
// Segredo: a senha do Keychain vira uma chave derivada e é descartada; a chave fica só na memória deste processo.
// O token fica só na memória da chamada. Nada disso vai a arquivo, log, resposta ou mensagem de erro: o `uso.json`
// guarda só números, horários, o código do erro e o e-mail da conta.
import { createDecipheriv, pbkdf2Sync } from 'node:crypto';
import { execFile as execFileReal } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { criarApp, escreverAtomico, idSeguro, pastaDeDados } from '../troca/app-do-claude.mjs';
import { criarTroca } from '../troca/troca.mjs';

export const ENDERECO = 'https://api.anthropic.com/api/oauth/usage';
export const ENDERECO_DO_PERFIL = 'https://api.anthropic.com/api/oauth/profile';
const BETA = 'oauth-2025-04-20';
const PRAZO_DA_REDE_MS = 15_000;
const PRAZO_DA_SENHA_MS = 60_000;
const VELHICE_MS = 5 * 60_000;
const ESPERA_PADRAO_MS = 5 * 60_000;
const ESPERA_MAXIMA_MS = 60 * 60_000;
const ERROS = new Set(['venceu', 'limite', 'rede', 'formato']);

// A chave e a leitura em curso moram aqui, no módulo: valem até o processo sair.
const E = { chave: 'sem', chaveDesde: null, chaveMotivo: null, bytes: null, curso: null, lendoUso: false, ultimaTentativa: null, retryAte: new Map(), okVisto: null };
const OK_RECENTE_MS = 2 * 60_000;

/** Só para os testes: esquece a chave, a leitura em curso e os prazos. */
export function esquecerUso() {
  E.chave = 'sem'; E.chaveDesde = null; E.chaveMotivo = null; E.bytes = null; E.curso = null; E.lendoUso = false; E.ultimaTentativa = null; E.retryAte = new Map(); E.okVisto = null;
}

/** `sem` (não lida), `lendo`, `pronta` ou `negada`. */
export const estadoDaChave = () => E.chave;

/** O que a tela precisa da leitura: a chave, quando a leitura dela começou, por que foi negada (`negou`, `semResposta` ou `semSecurity`) e se as contas estão sendo relidas. */
export const estadoDoUso = () => ({ chave: E.chave, chaveDesde: E.chaveDesde, chaveMotivo: E.chave === 'negada' ? E.chaveMotivo : null, lendoUso: E.lendoUso });

/** Espera a leitura em curso (para os testes e para quem precisa do desfecho). */
export const aguardarUso = () => (E.curso ?? Promise.resolve()).then(() => undefined);

/** A chave do Chromium no Mac: PBKDF2-SHA1(senha, `saltysalt`, 1003 voltas, 16 bytes). */
export const chaveDe = (senha) => pbkdf2Sync(senha, 'saltysalt', 1003, 16, 'sha1');

/** Decifra um valor `v10…` (AES-128-CBC, IV de 16 espaços) em base64. O erro nunca leva o valor, a chave nem o texto. */
export function decifrar(b64, chave) {
  try {
    if (typeof b64 !== 'string' || !b64) throw new Error();
    const bruto = Buffer.from(b64, 'base64');
    if (bruto.length <= 3 || bruto.subarray(0, 3).toString('latin1') !== 'v10') throw new Error();
    const d = createDecipheriv('aes-128-cbc', chave, Buffer.alloc(16, ' '));
    return Buffer.concat([d.update(bruto.subarray(3)), d.final()]).toString('utf8');
  } catch { throw new Error('não consegui decifrar o login guardado'); }
}

const temEscopo = (chaveDaEntrada, e) => chaveDaEntrada.includes('user:profile')
  || [e?.scopes, e?.scope].some((s) => (Array.isArray(s) ? s.includes('user:profile') : typeof s === 'string' && s.split(/[\s,]+/).includes('user:profile')));

/** O token de acesso da conta: entre as entradas `acct:<conta>|…` com `user:profile` ainda não vencidas, o de maior `expiresAt`. */
export function tokenDaConta(cache, conta, agora) {
  if (!cache || typeof cache !== 'object') return null;
  let melhor = null;
  for (const [k, e] of Object.entries(cache)) {
    if (!k.startsWith(`acct:${conta}|`) || !e || typeof e !== 'object') continue;
    if (typeof e.token !== 'string' || !e.token || !Number.isFinite(e.expiresAt) || !(e.expiresAt > agora)) continue;
    if (!temEscopo(k, e)) continue;
    if (!melhor || e.expiresAt > melhor.expiresAt) melhor = e;
  }
  return melhor ? melhor.token : null;
}

// O prazo estourado mata o processo (`semResposta`); sem o comando `security` neste Mac (`semSecurity`); saída ≠ 0 antes disso é recusa (`negou`).
const motivoDaRecusa = (erro) => (erro?.code === 'ENOENT' ? 'semSecurity' : erro?.killed || erro?.signal || erro?.code === 'ETIMEDOUT' ? 'semResposta' : 'negou');

/** A senha do Keychain por `security`, sem shell e com prazo. Recusa sem repassar a mensagem do erro. */
export function lerSenhaDoKeychain({ execFile = execFileReal } = {}) {
  return new Promise((resolve, reject) => {
    try {
      execFile('security', ['find-generic-password', '-w', '-s', 'Claude Safe Storage'], { timeout: PRAZO_DA_SENHA_MS }, (erro, saida) => {
        if (erro || typeof saida !== 'string') reject(Object.assign(new Error('negada'), { motivo: motivoDaRecusa(erro) }));
        else resolve(saida.replace(/\r?\n$/, ''));
      });
    } catch { reject(Object.assign(new Error('negada'), { motivo: 'negou' })); }
  });
}

// ---- o cache (sem segredo) ----
const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const horario = (v) => (typeof v === 'string' && Number.isFinite(Date.parse(v)) ? v : null);
/** Um e-mail plausível (até 254 caracteres, um `@`, sem espaço nem caractere de controle), ou `null`. */
export const emailLimpo = (v) => (typeof v === 'string' && v.length <= 254 && /^[^\s@\p{Cc}]+@[^\s@\p{Cc}]+$/u.test(v) ? v : null);
const arquivoDoCache = (env) => join(pastaDeDados(env), 'uso.json');
const entradaLimpa = (e) => ({
  sessao: numero(e?.sessao), sessaoReinicia: horario(e?.sessaoReinicia),
  semana: numero(e?.semana), semanaReinicia: horario(e?.semanaReinicia),
  lidoEm: horario(e?.lidoEm), erro: ERROS.has(e?.erro) ? e.erro : null, email: emailLimpo(e?.email),
});

/** O último uso gravado, por uuid. Sem arquivo, torto ou uuid fora do padrão: some, sem erro. */
export function lerCacheDeUso(env = process.env) {
  try {
    const bruto = JSON.parse(readFileSync(arquivoDoCache(env), 'utf8'));
    if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return {};
    return Object.fromEntries(Object.entries(bruto).filter(([id, e]) => idSeguro(id) && e && typeof e === 'object').map(([id, e]) => [id, entradaLimpa(e)]));
  } catch { return {}; }
}

/** O cache para a tela: o mesmo mapa e, na conta com erro `limite`, `tentarDepois` (ISO do Retry-After guardado na memória, ou `null` depois de o servidor reiniciar). */
export function usoParaATela(env = process.env) {
  const uso = lerCacheDeUso(env);
  for (const [id, e] of Object.entries(uso)) {
    if (e.erro !== 'limite') continue;
    const ate = E.retryAte.get(id);
    e.tentarDepois = Number.isFinite(ate) ? new Date(ate).toISOString() : null;
  }
  return uso;
}

// ---- o e-mail de cada conta ----
// O `.claude.json` do Claude Code (em `CLAUDE_CONFIG_DIR`, senão em `HOME`) traz `oauthAccount.{accountUuid, emailAddress}` da
// conta em que ele entrou: quando ela é uma conta do app, o e-mail aparece antes do gesto. O arquivo tem centenas de KB e o GET
// é frequente: relê só quando o tamanho ou a data mudam.
let doClaudeCode = { chave: null, mapa: {} };
function emailDoClaudeCode(env) {
  const caminhos = [env.CLAUDE_CONFIG_DIR ? join(env.CLAUDE_CONFIG_DIR, '.claude.json') : null, join(env.HOME || homedir(), '.claude.json')].filter(Boolean);
  for (const arq of caminhos) {
    let st;
    try { st = statSync(arq); } catch { continue; }
    const chave = `${arq}|${st.size}|${st.mtimeMs}`;
    if (doClaudeCode.chave === chave) return doClaudeCode.mapa;
    let mapa = {};
    try {
      const o = JSON.parse(readFileSync(arq, 'utf8'))?.oauthAccount;
      const email = emailLimpo(o?.emailAddress);
      if (idSeguro(o?.accountUuid) && email) mapa = { [o.accountUuid]: email };
    } catch { /* torto: sem e-mail */ }
    doClaudeCode = { chave, mapa };
    return mapa;
  }
  return {};
}

/** O e-mail que se sabe de cada conta, por uuid: o do perfil (guardado no cache do uso) vale mais que o do Claude Code. */
export function emailsDasContas(env = process.env) {
  const mapa = { ...emailDoClaudeCode(env) };
  for (const [id, e] of Object.entries(lerCacheDeUso(env))) if (e.email) mapa[id] = e.email;
  return mapa;
}

// ---- a leitura de uma conta ----
const SEM_USO = { sessao: null, sessaoReinicia: null, semana: null, semanaReinicia: null, lidoEm: null, erro: null, email: null };

function esperaDoRetryAfter(valor) {
  const v = String(valor ?? '').trim();
  let ms = ESPERA_PADRAO_MS;
  if (/^\d+$/.test(v)) ms = Number(v) * 1000;
  else if (v && Number.isFinite(Date.parse(v))) ms = Date.parse(v) - Date.now();
  return Math.min(Math.max(ms, 1000), ESPERA_MAXIMA_MS);
}

/** O login decifrado da conta: a ativa vem do config do app, as outras do login guardado. */
function loginDe(c, { app, env, chave }) {
  const cfg = c.ativa ? app.lerConfig() : JSON.parse(readFileSync(join(pastaDeDados(env), 'contas', c.uuid, 'config.json'), 'utf8'));
  const bruto = cfg?.['oauth:tokenCacheV2'];
  if (typeof bruto !== 'string' || !bruto) throw new Error('sem login'); // a conta ainda não entrou: não é culpa da chave
  try { return JSON.parse(decifrar(bruto, chave)); } catch { throw Object.assign(new Error('chave'), { chaveRuim: true }); } // a chave não abre o login (o texto sai errado ou não é JSON)
}

/** O corpo da resposta → o uso, ou `null` se não tem `five_hour` e `seven_day` com `utilization` numérico. */
function usoDoCorpo(corpo, lidoEm) {
  const f = corpo?.five_hour; const s = corpo?.seven_day;
  if (!f || typeof f !== 'object' || !s || typeof s !== 'object') return null;
  if (numero(f.utilization) === null || numero(s.utilization) === null) return null;
  return { sessao: f.utilization, sessaoReinicia: horario(f.resets_at), semana: s.utilization, semanaReinicia: horario(s.resets_at), lidoEm, erro: null };
}

/** O e-mail do perfil da conta, ou `null` em qualquer falha (o uso não depende dele). Perfil de outra conta não vale. */
async function emailDoPerfil(token, uuid, fetch) {
  try {
    const res = await fetch(ENDERECO_DO_PERFIL, { method: 'GET', headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': BETA }, signal: AbortSignal.timeout(PRAZO_DA_REDE_MS), redirect: 'error' });
    if (!res.ok) return null;
    const conta = (await res.json())?.account;
    if (!conta || typeof conta !== 'object' || (conta.uuid !== undefined && conta.uuid !== uuid)) return null;
    return emailLimpo(conta.email);
  } catch { return null; }
}

/** Lê o uso de uma conta e devolve `{ uso }` ou `{ erro }` (só o código; `chaveRuim` quando a chave não abriu o login dela), mais `email` quando `querEmail` e o perfil o deu. */
async function lerDaConta(c, { app, env, chave, fetch, agora, querEmail = false }) {
  const r = await lerUsoDaConta(c, { app, env, chave, fetch, agora });
  if (querEmail && r.token) r.email = await emailDoPerfil(r.token, c.uuid, fetch);
  delete r.token;
  return r;
}

async function lerUsoDaConta(c, { app, env, chave, fetch, agora }) {
  let token;
  try { token = tokenDaConta(loginDe(c, { app, env, chave }), c.uuid, agora()); } catch (e) { if (e?.chaveRuim === true) return { erro: 'venceu', chaveRuim: true }; token = null; }
  if (!token) return { erro: 'venceu' };
  let res;
  try {
    res = await fetch(ENDERECO, { method: 'GET', headers: { Authorization: `Bearer ${token}`, 'anthropic-beta': BETA }, signal: AbortSignal.timeout(PRAZO_DA_REDE_MS), redirect: 'error' });
  } catch { return { erro: 'rede' }; }
  if (res.status === 401) return { erro: 'venceu' };
  if (res.status === 429) { E.retryAte.set(c.uuid, agora() + esperaDoRetryAfter(res.headers?.get?.('retry-after'))); return { erro: 'limite' }; }
  if (!res.ok) return { erro: 'rede' };
  let corpo;
  try { corpo = await res.json(); } catch { return { erro: 'formato', token }; }
  const uso = usoDoCorpo(corpo, new Date(agora()).toISOString());
  return uso ? { uso, token } : { erro: 'formato', token }; // o token volta só a `lerDaConta`, para o perfil, e sai dali
}

const appDe = (env, app) => app ?? criarApp({ dir: env.CLAUDE_APP_DIR || undefined });
const ocupado = () => ({ ok: false, codigo: 'ocupado' });

/** Uma leitura por vez: quem chega com outra em curso recebe `ocupado`. */
function exclusivo(fn) {
  if (E.curso) return Promise.resolve(ocupado());
  let p;
  p = (async () => { try { return await fn(); } finally { if (E.curso === p) E.curso = null; } })(); // só solta a trava que é dela
  E.curso = p;
  return p;
}

/** As contas com login para ler: a ativa e as salvas. Lança se o app ilegível. */
const contasParaLer = (env, app) => criarTroca({ env, app }).estado().contas.filter((c) => c.ativa || c.salva);

/** Esquece a chave: zera os bytes e volta ao estado `sem`, para o botão reaparecer. */
function descartarChave() {
  E.bytes?.fill(0);
  E.bytes = null; E.chave = 'sem'; E.chaveMotivo = null; E.chaveDesde = null;
}

/** Relê as contas e grava o cache. `null` se a chave não abriu o login de NENHUMA conta lida (a chave é descartada e o cache fica como estava). */
async function relerTodas({ env, app, contas, fetch, agora }) {
  E.ultimaTentativa = agora();
  const antes = lerCacheDeUso(env);
  const depois = {};
  let tentadas = 0;
  let ruins = 0;
  E.lendoUso = true;
  try {
    for (const c of contas) {
      const velho = antes[c.uuid] ?? SEM_USO;
      if ((E.retryAte.get(c.uuid) ?? 0) > agora()) { depois[c.uuid] = { ...velho, erro: 'limite' }; continue; }
      const r = await lerDaConta(c, { app, env, chave: E.bytes, fetch, agora, querEmail: !velho.email });
      tentadas++;
      if (r.chaveRuim) ruins++;
      const email = r.email ?? velho.email;
      depois[c.uuid] = r.uso ? { ...r.uso, email } : { ...velho, erro: r.erro, email }; // o erro não apaga o último uso bom
    }
  } finally { E.lendoUso = false; }
  if (tentadas > 0 && ruins === tentadas) { descartarChave(); return null; }
  try { escreverAtomico(arquivoDoCache(env), JSON.stringify(depois, null, 2)); } catch { /* o uso segue na resposta, só não fica para depois */ }
  return depois;
}

/** Relê todas as contas com a chave que já está na memória. Sem chave: `{ ok: false, codigo: 'sem' }`. */
export function lerUso({ env = process.env, app, fetch = globalThis.fetch, agora = Date.now } = {}) {
  return exclusivo(async () => {
    if (E.chave !== 'pronta' || !E.bytes) return { ok: false, codigo: 'sem' };
    try {
      const uso = await relerTodas({ env, app: appDe(env, app), contas: contasParaLer(env, appDe(env, app)), fetch, agora });
      return uso ? { ok: true, chave: 'pronta', uso } : { ok: false, codigo: 'sem' };
    } catch { return { ok: false, codigo: 'outro' }; }
  });
}

/**
 * O gesto "Mostrar uso": lê a chave do Keychain se ainda não está na memória (o aviso do macOS pode levar até 60 s) e relê
 * todas as contas. `{ ok: true, chave: 'pronta', uso }`, ou `{ ok: false, codigo }` com `negada`, `ocupado`, `sem` (a chave não abriu nenhum login e foi descartada) ou `outro`.
 */
export function atualizarUso({ env = process.env, app, lerSenha = lerSenhaDoKeychain, fetch = globalThis.fetch, agora = Date.now } = {}) {
  return exclusivo(async () => {
    let contas;
    try { contas = contasParaLer(env, appDe(env, app)); } catch { return { ok: false, codigo: 'outro' }; }
    if (!E.bytes) {
      E.chave = 'lendo'; E.chaveMotivo = null; E.chaveDesde = new Date(agora()).toISOString();
      let senha = null;
      let motivo = 'negou';
      try { senha = await lerSenha(); } catch (e) { senha = null; if (e?.motivo === 'semResposta' || e?.motivo === 'semSecurity') motivo = e.motivo; }
      senha = typeof senha === 'string' ? senha.replace(/\r?\n$/, '') : '';
      if (!senha) { E.chave = 'negada'; E.chaveMotivo = motivo; return { ok: false, codigo: 'negada' }; }
      E.bytes = chaveDe(senha); // a senha sai de escopo aqui; só a chave derivada fica
      E.chave = 'pronta'; E.chaveMotivo = null;
    }
    try {
      const uso = await relerTodas({ env, app: appDe(env, app), contas, fetch, agora });
      return uso ? { ok: true, chave: 'pronta', uso } : { ok: false, codigo: 'sem' }; // `null`: a chave não serve mais e já foi descartada
    } catch { return { ok: false, codigo: 'outro' }; }
  });
}

/**
 * O gesto da rota: começa a leitura (a chave, se falta, e as contas) e responde na hora, sem esperar os até 60 s do aviso
 * do macOS. `{ ok: true, chave, desde }` (`chave`: `lendo` se a senha está sendo pedida, `pronta` se só relê as contas),
 * ou `{ ok: false, codigo }` com `ocupado` ou `outro`. O desfecho (`negada` inclusive) aparece em `estadoDoUso()`.
 */
export function iniciarUso(o = {}) {
  const env = o.env ?? process.env;
  const agora = o.agora ?? Date.now;
  if (E.curso) return ocupado();
  try { contasParaLer(env, appDe(env, o.app)); } catch { return { ok: false, codigo: 'outro' }; }
  const desde = new Date(agora()).toISOString();
  atualizarUso(o).catch(() => {}); // o desfecho fica no estado; ninguém espera
  return { ok: true, chave: E.chave, desde: E.chave === 'lendo' && E.chaveDesde ? E.chaveDesde : desde };
}

/** A marca do "adicionar e voltar" que acabou de guardar uma conta nova (ok, `conta` ≠ `voltarPara`, `fim` de até 2 min atrás), ou null. */
function marcaDoOkNovo(ultima, agora) {
  if (!ultima || ultima.ok !== true || ultima.comando !== 'adicionar') return null;
  if (typeof ultima.voltarPara !== 'string' || typeof ultima.conta !== 'string' || !ultima.conta || ultima.conta === ultima.voltarPara) return null;
  const fim = Date.parse(ultima.fim);
  if (!Number.isFinite(fim) || agora() - fim > OK_RECENTE_MS) return null;
  return `${ultima.pid}|${ultima.fim}`;
}

/**
 * Releitura em segundo plano do `GET /api/contas`: só com a chave pronta, nenhuma leitura em curso e a última tentativa
 * com mais de 5 min. Passando `ultima` (o desfecho que a página lê), um "adicionar e voltar" que acabou de guardar uma conta
 * nova relê na hora, uma vez por desfecho, para a cota dela aparecer sem gesto. Devolve a promessa (para os testes) ou
 * `null` se não começou. Nunca lê a chave do Keychain: sem chave pronta o gesto "Mostrar uso" lê todas as contas.
 */
export function releituraSePreciso({ env = process.env, app, fetch = globalThis.fetch, agora = Date.now, ultima = null } = {}) {
  const marca = marcaDoOkNovo(ultima, agora);
  if (E.chave !== 'pronta') { if (marca) E.okVisto = marca; return null; }
  if (E.curso || E.ultimaTentativa === null) return null; // com leitura em curso o ok fica por ver: a próxima volta da página tenta de novo
  const novo = marca !== null && marca !== E.okVisto;
  if (novo) E.okVisto = marca;
  else if (agora() - E.ultimaTentativa <= VELHICE_MS) return null;
  return lerUso({ env, app, fetch, agora }).catch(() => ({ ok: false, codigo: 'outro' }));
}
