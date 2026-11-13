// A página local: perguntas abertas, itens em andamento e o que já foi entregue.
// Só lê os arquivos de estado (e, uma vez por dia, move para arquivo/ a entrega que já saiu dela); grava a resposta dada aqui e os pedidos que o mod da barra executa
// (abrir a sessão, entregar a resposta). Nenhuma batida, nenhum laço em segundo plano.
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as estado from './estado.mjs';

export const PORTA_PADRAO = 4747;
const HOST = '127.0.0.1';
const LIMITE_DO_CORPO = 64 * 1024;
const PRAZO_PARA_SUBIR_MS = 3_000;
const INTERVALO_DE_CONFERENCIA_MS = 150;
const DIA_MS = 24 * 60 * 60 * 1000;
const ENTREGAS_A_MOSTRAR = 10;
const RESPOSTA_PADRAO = 'Sim, siga a recomendação.';
const SESSAO_DO_APP = /^local_[0-9a-f-]{36}$/;
const PUBLICO = fileURLToPath(new URL('./publico/', import.meta.url));
const ARQUIVOS = { '/estilo.css': 'text/css', '/perguntas.css': 'text/css', '/ceu.js': 'text/javascript', '/planeta.js': 'text/javascript' };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const horaSP = (iso) => {
  try {
    return new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  } catch { return ''; }
};

/** O número do id (`F12` → 12, `Q3` → 3); id sem número vai para o fim. */
const numero = (id) => {
  const m = /(\d+)$/.exec(String(id ?? ''));
  return m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
};

const ehSessaoDoApp = (v) => typeof v === 'string' && SESSAO_DO_APP.test(v);

function campos(pares) {
  const linhas = pares.filter(([, v]) => v).map(([r, v]) => `<dt>${esc(r)}</dt><dd>${v}</dd>`).join('');
  return linhas ? `<dl class="campos">${linhas}</dl>` : '';
}

const cabecaDoProjeto = (projeto) => `<p class="cartao-projeto">${esc(projeto)}</p>`;
const idLido = (projeto, id) => esc(estado.rotulo(projeto, id));

function cartaoDePergunta(projeto, p) {
  const oculto = `<input type="hidden" name="projeto" value="${esc(projeto)}"><input type="hidden" name="id" value="${esc(p.id)}">`;
  const abrir = ehSessaoDoApp(p.sessao) ? `<button type="submit" formaction="/abrir">Abrir sessão</button>` : '';
  return `<li>${cabecaDoProjeto(projeto)}<div class="cartao-cab"><span class="id">${idLido(projeto, p.id)}</span><span class="cartao-titulo">${esc(p.titulo)}</span>${p.item ? `<span class="projeto">${idLido(projeto, p.item)}</span>` : ''}</div>
${campos([['O caso', esc(p.caso)], ['Se ninguém decidir', esc(p.seNaoDecidir)], ['Recomendação', esc(p.recomendacao)]])}
<form class="responder" method="post" action="/responder">${oculto}
<textarea name="resposta" rows="2" required aria-label="Resposta para ${esc(p.id)}" placeholder="Escreva a resposta, ou aceite a recomendação"></textarea>
<button type="submit" name="acao" value="aceitar" formnovalidate class="primario" title="Grava “${esc(RESPOSTA_PADRAO)}”">Aceitar recomendação</button>
<button type="submit" name="acao" value="enviar">Enviar resposta</button>${abrir}</form>
<p class="quando">${esc(horaSP(p.criadoEm))}${p.item ? ` · no app, a sessão é a <b>${idLido(projeto, p.item)} · …</b> na barra lateral` : ''}</p></li>`;
}

