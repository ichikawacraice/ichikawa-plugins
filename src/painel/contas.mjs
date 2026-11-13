// As contas do app do Claude no painel: o que a tela lê (`lerContas`) e as três ações (`lancar` trocar e
// adicionar, `nomear`). Quem troca é o CLI `trocar-conta`, num processo solto: a troca fecha e reabre o app, e o app
// pode ser quem abriu esta página. O CLI deixa o desfecho em `ultima-acao.json`, que a página lê. Nada aqui lê token.
import { chmodSync, closeSync, openSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawn as spawnReal } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { criarApp, criarPasta, pastaDeDados } from '../troca/app-do-claude.mjs';
import { criarTroca } from '../troca/troca.mjs';
import { faltamPeloNome, lerResiduo } from '../troca/conversas.mjs';
import { emailsDasContas, estadoDoUso, usoParaATela } from './uso.mjs';

export const CLI_DA_TROCA = fileURLToPath(new URL('../troca/cli.mjs', import.meta.url));
const COMANDOS = new Set(['trocar', 'adicionar', 'sincronizar', 'importar', 'desfazer-importacao', 'nomear']);
const CONTROLE = /[\u0000-\u001f\u007f]/;
const CODIGOS = new Set(['formato', 'abriuNao', 'semLogin', 'repetido', 'semAtiva', 'prazo', 'cancelado', 'naoGuardou', 'outro']);
const FASES_DO_ADICIONAR = new Set(['fechando', 'esperando', 'voltando']);
const MOTIVOS_DA_VOLTA = new Set(['entrou', 'cancelado', 'prazo']);

// O último filho lançado por este processo (pid, desde, comando, conta): vale enquanto o pid estiver vivo. A trava só
// guarda o pid, então o comando e a conta vêm daqui; uma troca feita pelo terminal tem os dois nulos.
let filho = null;

const appDe = (env, app) => app ?? criarApp({ dir: env.CLAUDE_APP_DIR || undefined });

function vivo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

const ehIso = (v) => typeof v === 'string' && Number.isFinite(Date.parse(v));

/**
 * O `adicionar.json` do "adicionar e voltar" (sem segredo), ou null se não existe ou não tem a forma esperada. Além do pid,
 * da fase e da conta de antes: `faseDesde` (quando a fase começou), `prazoEm` (null até a espera começar), `motivo` (só no
 * `voltando`) e `abriuSozinho: false` (o app não abriu sozinho no 1º fechamento).
 */
function lerAdicionar(env) {
  try {
    const a = JSON.parse(readFileSync(join(pastaDeDados(env), 'adicionar.json'), 'utf8'));
    if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
    if (!Number.isInteger(a.pid) || !FASES_DO_ADICIONAR.has(a.fase) || typeof a.voltarPara !== 'string' || !ehIso(a.faseDesde)) return null;
    if (!(a.prazoEm === null || ehIso(a.prazoEm))) return null;
    const r = { pid: a.pid, fase: a.fase, voltarPara: a.voltarPara, faseDesde: a.faseDesde, prazoEm: a.prazoEm };
    if (a.fase === 'voltando' && MOTIVOS_DA_VOLTA.has(a.motivo)) r.motivo = a.motivo;
    if (a.abriuSozinho === false) r.abriuSozinho = false;
    return r;
  } catch { return null; }
}

const pidDaTrava = (env) => { try { return Number.parseInt(readFileSync(join(pastaDeDados(env), 'troca.lock'), 'utf8'), 10); } catch { return NaN; } };

function lerAndamento(env) {
  const trava = join(pastaDeDados(env), 'troca.lock');
  try {
    const pid = Number.parseInt(readFileSync(trava, 'utf8'), 10);
    if (vivo(pid)) {
      const meu = filho && filho.pid === pid ? filho : null;
      const ad = lerAdicionar(env); // só vale quando é do mesmo processo que prende a trava
      const { pid: _pid, ...espera } = ad && ad.pid === pid ? ad : {};
      // Com o `adicionar.json` válido o comando é conhecido, mesmo que o filho não seja desta instância do servidor (outra aba, F5, servidor reiniciado).
      return { pid, desde: new Date(statSync(trava).mtimeMs).toISOString(), comando: ad && ad.pid === pid ? 'adicionar' : meu?.comando ?? null, conta: meu?.conta ?? null, ...espera };
    }
  } catch { /* sem trava */ }
  if (filho && vivo(filho.pid)) return { pid: filho.pid, desde: filho.desde, comando: filho.comando, conta: filho.conta };
  return null;
}

