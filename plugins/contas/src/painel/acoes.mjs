// As rotas que agem no painel: trocar, adicionar, sincronizar, cancelar, nomear, ler o uso das contas e gravar o tema.
// Toda ação é POST com a mesma guarda: cabeçalho próprio, `Host` e `Origin` do próprio painel, corpo JSON de até 16 KB.
// Falhou a guarda: 403 e nada se grava.
import { lancar, nomear as nomearConta, cancelarAdicionar } from './contas.mjs';
import { iniciarUso } from './uso.mjs';
import { TEMAS, gravarTema } from './tema.mjs';

export const CABECALHO = 'x-painel-de-contas';
export const LIMITE_DO_CORPO = 16 * 1024;
const NO_STORE = { 'Cache-Control': 'no-store' };

const MOTIVO = {
  invalida: 'o pedido veio incompleto ou em outro formato',
  outro: 'não consegui fazer isso agora',
  jaAtiva: 'essa já é a conta ativa',
  semLogin: 'essa conta não tem login salvo; entre com ela de novo',
  semAtiva: 'o app do Claude está sem conta aberta',
  sumiu: 'essa conta não está mais na lista',
  repetido: 'Esse nome já é de outra conta.',
};
const MOTIVO_CONTAS_OCUPADO = 'outra troca de conta está em andamento';
const MOTIVO_USO_OCUPADO = 'já há uma leitura de uso em andamento';
const STATUS = { ocupado: 409, jaAtiva: 409, semLogin: 409, semAtiva: 409, repetido: 409, fase: 409, semEspera: 409, sumiu: 404, invalida: 400, outro: 500 };
const recusa = (codigo, motivo = MOTIVO[codigo]) => ({ ok: false, codigo, motivo });

/** A guarda do POST: devolve `null` se passou, ou a razão da recusa. `porta` é a que o servidor ouviu de fato. */
export function guardaDoPost(req, porta) {
  if (req.method !== 'POST') return 'método';
  if (req.headers[CABECALHO] !== '1') return 'cabeçalho';
  const host = String(req.headers.host ?? '').toLowerCase();
  if (host !== `127.0.0.1:${porta}` && host !== `localhost:${porta}`) return 'host';
  const origem = req.headers.origin;
  if (origem !== undefined && origem !== `http://127.0.0.1:${porta}` && origem !== `http://localhost:${porta}`) return 'origem';
  return null;
}

/** Lê o corpo até o limite. Devolve `{ texto }` ou `{ grande: true }`. */
function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    if (Number(req.headers['content-length']) > LIMITE_DO_CORPO) { resolve({ grande: true }); return; }
    const partes = [];
    let total = 0;
    req.on('data', (d) => {
      total += d.length;
      if (total > LIMITE_DO_CORPO) { partes.length = 0; resolve({ grande: true }); req.removeAllListeners('data'); req.resume(); return; }
      partes.push(d);
    });
    req.on('end', () => resolve({ texto: Buffer.concat(partes).toString('utf8') }));
    req.on('error', reject);
  });
}

const recusaDeConta = (r) => recusa(r.codigo, r.codigo === 'ocupado' ? MOTIVO_CONTAS_OCUPADO : MOTIVO[r.codigo] ?? r.motivo ?? MOTIVO.outro);
const semUndefined = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const dosContas = (ctx) => semUndefined({ env: ctx.contas?.env ?? process.env, app: ctx.contas?.app, spawn: ctx.contas?.spawn, cli: ctx.contas?.cli, kill: ctx.contas?.kill, comandoDoPid: ctx.contas?.comandoDoPid });
const paraLancar = ({ env, app, spawn, cli }) => semUndefined({ env, app, spawn, cli });
const comoResposta = (r) => (r.ok ? r : recusaDeConta(r));

export const TRATADORES = {
  '/api/contas/trocar': (corpo, ctx) => comoResposta(lancar({ comando: 'trocar', conta: corpo.conta, ...paraLancar(dosContas(ctx)) })),
  // O painel só usa o fluxo que volta para a conta de antes: o app nunca fica na tela de entrada sem ninguém olhando.
  '/api/contas/adicionar': (corpo, ctx) => comoResposta(lancar({ comando: 'adicionar', voltar: true, ...paraLancar(dosContas(ctx)) })),
  '/api/contas/sincronizar': (corpo, ctx) => comoResposta(lancar({ comando: 'sincronizar', ...paraLancar(dosContas(ctx)) })),
  '/api/contas/cancelar': (corpo, ctx) => {
    const { env, kill, comandoDoPid } = dosContas(ctx);
    return comoResposta(cancelarAdicionar(semUndefined({ env, kill, comandoDoPid })));
  },
  '/api/contas/nomear': (corpo, ctx) => {
    const { env, app } = dosContas(ctx);
    return comoResposta(nomearConta(semUndefined({ conta: corpo.conta, nome: corpo.nome, env, app })));
  },
  // Começa a leitura da chave (se falta) e do uso de todas as contas e responde na hora; o desfecho vem no GET.
  '/api/contas/uso': (corpo, ctx) => {
    const { env, app } = dosContas(ctx);
    const u = ctx.contas?.uso ?? {};
    const r = iniciarUso(semUndefined({ env, app, lerSenha: u.lerSenha, fetch: u.fetch, agora: u.agora }));
    if (r.ok) return r;
    return r.codigo === 'ocupado' ? recusa('ocupado', MOTIVO_USO_OCUPADO) : recusa('outro');
  },
  // O botão de tema: grava `claro` ou `escuro` no `tema.json` do kit (o mesmo da barra e do Painel).
  '/api/tema': async (corpo, ctx) => {
    if (!TEMAS.includes(corpo.tema)) return recusa('invalida');
    return { ok: true, tema: await gravarTema(dosContas(ctx).env, corpo.tema) };
  },
};

/**
 * Trata o POST de uma das rotas daqui e devolve `true`; o que não é POST ou não é rota daqui devolve `false`
 * (o servidor responde o 405 de sempre). `ctx`: `{ caminho, porta, json, contas? }`.
 */
export async function tratarAcao(req, res, ctx) {
  if (req.method !== 'POST' || !Object.hasOwn(TRATADORES, ctx.caminho)) return false;
  const { json } = ctx;
  if (guardaDoPost(req, ctx.porta) !== null) { json(403, { ok: false, erro: 'pedido não permitido' }, NO_STORE); req.resume(); return true; }
  const lido = await lerCorpo(req);
  if (lido.grande) { json(413, { ok: false, erro: 'corpo grande demais' }, { ...NO_STORE, Connection: 'close' }); return true; }
  let corpo;
  try { corpo = JSON.parse(lido.texto); } catch { json(400, { ok: false, erro: 'corpo não é JSON' }, NO_STORE); return true; }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) { json(400, { ok: false, erro: 'corpo não é um objeto JSON' }, NO_STORE); return true; }
  let r;
  try { r = await TRATADORES[ctx.caminho](corpo, ctx); } catch { r = recusa('outro'); }
  json(r.ok ? (ctx.caminho === '/api/contas/nomear' ? 200 : 202) : (STATUS[r.codigo] ?? 500), r, NO_STORE);
  return true;
}