/** A entrega abre e fecha: o resumo é a primeira linha; o resto aparece ao abrir. */
function cartaoDeEntrega(projeto, i) {
  const e = i.entrega;
  const proximos = Array.isArray(e.proximos) && e.proximos.length
    ? `<ul class="proximos">${e.proximos.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  return `<li><details class="entrega" id="entrega-${esc(projeto)}-${esc(i.id)}"><summary>${cabecaDoProjeto(projeto)}<div class="cartao-cab"><span class="id">${idLido(projeto, i.id)}</span><span class="cartao-titulo">${esc(i.titulo)}</span><span class="selo selo-${esc(e.desfecho)}">${esc(e.desfecho)}</span></div></summary>
${campos([['O que mudou', esc(e.resultado)], ['Medido', esc(e.medido)], ['Sem medir', esc(e.naoMedido)], ['Próximos', proximos], ['PR', i.pr ? `#${esc(i.pr)}` : '']])}
<p class="quando">${esc(horaSP(e.em ?? i.atualizadoEm))}</p></details></li>`;
}

// Em andamento já vem separado por projeto: o cartão não repete o nome.
const cartaoDeItem = (projeto, i) => `<li><div class="cartao-cab"><span class="id">${idLido(projeto, i.id)}</span><span class="cartao-titulo">${esc(i.titulo)}</span><span class="selo selo-etapa">${esc(i.etapa)}</span></div><p class="quando">${i.pr ? `PR #${esc(i.pr)} · ` : ''}${esc(horaSP(i.atualizadoEm))}</p></li>`;

/** Em andamento, um grupo por projeto (em ordem alfabética), cada um com os itens em ordem de F. */
function grupos(andamento) {
  const porProjeto = new Map();
  for (const { projeto, i } of andamento) porProjeto.set(projeto, [...(porProjeto.get(projeto) ?? []), i]);
  return [...porProjeto.keys()].sort((a, b) => a.localeCompare(b)).map((projeto) => `<li class="grupo-de-projeto"><h3 class="grupo">${esc(projeto)}</h3>
<ul class="cartoes">${porProjeto.get(projeto).map((i) => cartaoDeItem(projeto, i)).join('\n')}</ul></li>`);
}

const quandoEntregou = (i) => Date.parse(i.entrega.em ?? i.atualizadoEm);

/**
 * O que a página mostra, já ordenado: perguntas abertas, itens vivos e entregas recentes de todos os projetos.
 * `entregas` são as `ENTREGAS_A_MOSTRAR` mais recentes; `maisEntregas`, as outras do período (atrás de "Ver mais").
 */
export function dados(agora = Date.now()) {
  const perguntas = [];
  const andamento = [];
  const recentes = [];
  for (const projeto of estado.projetos()) {
    for (const p of estado.listar('perguntas', projeto)) if (p.estado === 'aberta') perguntas.push({ projeto, p });
    for (const i of estado.listar('itens', projeto)) {
      if (i.entrega && agora - quandoEntregou(i) <= estado.DIAS_DE_ENTREGAS * DIA_MS) recentes.push({ projeto, i });
      else if (!estado.etapaFinal(i.etapa)) andamento.push({ projeto, i });
    }
  }
  // Perguntas: da mais antiga para a mais nova. Itens: em ordem de F (F1, F2, …), empate pelo projeto.
  const antiga = (a, b) => (a.p.criadoEm ?? '').localeCompare(b.p.criadoEm ?? '') || numero(a.p.id) - numero(b.p.id) || a.projeto.localeCompare(b.projeto);
  const emOrdemDeF = (a, b) => numero(a.i.id) - numero(b.i.id) || a.projeto.localeCompare(b.projeto);
  perguntas.sort(antiga);
  andamento.sort(emOrdemDeF);
  // Entregas: da mais recente para a mais antiga (pela data da entrega), nos 10 primeiros e no "Ver mais".
  recentes.sort((a, b) => quandoEntregou(b.i) - quandoEntregou(a.i));
  const entregas = recentes.slice(0, ENTREGAS_A_MOSTRAR);
  const maisEntregas = recentes.slice(ENTREGAS_A_MOSTRAR);
  return { perguntas, andamento, entregas, maisEntregas };
}

function secao(id, titulo, contagem, itens, vazio, depois = '') {
  return `<section class="secao" aria-labelledby="${id}"><div class="secao-cab"><h2 id="${id}">${titulo}</h2><span class="lido">${contagem}</span></div>
<ul class="cartoes">${itens.join('\n') || `<li class="vazio">${vazio}</li>`}</ul>${depois}</section>`;
}

const verMais = (resto) => (resto.length
  ? `<details class="ver-mais"><summary>Ver mais (${resto.length})</summary><ul class="cartoes">${resto.map(({ projeto, i }) => cartaoDeEntrega(projeto, i)).join('\n')}</ul></details>`
  : '');

export function html(agora = Date.now()) {
  const { perguntas, andamento, entregas, maisEntregas } = dados(agora);
  const esquerda = secao('h-perguntas', 'Perguntas', perguntas.length || '', perguntas.map(({ projeto, p }) => cartaoDePergunta(projeto, p)), 'Nada esperando por você.')
    + (andamento.length ? secao('h-andamento', 'Em andamento', andamento.length, grupos(andamento), '') : '');
  const direita = secao('h-entregas', 'Entregues', `últimos ${estado.DIAS_DE_ENTREGAS} dias`, entregas.map(({ projeto, i }) => cartaoDeEntrega(projeto, i)), 'Nenhuma entrega ainda.', verMais(maisEntregas));
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Perguntas do kit</title><link rel="stylesheet" href="/estilo.css"><link rel="stylesheet" href="/perguntas.css"></head>
<body><canvas id="ceu" class="ceu" aria-hidden="true"></canvas><header class="topo"><h1>Perguntas do kit</h1></header>
<main><div>${esquerda}</div><div>${direita}</div></main>
<footer class="pe"><p>Lido às ${esc(horaSP(new Date(agora).toISOString()))}. A página se atualiza sozinha enquanto você não está escrevendo.</p></footer>
<script type="module">
import { iniciarCeu } from '/ceu.js';
const escrevendo = () => [...document.querySelectorAll('textarea')].some((t) => t.value.trim() || t === document.activeElement);
// O recarregamento fecharia os cartões abertos: guarda quais estavam abertos e reabre.
const ABERTOS = 'entregas-abertas';
const lerAbertos = () => { try { return JSON.parse(sessionStorage.getItem(ABERTOS) ?? '[]'); } catch { return []; } };
for (const id of lerAbertos()) { const d = document.getElementById(id); if (d) { d.open = true; d.closest('.ver-mais')?.setAttribute('open', ''); } }
document.addEventListener('toggle', () => {
  const abertos = [...document.querySelectorAll('details.entrega[open]')].map((d) => d.id);
  try { sessionStorage.setItem(ABERTOS, JSON.stringify(abertos)); } catch { /* sem armazenamento: só não lembra */ }
}, true);
setInterval(() => { if (!document.hidden && !escrevendo()) location.reload(); }, 30000);
// O céu é enfeite: se ele falhar (canvas de tamanho 0), o resto da página segue.
try { iniciarCeu(document.getElementById('ceu')); } catch { /* sem céu */ }
</script></body></html>`;
}