function lerUltima(env) {
  try {
    const u = JSON.parse(readFileSync(join(pastaDeDados(env), 'ultima-acao.json'), 'utf8'));
    if (!u || typeof u !== 'object' || Array.isArray(u)) return null;
    if (!COMANDOS.has(u.comando) || !(u.conta === null || typeof u.conta === 'string') || typeof u.ok !== 'boolean') return null;
    if (typeof u.mensagem !== 'string' || !ehIso(u.inicio) || !ehIso(u.fim) || !Number.isInteger(u.pid)) return null;
    const codigo = typeof u.codigo === 'string' && CODIGOS.has(u.codigo) ? u.codigo : null;
    const saida = { comando: u.comando, conta: u.conta, voltarPara: typeof u.voltarPara === 'string' ? u.voltarPara : null, ok: u.ok, codigo, mensagem: u.mensagem, inicio: u.inicio, fim: u.fim, pid: u.pid };
    if (Number.isInteger(u.entraram) && u.entraram >= 0) saida.entraram = u.entraram; // o `sincronizar`: quantas conversas entraram na lista da conta
    if (Number.isInteger(u.removidas) && u.removidas >= 0) saida.removidas = u.removidas; // o `sincronizar`: quantas conversas apagadas em outra conta saíram da lista
    return saida;
  } catch { return null; }
}

const curto = (e) => (e?.code === 'ENOENT' ? 'o config.json do app do Claude não foi encontrado' : String(e?.message ?? e).split('\n')[0].slice(0, 200));

// A causa de uma leitura que falhou, para a tela escolher a frase (ela nunca mostra a mensagem crua).
const codigoDoErro = (e) => (e?.code === 'ENOENT' ? 'semConfig' : e?.codigo === 'formato' ? 'formato' : 'outro');

/**
 * O que falta na lista de conversas da conta em uso: `{ faltam, residuo }` (só pelo nome dos arquivos; o resíduo é o que o último
 * `sincronizar` ou troca deixou de fora de propósito). Nula sem conta ativa, com troca em andamento (a conta muda) ou se a leitura falha.
 */
function lerLista({ env, app, ativa, andamento }) {
  if (!ativa || andamento) return null;
  try {
    const { faltam } = faltamPeloNome(app.sessoesDir(), ativa);
    return { faltam, residuo: lerResiduo(pastaDeDados(env), ativa) };
  } catch { return null; }
}

/** `{ ativa, contas, andamento, ultima, lista, chave, chaveDesde, chaveMotivo, lendoUso, uso, emails }` (`lista`: `{ faltam, residuo }` da conta ativa ou null; `chave`: sem, lendo, pronta ou negada; `uso`: o cache por uuid, sem token; `emails`: o e-mail que se sabe de cada uuid); erro ao ler o app vira `erro` e `erroCodigo` (`semConfig`, `formato` ou `outro`) com `contas: []`. */
export function lerContas({ env = process.env, app } = {}) {
  const base = { andamento: lerAndamento(env), ultima: lerUltima(env), ...estadoDoUso(), uso: usoParaATela(env), emails: emailsDasContas(env) };
  try {
    const doApp = appDe(env, app);
    const { ativa, contas } = criarTroca({ env, app: doApp }).estado();
    return { ativa, contas, lista: lerLista({ env, app: doApp, ativa, andamento: base.andamento }), ...base };
  } catch (e) {
    return { ativa: '', contas: [], lista: null, ...base, erro: curto(e), erroCodigo: codigoDoErro(e) };
  }
}

/** Só para os testes: esquece o filho lançado (o pid fica no módulo). */
export function esquecerFilho() { filho = null; }

const recusa = (codigo) => ({ ok: false, codigo });

