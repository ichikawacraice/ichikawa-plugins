// A página local: perguntas abertas, sessões ativas e o que já foi entregue.
// Só lê os arquivos de estado (e, uma vez por dia, move para arquivo/ a entrega que já saiu dela); grava a resposta dada aqui e os pedidos que o mod da barra executa
// (abrir a sessão, entregar a resposta). Nenhuma batida, nenhum laço em segundo plano.
import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as estado from './estado.mjs';
import { ROTULO_DO_ESTADO, lerSessoesDoApp, sessoesDaPagina } from './sessoes.mjs';

export const PORTA_PADRAO = 4747;
const HOST = '127.0.0.1';
const LIMITE_DO_CORPO = 64 * 1024;
const PRAZO_PARA_SUBIR_MS = 3_000;
const INTERVALO_DE_CONFERENCIA_MS = 150;
const DIA_MS = 24 * 60 * 60 * 1000;
const ENTREGAS_A_MOSTRAR = 10;
const RESPOSTA_PADRAO = 'Sim, siga a recomendação.';
const SESSAO_DO_APP = /^local_[0-9a-f-]{36}$/;
const NOME_DO_KIT = 'orquestracao';
/** A pasta deste plugin (no cache, uma por versão): é o que distingue o servidor desta versão do de outra. */
export const PASTA_DO_KIT = resolve(fileURLToPath(new URL('..', import.meta.url)));
// `node <pasta do kit>/lib/cli.mjs pagina …`: a linha de comando com que `abrirPagina` sobe o servidor.
const COMANDO_DA_PAGINA = /^\S*\bnode\s+(\/\S*\/orquestracao(?:\/[^/\s]+)?)\/lib\/cli\.mjs\s+pagina(?:\s|$)/;
const PUBLICO = fileURLToPath(new URL('./publico/', import.meta.url));
// Texto vai com charset; a fonte (binária) vai só com o tipo.
const ARQUIVOS = {
  '/estilo.css': 'text/css; charset=utf-8',
  '/perguntas.css': 'text/css; charset=utf-8',
  '/ceu.js': 'text/javascript; charset=utf-8',
  '/planeta.js': 'text/javascript; charset=utf-8',
  '/fontes/geist-medium.woff2': 'font/woff2',
};

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

const ancora = (projeto, id) => `pergunta-${String(projeto).replace(/[^\w-]/g, '-')}-${id}`;