function lerCorpo(req) {
  return new Promise((ok, falha) => {
    let dadosDoCorpo = '';
    req.on('data', (c) => {
      dadosDoCorpo += c;
      if (dadosDoCorpo.length > LIMITE_DO_CORPO) { falha(new Error('corpo grande demais')); req.destroy(); }
    });
    req.on('end', () => ok(dadosDoCorpo));
    req.on('error', falha);
  });
}

/** Só aceita POST vindo da própria página: outro site aberto no navegador não age por você. */
const origemLocal = (req, porta) => {
  const origem = req.headers.origin;
  return origem === `http://${HOST}:${porta}` || origem === `http://localhost:${porta}`;
};

/** O pedido que o mod da barra executa (docs/contratos.md, `pedidos/`). */
export function gravarPedido(tipo, sessao, texto = null) {
  const pasta = join(estado.raiz(), 'pedidos');
  mkdirSync(pasta, { recursive: true });
  const pedido = { tipo, sessao, texto, criadoEm: new Date().toISOString() };
  writeFileSync(join(pasta, `${randomUUID()}.json`), `${JSON.stringify(pedido, null, 2)}\n`, { flag: 'wx' });
  return pedido;
}

async function lerPergunta(req, res, porta) {
  if (!origemLocal(req, porta)) { res.writeHead(403).end('origem recusada'); return null; }
  const f = new URLSearchParams(await lerCorpo(req));
  const projeto = f.get('projeto') ?? '';
  const id = f.get('id') ?? '';
  const p = /^[\w.-]+$/.test(projeto) && /^Q\d+$/i.test(id) ? estado.ler('perguntas', projeto, id) : null;
  if (!p) { res.writeHead(400).end('pergunta não encontrada'); return null; }
  return { f, projeto, p };
}

