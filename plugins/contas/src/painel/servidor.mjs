// Servidor do painel: `node:http` em 127.0.0.1. Leitura por GET/HEAD; as ações são POST (`acoes.mjs`).
// `GET /api/contas` lê as contas do app do Claude e o uso de cada uma (sem token); `GET /api/sessoes`, as sessões
// recentes da conta em uso. Host tem de ser local: outra página no navegador não fala com o painel.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { tratarAcao } from './acoes.mjs';
import { lerContas } from './contas.mjs';
import { estadoDoUso, releituraSePreciso } from './uso.mjs';
import { lerSessoes } from './sessoes.mjs';
import { criarApp, pastaDeDados } from '../troca/app-do-claude.mjs';
import { haParaImportar, pastaDoKit } from '../troca/importar.mjs';

const ESTATICOS = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/regras.js': ['regras.js', 'text/javascript; charset=utf-8'],
  '/ceu.js': ['ceu.js', 'text/javascript; charset=utf-8'],
  '/ceu-dia.js': ['ceu-dia.js', 'text/javascript; charset=utf-8'],
  '/planeta.js': ['planeta.js', 'text/javascript; charset=utf-8'],
  '/estilo.css': ['estilo.css', 'text/css; charset=utf-8'],
  '/cotas.css': ['cotas.css', 'text/css; charset=utf-8'],
  '/fontes/geist-medium.woff2': ['fontes/geist-medium.woff2', 'font/woff2'],
};
const SEGURANCA = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'",
  'Referrer-Policy': 'no-referrer',
};
const NO_STORE = { 'Cache-Control': 'no-store' };

/**
 * O céu do painel segue o modo ausente do kit (o `ausente.json` que a barra grava, o mesmo que a página de perguntas
 * lê): ligado, a noite; desligado, sem arquivo ou ilegível, o dia.
 */
export async function ceuDoAusente(env) {
  const raiz = env.ICHIKAWA_HOME || join(env.HOME || homedir(), '.claude', 'ichikawa');
  try {
    return JSON.parse(await readFile(join(raiz, 'ausente.json'), 'utf8'))?.ligado === true ? 'noite' : 'dia';
  } catch { return 'dia'; }
}

/** `pasta`: a do plugin (uma por versão no cache), que `/api/saude` diz para quem abre trocar o servidor de outra versão. `contas`: `{ env, app, spawn, cli, kill, comandoDoPid, uso: { fetch, agora, lerSenha } }`, tudo opcional (os testes injetam). */
export function criarServidor({ publico, versao = '0.0.0', pasta = null, contas = {} }) {
  const servidor = createServer(async (req, res) => {
    const enviar = (status, tipo, corpo, extra = {}) => {
      res.writeHead(status, { ...SEGURANCA, 'Content-Type': tipo, ...extra });
      res.end(req.method === 'HEAD' ? undefined : corpo);
    };
    const json = (status, obj, extra) => enviar(status, 'application/json; charset=utf-8', JSON.stringify(obj), extra);
    try {
      const porta = servidor.address()?.port;
      const host = String(req.headers.host ?? '').toLowerCase();
      if (host !== `127.0.0.1:${porta}` && host !== `localhost:${porta}`) return json(403, { erro: 'host não permitido' });
      let caminho = null;
      try { caminho = new URL(req.url, 'http://127.0.0.1').pathname; } catch { /* caminho torto: 404 abaixo */ }
      if (req.method === 'POST' && caminho && await tratarAcao(req, res, { caminho, porta, json, contas })) return;
      if (req.method !== 'GET' && req.method !== 'HEAD') return json(405, { erro: 'só GET e HEAD' }, { Allow: 'GET, HEAD' });
      if (caminho === null) return json(404, { erro: 'não encontrado' });
      const env = contas.env ?? process.env;
      if (Object.hasOwn(ESTATICOS, caminho)) {
        const [arquivo, tipo] = ESTATICOS[caminho];
        let corpo;
        try { corpo = await readFile(join(publico, arquivo)); } catch { return json(404, { erro: 'não encontrado' }); }
        // A tela já sai com o céu certo (sem piscar a noite antes do dia); o app.js confere depois por /api/ceu.
        if (caminho === '/') return enviar(200, tipo, corpo.toString('utf8').replace('<html lang="pt-BR">', `<html lang="pt-BR" data-ceu="${await ceuDoAusente(env)}">`), NO_STORE);
        return enviar(200, tipo, corpo, { 'Cache-Control': 'no-cache' });
      }
      if (caminho === '/api/saude') return json(200, { painel: 'contas', versao, pasta, pid: process.pid }, NO_STORE);
      if (caminho === '/api/ceu') return json(200, { ceu: await ceuDoAusente(env) }, NO_STORE);
      if (caminho === '/api/contas') {
        if (req.method === 'HEAD') return json(200, {}, NO_STORE);
        const lido = lerContas({ env, app: contas.app });
        // Em segundo plano: o GET não espera. Com a troca rodando (troca.lock viva) o painel não lê o config do app.
        // `ultima` faz um "adicionar e voltar" recém-concluído reler o uso na hora (a cota da conta nova, sem gesto).
        if (!lido.andamento && releituraSePreciso({ env, app: contas.app, ultima: lido.ultima, ...(contas.uso?.fetch && { fetch: contas.uso.fetch }), ...(contas.uso?.agora && { agora: contas.uso.agora }) })) Object.assign(lido, estadoDoUso()); // a resposta já diz que está lendo
        lido.importavel = haParaImportar({ origem: pastaDoKit(env), destino: pastaDeDados(env) }); // logins do kit que dá para trazer
        return json(200, lido, NO_STORE);
      }
      if (caminho === '/api/sessoes') {
        if (req.method === 'HEAD') return json(200, {}, NO_STORE);
        const lido = lerContas({ env, app: contas.app });
        if (lido.andamento || !lido.ativa) return json(200, { conta: lido.ativa || null, trocando: Boolean(lido.andamento), sessoes: [], respondendo: 0, vaoContinuar: 0 }, NO_STORE);
        const app = contas.app ?? criarApp({ dir: env.CLAUDE_APP_DIR || undefined });
        return json(200, { conta: lido.ativa, trocando: false, ...lerSessoes({ raiz: app.sessoesDir(), conta: lido.ativa, env }) }, NO_STORE);
      }
      return json(404, { erro: 'não encontrado' });
    } catch (e) {
      if (!res.headersSent) json(500, { erro: String(e?.message ?? e).split('\n')[0] });
      else res.end();
    }
  });
  return servidor;
}