function cartaoDePergunta(projeto, p) {
  const oculto = `<input type="hidden" name="projeto" value="${esc(projeto)}"><input type="hidden" name="id" value="${esc(p.id)}">`;
  const abrir = ehSessaoDoApp(p.sessao) ? `<button type="submit" formaction="/abrir">Abrir sessão</button>` : '';
  return `<li id="${esc(ancora(projeto, p.id))}">${cabecaDoProjeto(projeto)}<div class="cartao-cab"><span class="id">${idLido(projeto, p.id)}</span><span class="cartao-titulo">${esc(p.titulo)}</span>${p.item ? `<span class="projeto">${idLido(projeto, p.item)}</span>` : ''}</div>
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

/** `agora`, `há 40 s`, `há 3 min`, `há 2 h`, `há 3 d`; sem data, vazio. */
export function haQuanto(ms, agora) {
  if (!Number.isFinite(ms)) return '';
  const seg = Math.max(0, Math.floor((agora - ms) / 1000));
  if (seg < 10) return 'agora';
  if (seg < 60) return `há ${seg} s`;
  if (seg < 3600) return `há ${Math.floor(seg / 60)} min`;
  if (seg < 86_400) return `há ${Math.floor(seg / 3600)} h`;
  return `há ${Math.floor(seg / 86_400)} d`;
}

const ROTULO_DO_PR = { OPEN: 'aberto', MERGED: 'mergeado', CLOSED: 'fechado' };
const textoDoPr = (s) => (s.pr ? `PR #${s.pr}${ROTULO_DO_PR[s.prEstado] ? ` ${ROTULO_DO_PR[s.prEstado]}` : ''}` : '');
const abrirNoApp = (link) => (link ? `<a class="abrir-app" href="${esc(link)}">Abrir no app</a>` : '');
const marcador = (estadoDaSessao, rodando) => `<span class="marcador marcador-${esc(estadoDaSessao)}${rodando ? ' girando' : ''}" aria-hidden="true"></span>`;
const atividade = (s, agora) => {
  if (s.rodando) return 'rodando agora';
  const ha = haQuanto(Date.parse(s.ultimaAtividade ?? ''), agora);
  return ha ? `última atividade ${ha}` : '';
};

/** A esteira: feito, agora e falta pela forma (✓, ponto cheio, ponto vazio), nunca só pela cor. */
const esteiraHtml = (passos) => `<ol class="esteira" aria-label="Etapas do item">${passos.map((e) => `<li class="passo passo-${esc(e.estado)}"${e.estado === 'agora' ? ' aria-current="step"' : ''}><span class="so-leitor">${esc(e.estado)}: </span>${esc(e.nome)}</li>`).join('')}</ol>`;

function cartaoDeSessao(projeto, s, agora) {
  const esperas = s.perguntas.map((q) => `<p class="espera">Esperando você na pergunta <a href="#${esc(ancora(projeto, q.id))}">${idLido(projeto, q.id)}</a>${q.titulo ? ` · ${esc(q.titulo)}` : ''}</p>`).join('');
  const meta = [textoDoPr(s), atividade(s, agora)].filter(Boolean).map(esc);
  if (s.link) meta.push(abrirNoApp(s.link));
  return `<li class="sessao sessao-${esc(s.estado)}"><div class="cartao-cab">${marcador(s.estado, s.rodando)}<span class="id">${idLido(projeto, s.item)}</span><span class="cartao-titulo">${esc(s.titulo)}</span><span class="selo selo-sessao-${esc(s.estado)}">${esc(ROTULO_DO_ESTADO[s.estado])}</span></div>
${esteiraHtml(s.esteira)}${esperas}${s.motivo ? `<p class="motivo">${esc(s.motivo)}</p>` : ''}${meta.length ? `<p class="quando">${meta.join(' · ')}</p>` : ''}</li>`;
}

/** Sessões abertas que não são dona de item vivo (a orquestradora, uma dona que entregou e não se arquivou): uma linha cada. */
const linhasSemItem = (outras, agora) => (outras.length
  ? `<li class="sem-item"><p class="rotulo-sem-item">Outras sessões abertas</p><ul>${outras.map((o) => `<li>${marcador(o.rodando ? 'trabalhando' : 'quieta', o.rodando)}<span class="titulo-sem-item">${esc(o.titulo)}</span><span class="quando">${[atividade(o, agora), abrirNoApp(o.link)].filter(Boolean).join(' · ')}</span></li>`).join('')}</ul></li>`
  : '');

/** Sessões, um grupo por projeto, o mais urgente em cima. */
const grupos = (sessoes, agora) => sessoes.grupos.map((g) => `<li class="grupo-de-projeto"><h3 class="grupo">${esc(g.projeto)}</h3>
<ul class="cartoes">${g.sessoes.map((s) => cartaoDeSessao(g.projeto, s, agora)).join('\n')}${linhasSemItem(g.outras, agora)}</ul></li>`);

/** Ao lado do título: a idade da leitura do app; velha ou ausente, diz o que falta. */
function frescor(sessoes, agora) {
  if (sessoes.lidoEm === null) return 'sem o status do app: abra uma sessão do Claude com a barra';
  const ha = haQuanto(sessoes.lidoEm, agora);
  return sessoes.fresca ? `status do app ${ha}` : `status do app parado (lido ${ha}): abra uma sessão do Claude com a barra`;
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
  const sessoes = sessoesDaPagina({ itens: andamento, perguntas, app: lerSessoesDoApp(estado.raiz()), projetos: estado.projetos(), agora });
  return { perguntas, andamento, sessoes, entregas, maisEntregas };
}

function secao(id, titulo, contagem, itens, vazio, depois = '') {
  return `<section class="secao" aria-labelledby="${id}"><div class="secao-cab"><h2 id="${id}">${titulo}</h2><span class="lido">${contagem}</span></div>
<ul class="cartoes">${itens.join('\n') || `<li class="vazio">${vazio}</li>`}</ul>${depois}</section>`;
}

const verMais = (resto) => (resto.length
  ? `<details class="ver-mais"><summary>Ver mais (${resto.length})</summary><ul class="cartoes">${resto.map(({ projeto, i }) => cartaoDeEntrega(projeto, i)).join('\n')}</ul></details>`
  : '');

const quantos = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** A linha de apoio do topo: quantas perguntas esperam por você e quantas sessões estão ativas. */
function resumo(perguntas, sessoes) {
  const partes = [];
  if (perguntas.length) partes.push(quantos(perguntas.length, 'pergunta esperando', 'perguntas esperando'));
  if (sessoes.total) partes.push(quantos(sessoes.total, 'sessão ativa', 'sessões ativas'));
  return partes.join(' · ') || 'Tudo em dia.';
}

export function html(agora = Date.now()) {
  const { perguntas, sessoes, entregas, maisEntregas } = dados(agora);
  const esquerda = secao('h-perguntas', 'Perguntas', perguntas.length || '', perguntas.map(({ projeto, p }) => cartaoDePergunta(projeto, p)), 'Nada esperando por você.')
    + (sessoes.total ? secao('h-sessoes', 'Sessões', esc(frescor(sessoes, agora)), grupos(sessoes, agora), '') : '');
  const direita = secao('h-entregas', 'Entregues', `últimos ${estado.DIAS_DE_ENTREGAS} dias`, entregas.map(({ projeto, i }) => cartaoDeEntrega(projeto, i)), 'Nenhuma entrega ainda.', verMais(maisEntregas));
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Perguntas do kit</title><link rel="preload" href="/fontes/geist-medium.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/estilo.css"><link rel="stylesheet" href="/perguntas.css"></head>
<body><canvas id="ceu" class="ceu" aria-hidden="true"></canvas><header class="topo"><p class="selo-topo">Kit de orquestração</p><h1>Perguntas do kit</h1><p class="subtitulo">${esc(resumo(perguntas, sessoes))}</p></header>
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
      if (req.method === 'GET' && caminho === '/saude') {
        res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ kit: NOME_DO_KIT, pasta: PASTA_DO_KIT }));
        return;
      }
      if (req.method === 'GET' && ARQUIVOS[caminho]) {
        res.writeHead(200, { 'Content-Type': ARQUIVOS[caminho] }).end(readFileSync(join(PUBLICO, caminho.slice(1))));
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

/** O que responde em `/saude`: `null` se nada; `{ pasta }` do servidor do kit (`pasta: null` na versão antiga, que só dizia `ok`). */
async function saudeNaPorta(porta) {
  try {
    const r = await fetch(`http://${HOST}:${porta}/saude`, { signal: AbortSignal.timeout(500) });
    if (!r.ok) return null;
    const corpo = await r.text();
    try {
      const j = JSON.parse(corpo);
      return { pasta: j?.kit === NOME_DO_KIT && typeof j.pasta === 'string' ? j.pasta : null };
    } catch { return { pasta: null }; }
  } catch { return null; }
}

/** Processos escutando na porta, com a linha de comando de cada um (`lsof` + `ps`); vazio se não der para saber. */
function processosNaPorta(porta) {
  try {
    const pids = execFileSync('lsof', ['-nP', `-iTCP:${porta}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n').map(Number).filter((n) => Number.isInteger(n) && n > 0);
    return pids.map((pid) => {
      try {
        return { pid, comando: execFileSync('ps', ['-o', 'command=', '-p', String(pid)], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() };
      } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

/** A pasta do kit de quem rodou `node <pasta>/lib/cli.mjs pagina`; `null` se a linha não é a do servidor da página. */
export function pastaDoServidorDoKit(comando) {
  return COMANDO_DA_PAGINA.exec(comando ?? '')?.[1] ?? null;
}

function subirDesacoplado(porta) {
  const cli = fileURLToPath(new URL('./cli.mjs', import.meta.url));
  spawn(process.execPath, [cli, 'pagina', '--porta', String(porta)], { detached: true, stdio: 'ignore' }).unref();
}

async function esperarAte(condicao, prazoMs) {
  const ate = Date.now() + prazoMs;
  while (Date.now() < ate) {
    if (await condicao()) return true;
    await new Promise((r) => setTimeout(r, INTERVALO_DE_CONFERENCIA_MS));
  }
  return condicao();
}

/**
 * Se a porta tem o servidor da página de outra pasta do kit (outra versão), encerra-o e devolve `true`.
 * Só encerra o que a linha de comando prova ser o servidor do kit; outro programa na porta fica como está.
 */
async function trocarServidorDeOutraVersao(porta, pasta, { saude, processos, encerrar, prazoMs, aviso }) {
  const dono = processos(porta).find((p) => pastaDoServidorDoKit(p.comando));
  if (!dono) { aviso(`pagina: a porta ${porta} responde, mas não por um servidor do kit que eu possa provar; deixei como está`); return false; }
  if (resolve(pastaDoServidorDoKit(dono.comando)) === pasta) return false;
  encerrar(dono.pid);
  if (await esperarAte(async () => !(await saude(porta)), prazoMs)) return true;
  aviso(`pagina: o servidor antigo (pid ${dono.pid}) não saiu da porta ${porta}`);
  return false;
}

/**
 * Sobe a página se não estiver no ar e devolve o endereço. Se o servidor no ar é de outra versão do kit (outra pasta
 * no cache do plugin), troca-o pelo desta. Com `navegador`, abre no navegador do sistema; sem ele (`--subir`, o botão
 * da barra), quem chamou abre no navegador do app. Dependências trocáveis no teste.
 */
export async function abrirPagina(porta = PORTA_PADRAO, {
  navegador = true, pasta = PASTA_DO_KIT, saude = saudeNaPorta, processos = processosNaPorta,
  encerrar = (pid) => process.kill(pid, 'SIGTERM'), subir = subirDesacoplado, prazoMs = PRAZO_PARA_SUBIR_MS,
  aviso = (t) => process.stderr.write(`${t}\n`),
} = {}) {
  const url = `http://${HOST}:${porta}`;
  let noAr = await saude(porta);
  if (noAr && noAr.pasta !== pasta && await trocarServidorDeOutraVersao(porta, pasta, { saude, processos, encerrar, prazoMs, aviso })) noAr = null;
  if (!noAr) {
    subir(porta);
    await esperarAte(async () => Boolean(await saude(porta)), prazoMs);
  }
  if (navegador && process.platform === 'darwin' && !process.env.ICHIKAWA_SEM_NAVEGADOR) {
    spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  }
  return url;
}