async function responder(req, res, porta) {
  const lido = await lerPergunta(req, res, porta);
  if (!lido) return;
  const { f, projeto, p } = lido;
  // "Aceitar recomendação" grava a resposta padrão; "Enviar resposta" exige texto (vazio não envia).
  const resposta = f.get('acao') === 'aceitar' ? RESPOSTA_PADRAO : f.get('resposta')?.trim();
  if (!resposta) { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('resposta vazia: escreva a resposta ou use "Aceitar recomendação"'); return; }
  estado.atualizar('perguntas', projeto, p.id, { estado: 'respondida', resposta, respondidaEm: new Date().toISOString(), lida: false });
  if (ehSessaoDoApp(p.sessao)) gravarPedido('responder', p.sessao, `${p.id} (resposta pela página): ${resposta}`);
  res.writeHead(303, { Location: '/' }).end();
}

async function abrir(req, res, porta) {
  const lido = await lerPergunta(req, res, porta);
  if (!lido) return;
  if (!ehSessaoDoApp(lido.p.sessao)) { res.writeHead(400).end('a pergunta não tem sessão do app'); return; }
  gravarPedido('abrir-sessao', lido.p.sessao);
  res.writeHead(303, { Location: '/' }).end();
}

/** Arquiva em todos os projetos o que já saiu da página; devolve os ids lidos (`IZA-F3`). */
export function arquivarTudo(agora = Date.now()) {
  return estado.projetos().flatMap((projeto) => estado.arquivar(projeto, agora).map((id) => estado.rotulo(projeto, id)));
}

export function criarServidor(porta = PORTA_PADRAO) {
  let ultimaLimpeza = -Infinity;
  // A limpeza roda ao abrir a página, no máximo uma vez por dia por processo: sem laço em segundo plano.
  const limparSeDeuODia = () => {
    if (Date.now() - ultimaLimpeza < DIA_MS) return;
    ultimaLimpeza = Date.now();
    try { arquivarTudo(); } catch (err) { process.stderr.write(`pagina: limpeza falhou: ${err.message}\n`); }
  };
  return createServer(async (req, res) => {
    try {
      const caminho = (req.url ?? '/').split('?')[0];
      if (req.method === 'GET' && caminho === '/saude') { res.writeHead(200).end('ok'); return; }
      if (req.method === 'GET' && ARQUIVOS[caminho]) {
        res.writeHead(200, { 'Content-Type': `${ARQUIVOS[caminho]}; charset=utf-8` }).end(readFileSync(join(PUBLICO, caminho.slice(1))));
        return;
      }
      if (req.method === 'GET' && caminho === '/') {
        limparSeDeuODia();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(html());
        return;
      }
      if (req.method === 'POST' && caminho === '/responder') { await responder(req, res, porta); return; }
      if (req.method === 'POST' && caminho === '/abrir') { await abrir(req, res, porta); return; }
      res.writeHead(404).end('não existe');
    } catch (err) {
      process.stderr.write(`pagina: ${err.message}\n`);
      if (!res.headersSent) res.writeHead(500).end('erro ao ler o estado');
    }
  });
}

export function servir(porta = PORTA_PADRAO) {
  return new Promise((ok, falha) => {
    const s = criarServidor(porta);
    s.once('error', falha);
    s.listen(porta, HOST, () => ok(s));
  });
}

async function noAr(porta) {
  try {
    const r = await fetch(`http://${HOST}:${porta}/saude`, { signal: AbortSignal.timeout(500) });
    return r.ok;
  } catch { return false; }
}

/**
 * Sobe a página se não estiver no ar e devolve o endereço. Com `navegador`, abre no navegador do sistema;
 * sem ele (`--subir`, o botão da barra), quem chamou abre no navegador do app.
 */
export async function abrirPagina(porta = PORTA_PADRAO, { navegador = true } = {}) {
  const url = `http://${HOST}:${porta}`;
  if (!(await noAr(porta))) {
    const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
    spawn(process.execPath, [cli, 'pagina', '--porta', String(porta)], { detached: true, stdio: 'ignore' }).unref();
    const ate = Date.now() + PRAZO_PARA_SUBIR_MS;
    while (Date.now() < ate && !(await noAr(porta))) await new Promise((r) => setTimeout(r, INTERVALO_DE_CONFERENCIA_MS));
  }
  if (navegador && process.platform === 'darwin' && !process.env.ICHIKAWA_SEM_NAVEGADOR) {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
  return url;
}