/** Valida e lança o CLI solto (sem shell). `conta` só vale para `trocar`: exatamente um uuid listado. `sincronizar` não recebe conta: vale para a ativa. `voltar: true` só vale para `adicionar` (`adicionar --voltar`). */
export function lancar({ comando, conta, voltar = false, env = process.env, app, cli = CLI_DA_TROCA, spawn = spawnReal } = {}) {
  if (comando !== 'trocar' && comando !== 'adicionar' && comando !== 'sincronizar') return recusa('invalida');
  if (comando === 'trocar' && typeof conta !== 'string') return recusa('invalida');
  const andamento = lerAndamento(env);
  if (andamento) return recusa('ocupado'); // antes do `semAtiva`: no meio de uma troca o app pode estar sem conta
  let ativa = '';
  if (comando === 'sincronizar') {
    try { ativa = criarTroca({ env, app: appDe(env, app) }).estado().ativa; } catch { return recusa('outro'); }
    if (!ativa) return recusa('semAtiva');
  }
  if (comando === 'trocar') {
    let contas;
    try { contas = criarTroca({ env, app: appDe(env, app) }).estado().contas; } catch { return recusa('outro'); }
    const c = contas.find((x) => x.uuid === conta);
    if (!c) return recusa('sumiu');
    if (!c.salva) return recusa('semLogin');
    if (c.ativa) return recusa('jaAtiva');
  }
  const dados = pastaDeDados(env);
  criarPasta(dados);
  const log = join(dados, 'pagina-troca.log');
  const fd = openSync(log, 'a', 0o600);
  try {
    chmodSync(log, 0o600);
    const filha = spawn(process.execPath, comando === 'trocar' ? [cli, conta] : comando === 'sincronizar' ? [cli, 'sincronizar'] : voltar === true ? [cli, 'adicionar', '--voltar'] : [cli, 'adicionar'], { detached: true, stdio: ['ignore', fd, fd], env });
    const desde = new Date().toISOString();
    const quem = { comando, conta: comando === 'trocar' ? conta : comando === 'sincronizar' ? ativa : null };
    filho = { pid: filha.pid, desde, ...quem };
    filha.on?.('exit', () => { if (filho?.pid === filha.pid) filho = null; });
    filha.on?.('error', () => { if (filho?.pid === filha.pid) filho = null; });
    filha.unref?.();
    return { ok: true, andamento: { pid: filha.pid, desde, ...quem } };
  } finally { closeSync(fd); }
}

/** Dá nome à conta (uuid listado). Nome aparado, de 1 a 60 caracteres, sem caractere de controle. */
export function nomear({ conta, nome, env = process.env, app } = {}) {
  if (typeof conta !== 'string' || typeof nome !== 'string') return recusa('invalida');
  const limpo = nome.trim();
  if (limpo.length < 1 || limpo.length > 60 || CONTROLE.test(limpo)) return recusa('invalida');
  if (lerAndamento(env)) return recusa('ocupado'); // a troca regrava o estado.json e perderia o nome
  try {
    const troca = criarTroca({ env, app: appDe(env, app) });
    if (!troca.estado().contas.some((c) => c.uuid === conta)) return recusa('sumiu');
    const r = troca.nomear(conta, limpo);
    return { ok: true, uuid: r.uuid, nome: r.nome };
  } catch (e) { return recusa(e?.codigo === 'repetido' ? 'repetido' : 'outro'); }
}

/** O comando de um processo (`ps -o command= -p <pid>`); vazio se não der para ler. */
function comandoDoPidReal(pid) {
  try { return execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8', timeout: 5000, killSignal: 'SIGKILL' }).trim(); } catch { return ''; }
}

const recusaComMotivo = (codigo, motivo) => ({ ok: false, codigo, motivo });

/**
 * Cancela o "adicionar e voltar" que espera a entrada: manda SIGTERM ao processo, que volta para a conta de antes sozinho.
 * Só manda se o `adicionar.json` existe, o pid dele é o da `troca.lock`, o processo está vivo, a fase é `esperando` e o comando
 * dele é o CLI da troca; fora disso recusa (`fase` se já é outra fase, `semEspera` nos demais) e não mata nada. `kill` e `comandoDoPid` entram nos testes.
 */
export function cancelarAdicionar({ env = process.env, kill = (pid, sinal) => process.kill(pid, sinal), comandoDoPid = comandoDoPidReal } = {}) {
  const ad = lerAdicionar(env);
  if (!ad) return recusaComMotivo('semEspera', 'não há uma conta esperando a entrada agora');
  if (pidDaTrava(env) !== ad.pid) return recusaComMotivo('semEspera', 'o processo que espera a entrada não é o que está com a troca; nada foi cancelado');
  if (!vivo(ad.pid)) return recusaComMotivo('semEspera', 'o processo que esperava a entrada já terminou');
  if (ad.fase !== 'esperando') return recusaComMotivo('fase', 'a espera já acabou; o app está voltando para a conta de antes');
  if (!String(comandoDoPid(ad.pid) ?? '').includes('src/troca/cli.mjs')) return recusaComMotivo('semEspera', 'o processo que espera a entrada não é o da troca de conta; nada foi cancelado');
  try { kill(ad.pid, 'SIGTERM'); } catch (e) { return e?.code === 'ESRCH' ? recusaComMotivo('semEspera', 'o processo que esperava a entrada já terminou') : recusa('outro'); }
  return { ok: true };
}
