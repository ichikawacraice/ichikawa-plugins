// A página local: perguntas abertas, sessões ativas e o que já foi entregue.
// Só lê os arquivos de estado (e, uma vez por dia, move para arquivo/ a entrega que já saiu dela); grava a resposta dada aqui e os pedidos que o mod da barra executa
// (abrir a sessão, entregar a resposta). Nenhuma batida, nenhum laço em segundo plano: o uso do computador (`GET /uso`)
// só é lido quando a página aberta e visível pede, com a aba Uso do computador escolhida.
import { createServer } from 'node:http';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as estado from './estado.mjs';
import { atualizarKit, comandoDeAtualizar, criarAviso, nomesDosVelhos } from './kit.mjs';
import { LEITURA_FRESCA_MS, ROTULO_DO_ESTADO, duracao, lerSessoesDoApp, sessoesDaPagina } from './sessoes.mjs';
import { AMOSTRA_FRESCA_MS, criarColeta, secaoDeUso } from './uso.mjs';
import { BOTAO_DE_TEMA, BOTAO_DE_TEMAS, GAVETA_DE_TEMAS } from './publico/tema.js';

export const PORTA_PADRAO = 4747;
const HOST = '127.0.0.1';
const LIMITE_DO_CORPO = 64 * 1024;
const PRAZO_PARA_SUBIR_MS = 3_000;
const INTERVALO_DE_CONFERENCIA_MS = 150;
const DIA_MS = 24 * 60 * 60 * 1000;
const ENTREGAS_A_MOSTRAR = 10;
// O nome da página (topo e aba). Já não é só perguntas: perguntas, sessões e entregas.
export const NOME_DA_PAGINA = 'Painel';
const RESPOSTA_PADRAO = 'Sim, siga a recomendação.';
// Um botão só por pergunta: campo vazio aceita a recomendação, com texto envia o texto. O rótulo acompanha o campo
// (script da página); sem script, o servidor decide pelo conteúdo do campo, e o botão diz o caso vazio.
const ROTULO_VAZIO = 'Aceitar recomendação';
const ROTULO_CHEIO = 'Enviar resposta';
const ROTULOS_DO_RESPONDER = `data-vazio="${ROTULO_VAZIO}" data-cheio="${ROTULO_CHEIO}"`;
const { SESSAO_DO_APP } = estado;
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
  '/ceu-dia.js': 'text/javascript; charset=utf-8',
  '/planeta.js': 'text/javascript; charset=utf-8',
  '/tema.js': 'text/javascript; charset=utf-8',
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

// O projeto vai na linha do código (`IZA-Q45 · Izanagi`), pequeno e apagado: o título manda e o cartão ganha uma linha.
const cabecaDoProjeto = (projeto) => `<span class="cartao-projeto">${esc(projeto)}</span>`;
const idLido = (projeto, id) => esc(estado.rotulo(projeto, id));

const ancora = (projeto, id) => `pergunta-${String(projeto).replace(/[^\w-]/g, '-')}-${id}`;

function cartaoDePergunta(projeto, p) {
  const oculto = `<input type="hidden" name="projeto" value="${esc(projeto)}"><input type="hidden" name="id" value="${esc(p.id)}">`;
  // A recomendação sai do meio dos campos e ganha caixa própria: é ela que o botão aceita com o campo vazio.
  const recomendacao = p.recomendacao ? `<div class="recomendacao"><p class="recomendacao-rotulo">Recomendação</p><p class="recomendacao-texto">${esc(p.recomendacao)}</p></div>` : '';
  return `<li class="pergunta" id="${esc(ancora(projeto, p.id))}"><div class="cartao-cab"><span class="id">${idLido(projeto, p.id)}</span>${cabecaDoProjeto(projeto)}<span class="cartao-titulo">${esc(p.titulo)}</span>${p.item ? `<span class="projeto">${idLido(projeto, p.item)}</span>` : ''}</div>
${campos([['O caso', esc(p.caso)], ['Se ninguém decidir', esc(p.seNaoDecidir)]])}${recomendacao}
<form class="responder" method="post" action="/responder">${oculto}
<textarea name="resposta" rows="2" aria-label="Resposta para ${esc(p.id)}" placeholder="Escreva outra resposta, ou deixe vazio para aceitar a recomendação"></textarea>
<div class="responder-acoes"><button type="submit" class="primario botao-responder" ${ROTULOS_DO_RESPONDER}>${esc(ROTULO_VAZIO)}</button></div></form>
<p class="quando">${esc(horaSP(p.criadoEm))}${p.item ? ` · no app, a sessão é a <b>${idLido(projeto, p.item)} · …</b> na barra lateral` : ''}</p></li>`;
}

/** A entrega abre e fecha: o resumo é a primeira linha; o resto aparece ao abrir. */
function cartaoDeEntrega(projeto, i) {
  const e = i.entrega;
  const proximos = Array.isArray(e.proximos) && e.proximos.length
    ? `<ul class="proximos">${e.proximos.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
  return `<li><details class="entrega" id="entrega-${esc(projeto)}-${esc(i.id)}"><summary><div class="cartao-cab"><span class="id">${idLido(projeto, i.id)}</span>${cabecaDoProjeto(projeto)}<span class="cartao-titulo">${esc(i.titulo)}</span><span class="selo selo-${esc(e.desfecho)}">${esc(e.desfecho)}</span></div></summary>
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
// Rodando: o arco de três quartos com as pontas redondas, girando (o do painel do kit antigo); parado, o ponto do estado.
const ARCO_GIRANDO = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2a6 6 0 1 1-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
const marcador = (estadoDaSessao, rodando) => `<span class="marcador marcador-${esc(estadoDaSessao)}${rodando ? ' girando' : ''}" aria-hidden="true">${rodando ? ARCO_GIRANDO : ''}</span>`;
const atividade = (s, agora) => {
  if (s.rodando) return 'rodando agora';
  const ha = haQuanto(Date.parse(s.ultimaAtividade ?? ''), agora);
  return ha ? `última atividade ${ha}` : '';
};

/** A esteira: feito, agora e falta pela forma (✓, ponto cheio, ponto vazio), nunca só pela cor. */
const esteiraHtml = (passos) => `<ol class="esteira" aria-label="Etapas do item">${passos.map((e) => `<li class="passo passo-${esc(e.estado)}"${e.estado === 'agora' ? ' aria-current="step"' : ''}><span class="so-leitor">${esc(e.estado)}: </span>${esc(e.nome)}</li>`).join('')}</ol>`;

const NOME_DA_ETAPA = { planejamento: 'planejamento', execucao: 'execução', revisao: 'revisão', pr: 'PR' };

/** O que abre no cartão da sessão (ICH-F39): o feito e o que falta, contados pela dona, e o tempo de cada etapa. */
function detalheDaSessao(s, agora) {
  const a = s.andamento;
  const andamento = a
    ? `${campos([['Feito', esc(a.feito)], ['Falta', esc(a.falta)]])}${a.em ? `<p class="quando">Resumo da dona ${esc(haQuanto(Date.parse(a.em), agora))}</p>` : ''}`
    : '<p class="sem-andamento">A dona ainda não contou o que fez e o que falta (<code>perguntas item andamento</code>).</p>';
  const t = s.tempos;
  const linhas = t.etapas.map((e) => `<li${e.agora ? ' class="tempo-agora"' : ''}><span class="tempo-etapa">${esc(NOME_DA_ETAPA[e.etapa])}</span><span class="tempo-valor">${esc(duracao(e.ms))}${e.agora ? ', até agora' : ''}</span></li>`).join('');
  const tempos = t.semRegistro
    ? '<p class="sem-andamento">Sem registro das etapas: o item é anterior ao registro.</p>'
    : `<ul class="tempos" aria-label="Tempo em cada etapa">${linhas}</ul>`;
  const total = t.totalMs !== null ? `<p class="quando">Total: ${esc(duracao(t.totalMs))}</p>` : '';
  return `<div class="sessao-aberta">${andamento}<p class="rotulo-tempos">Tempo por etapa</p>${tempos}${total}</div>`;
}

function cartaoDeSessao(projeto, s, agora) {
  const esperas = s.perguntas.map((q) => `<p class="espera">Esperando você na pergunta <a href="#${esc(ancora(projeto, q.id))}">${idLido(projeto, q.id)}</a>${q.titulo ? ` · ${esc(q.titulo)}` : ''}</p>`).join('');
  const meta = [textoDoPr(s), atividade(s, agora)].filter(Boolean).map(esc);
  const id = `sessao-${String(projeto).replace(/[^\w-]/g, '-')}-${s.item}`;
  return `<li class="sessao sessao-${esc(s.estado)}"><details class="sessao-detalhe" id="${esc(id)}"><summary><div class="cartao-cab">${marcador(s.estado, s.rodando)}<span class="id">${idLido(projeto, s.item)}</span><span class="cartao-titulo">${esc(s.titulo)}</span><span class="selo selo-sessao-${esc(s.estado)}">${esc(ROTULO_DO_ESTADO[s.estado])}</span></div>
${esteiraHtml(s.esteira)}${esperas}${s.motivo ? `<p class="motivo">${esc(s.motivo)}</p>` : ''}${meta.length ? `<p class="quando">${meta.join(' · ')}</p>` : ''}</summary>
${detalheDaSessao(s, agora)}</details></li>`;
}

/** Sessão sem item que está rodando: cartão como as ativas (ativa tem um só desenho), sem id nem esteira, que não tem. */
const cartaoSemItem = (o, agora) => `<li class="sessao sessao-trabalhando sessao-sem-item"><div class="cartao-cab">${marcador('trabalhando', true)}<span class="cartao-titulo">${esc(o.titulo)}</span><span class="selo selo-sessao-trabalhando">${esc(ROTULO_DO_ESTADO.trabalhando)}</span></div>
<p class="quando">${esc(atividade(o, agora))}</p></li>`;

/** Sessões sem item paradas (a orquestradora quieta, uma dona que entregou e não se arquivou): o pontilhado, uma linha cada. */
const linhasSemItem = (paradas, agora) => (paradas.length
  ? `<li class="sem-item"><p class="rotulo-sem-item">Sessões paradas</p><ul>${paradas.map((o) => `<li>${marcador('quieta', false)}<span class="titulo-sem-item">${esc(o.titulo)}</span><span class="quando">${esc(atividade(o, agora))}</span></li>`).join('')}</ul></li>`
  : '');

/** Sessões, um grupo por projeto, o mais urgente em cima. */
const grupos = (sessoes, agora) => sessoes.grupos.map((g) => `<li class="grupo-de-projeto"><h3 class="grupo">${esc(g.projeto)}</h3>
<ul class="cartoes">${g.sessoes.map((s) => cartaoDeSessao(g.projeto, s, agora)).join('\n')}${g.outras.filter((o) => o.rodando).map((o) => cartaoSemItem(o, agora)).join('\n')}${linhasSemItem(g.outras.filter((o) => !o.rodando), agora)}</ul></li>`);

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
  const sessoes = sessoesDaPagina({ itens: andamento, perguntas, app: lerSessoesDoApp(estado.raiz()), projetos: estado.projetos(), sigla: estado.sigla, agora });
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

/** Um selo do topo: só o número, na cor do status (as do kit: aguarda, trabalhando, entregou); o texto fica para o leitor de tela e a dica. */
const contagem = (status, n, texto) => `<li class="contagem contagem-${status}${n ? '' : ' zero'}" title="${esc(texto)}"><span aria-hidden="true">${n}</span><span class="so-leitor">${esc(texto)}</span></li>`;

function selosDoTopo(perguntas, andamento, entregues) {
  return `<ul class="contagens" aria-label="Resumo">${[
    contagem('aguarda', perguntas, quantos(perguntas, 'pergunta esperando você', 'perguntas esperando você')),
    contagem('trabalhando', andamento, quantos(andamento, 'item em andamento', 'itens em andamento')),
    contagem('entregou', entregues, `${quantos(entregues, 'entregue', 'entregues')} nos últimos ${estado.DIAS_DE_ENTREGAS} dias`),
  ].join('')}</ul>`;
}

/** O modo ausente, lido do arquivo da barra a cada carga da página (e o recarregamento de 30 s o mantém em dia). */
function avisoDeAusente(ausente) {
  const desde = ausente?.desde ? horaSP(ausente.desde) : '';
  return ausente
    ? `<p class="aviso-ausente ligado" role="status"><span class="aviso-ponto" aria-hidden="true"></span><b>Ausente ligado</b><span class="aviso-apoio">as sessões seguem sem esperar você${desde ? ` · desde ${esc(desde)}` : ''}</span></p>`
    : '<p class="aviso-ausente desligado" role="status"><span class="aviso-ponto" aria-hidden="true"></span><b>Ausente desligado</b><span class="aviso-apoio">o que é seu espera pela sua resposta</span></p>';
}

/** A coleta do uso do computador desta página (uma por processo do servidor; só roda quando a página pede). */
export const coletaDeUso = criarColeta({ lerSessoes: () => lerSessoesDoApp(estado.raiz()).sessoes });

/** A amostra guardada, se ainda fresca: o HTML inicial nunca roda o `ps`. */
const usoGuardado = (agora) => {
  const a = coletaDeUso.ultima();
  return a && agora - a.em <= AMOSTRA_FRESCA_MS ? a : null;
};

/**
 * As abas da página: Perguntas (com Sessões e Entregues: a visão que fica aberta) e Uso do computador, que só coleta
 * enquanto está escolhida. A aba escolhida vai no endereço (`#uso`), por isso sobrevive ao recarregar de 30 s e ao F5,
 * e a página aberta de novo (pela barra, pelo favorito) começa em Perguntas.
 */
const ABAS_DA_PAGINA = [['perguntas', 'Perguntas'], ['uso', 'Uso do computador']];
const ABAS = `<nav class="abas" role="tablist" aria-label="Visões do ${NOME_DA_PAGINA}">${ABAS_DA_PAGINA.map(([id, rotulo], i) =>
  `<button type="button" role="tab" id="aba-${id}" aria-controls="painel-${id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${rotulo}</button>`).join('')}</nav>`;
/**
 * Script comum (não módulo), logo depois dos painéis: aplica a aba do endereço antes da primeira pintura, sem piscar
 * a aba Perguntas. Teclado do padrão de abas: setas, Home e End trocam e focam; Tab entra no painel. Ao trocar, avisa
 * `trocou-de-aba` (a coleta do uso escuta).
 */
const LIGAR_ABAS = `(() => {
  const abas = [...document.querySelectorAll('[role="tab"]')];
  const escolher = (id, focar) => {
    if (!abas.some((a) => a.id === 'aba-' + id)) id = 'perguntas';
    document.documentElement.dataset.aba = id;
    for (const a of abas) {
      const ativa = a.id === 'aba-' + id;
      a.setAttribute('aria-selected', String(ativa));
      a.tabIndex = ativa ? 0 : -1;
      document.getElementById(a.getAttribute('aria-controls')).hidden = !ativa;
      if (ativa && focar) a.focus();
    }
  };
  const doEndereco = () => location.hash.slice(1) || 'perguntas';
  escolher(doEndereco(), false);
  const trocar = (id, focar) => {
    escolher(id, focar);
    history.replaceState(null, '', id === 'perguntas' ? location.pathname + location.search : '#' + id);
    document.dispatchEvent(new Event('trocou-de-aba'));
  };
  abas.forEach((a, i) => {
    a.addEventListener('click', () => trocar(a.id.slice(4), false));
    a.addEventListener('keydown', (ev) => {
      const alvo = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 }[ev.key];
      if (alvo === undefined) return;
      ev.preventDefault();
      trocar(abas[(alvo + abas.length) % abas.length].id.slice(4), true);
    });
  });
  addEventListener('hashchange', () => { escolher(doEndereco(), false); document.dispatchEvent(new Event('trocou-de-aba')); });
})();`;

/** A conferência do kit desta página (uma por processo do servidor). */
export const avisoDoKit = criarAviso();

/**
 * Plugin do kit instalado numa versão mais velha que a `main`: uma linha discreta no topo com o botão que atualiza
 * (`POST /atualizar-kit`). O comando fica escondido e só aparece se a atualização falhar, para rodar à mão.
 * Nada quando está tudo em dia ou a conferência não respondeu.
 */
function avisoDeKitNovo(kit) {
  if (!kit?.velhos?.length) return '';
  const nomes = nomesDosVelhos(kit.velhos);
  return `<div class="aviso-kit" role="status"><p><span class="aviso-ponto" aria-hidden="true"></span><span class="kit-texto">${nomes.length === 1 ? 'Versão nova do plugin' : 'Versão nova dos plugins'} ${esc(nomes.join(', '))}</span>`
    + '<button type="button" class="botao-kit">Atualizar</button></p>'
    + `<div class="kit-comando" hidden><p class="kit-erro"></p><code>${esc(comandoDeAtualizar(kit.velhos))}</code></div></div>`;
}

export function html(agora = Date.now(), kit = avisoDoKit(agora), uso = usoGuardado(agora)) {
  const { perguntas, andamento, sessoes, entregas, maisEntregas } = dados(agora);
  const ausente = estado.lerAusente();
  const esquerda = secao('h-perguntas', 'Perguntas', perguntas.length || '', perguntas.map(({ projeto, p }) => cartaoDePergunta(projeto, p)), 'Nada esperando por você.')
    + (sessoes.total ? secao('h-sessoes', 'Sessões', esc(frescor(sessoes, agora)), grupos(sessoes, agora), '') : '');
  const direita = secao('h-entregas', 'Entregues', `últimos ${estado.DIAS_DE_ENTREGAS} dias`, entregas.map(({ projeto, i }) => cartaoDeEntrega(projeto, i)), 'Nenhuma entrega ainda.', verMais(maisEntregas));
  // O céu segue só o botão de tema (`tema.json`): claro é o dia; escuro, e o padrão, a noite (estilo.css e ceu.js leem o `data-ceu`).
  // O tema do painel desligado (`tema-do-painel.json`) tira o céu e o vidro: o layout do kit antigo, no claro ou no escuro.
  const ligadoOuNao = (v) => (v ? 'ligado' : 'desligado');
  return `<!doctype html><html lang="pt-BR" data-ceu="${estado.lerTema() === 'claro' ? 'dia' : 'noite'}" data-tema-do-app="${ligadoOuNao(estado.lerTemaDoApp())}" data-tema-do-painel="${ligadoOuNao(estado.lerTemaDoPainel())}" data-efeitos="${estado.lerEfeitos()}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(NOME_DA_PAGINA)}</title><link rel="preload" href="/fontes/geist-medium.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/estilo.css"><link rel="stylesheet" href="/perguntas.css"></head>
<body><canvas id="ceu" class="ceu" aria-hidden="true"></canvas><header class="topo">${BOTAO_DE_TEMAS}${BOTAO_DE_TEMA}<h1>${esc(NOME_DA_PAGINA)}</h1>${selosDoTopo(perguntas.length, andamento.length, entregas.length + maisEntregas.length)}${avisoDeAusente(ausente)}${avisoDeKitNovo(kit)}</header>
${ABAS}
<main id="painel-perguntas" role="tabpanel" aria-labelledby="aba-perguntas"><div>${esquerda}</div><div>${direita}</div></main>
<main id="painel-uso" role="tabpanel" aria-labelledby="aba-uso" hidden><div>${secaoDeUso(uso)}</div></main>
<script>${LIGAR_ABAS}</script>
<footer class="pe"><p>Lido às ${esc(horaSP(new Date(agora).toISOString()))}. A página se atualiza sozinha enquanto você não está escrevendo.</p><p class="assinatura">made by Ichikawa</p></footer>
${GAVETA_DE_TEMAS}
<script type="module">
import { iniciarCeu } from '/ceu.js';
import { ligarBotaoDeTema, ligarEfeitos, ligarGavetaDeTemas } from '/tema.js';
ligarBotaoDeTema(document.getElementById('b-tema'), async (tema) => {
  const r = await fetch('/tema', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ tema }) });
  if (!r.ok) throw new Error('a página respondeu ' + r.status);
});
ligarGavetaDeTemas(document.getElementById('b-temas'), document.getElementById('gaveta-temas'), async (qual, ligado) => {
  const r = await fetch(qual === 'app' ? '/tema-do-app' : '/tema-do-painel', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ligado: String(ligado) }) });
  if (!r.ok) throw new Error('a página respondeu ' + r.status);
});
ligarEfeitos(document.getElementById('gaveta-temas'), async (efeitos) => {
  const r = await fetch('/efeitos', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ efeitos }) });
  if (!r.ok) throw new Error('a página respondeu ' + r.status);
});
// O aviso de kit novo atualiza pelo servidor da página; se falhar, mostra o porquê e o comando para rodar à mão.
for (const botao of document.querySelectorAll('.botao-kit')) {
  botao.addEventListener('click', async () => {
    const aviso = botao.closest('.aviso-kit');
    const texto = aviso.querySelector('.kit-texto');
    botao.disabled = true;
    botao.textContent = 'Atualizando…';
    aviso.dataset.atualizando = '';
    try {
      const r = await fetch('/atualizar-kit', { method: 'POST' });
      const corpo = await r.json().catch(() => ({}));
      if (!r.ok || !corpo.ok) throw Object.assign(new Error(corpo.erro ?? 'a página respondeu ' + r.status), { comando: corpo.comando });
      texto.textContent = 'Atualizado. Reinicie as sessões abertas para elas pegarem a versão nova.';
      botao.remove();
    } catch (err) {
      botao.disabled = false;
      botao.textContent = 'Tentar de novo';
      const caixa = aviso.querySelector('.kit-comando');
      caixa.querySelector('.kit-erro').textContent = 'Não deu: ' + err.message + '. Dá para rodar no terminal:';
      if (err.comando) caixa.querySelector('code').textContent = err.comando;
      caixa.hidden = false;
    } finally {
      delete aviso.dataset.atualizando;
    }
  });
}
// O botão de responder diz o que vai fazer: vazio, aceitar a recomendação; com texto, enviar a resposta.
const rotularResposta = (campo) => {
  const botao = campo.form?.querySelector('.botao-responder');
  if (botao) botao.textContent = campo.value.trim() ? botao.dataset.cheio : botao.dataset.vazio;
};
for (const campo of document.querySelectorAll('.responder textarea')) {
  rotularResposta(campo);
  campo.addEventListener('input', () => rotularResposta(campo));
  // ⌘/Ctrl+Enter responde do próprio campo.
  campo.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); campo.form.requestSubmit(); } });
}
const escrevendo = () => [...document.querySelectorAll('textarea')].some((t) => t.value.trim() || t === document.activeElement)
  || document.getElementById('gaveta-temas')?.open || document.querySelector('.aviso-kit[data-atualizando], .kit-comando:not([hidden])');
// O recarregamento fecharia os cartões abertos: guarda quais estavam abertos e reabre.
const ABERTOS = 'entregas-abertas';
const lerAbertos = () => { try { return JSON.parse(sessionStorage.getItem(ABERTOS) ?? '[]'); } catch { return []; } };
for (const id of lerAbertos()) { const d = document.getElementById(id); if (d) { d.open = true; d.closest('.ver-mais')?.setAttribute('open', ''); } }
document.addEventListener('toggle', () => {
  const abertos = [...document.querySelectorAll('details.entrega[open], details.sessao-detalhe[open]')].map((d) => d.id);
  try { sessionStorage.setItem(ABERTOS, JSON.stringify(abertos)); } catch { /* sem armazenamento: só não lembra */ }
}, true);
setInterval(() => { if (!document.hidden && !escrevendo()) location.reload(); }, 30000);
// Uso do computador: pede uma amostra a cada 5 s, só com a aba Uso ativa e a página visível (aba Perguntas, aba do
// navegador escondida ou janela minimizada não coleta).
const abaAtiva = () => document.documentElement.dataset.aba;
let lendoUso = false;
const lerUso = async () => {
  if (abaAtiva() !== 'uso' || document.visibilityState !== 'visible' || lendoUso) return;
  lendoUso = true;
  try {
    const r = await fetch('/uso', { cache: 'no-store' });
    const atual = document.getElementById('uso');
    if (r.ok && atual) atual.outerHTML = await r.text();
  } catch { /* servidor fora: a seção fica com a última leitura */ } finally { lendoUso = false; }
};
lerUso();
setInterval(lerUso, 5000);
document.addEventListener('visibilitychange', lerUso);
document.addEventListener('trocou-de-aba', lerUso);
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
export function gravarPedido(tipo, sessao, texto = null, reserva = null) {
  const pasta = join(estado.raiz(), 'pedidos');
  mkdirSync(pasta, { recursive: true });
  const pedido = { tipo, sessao, texto, ...(reserva ? { reserva } : {}), criadoEm: new Date().toISOString() };
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
  // Campo vazio é aceitar a recomendação; com texto, o texto. O `acao` (da página de antes, com dois botões) não manda:
  // era clicar em "Aceitar" com a resposta escrita que jogava fora o que o operador digitou.
  const resposta = f.get('resposta')?.trim() || RESPOSTA_PADRAO;
  estado.atualizar('perguntas', projeto, p.id, { estado: 'respondida', resposta, respondidaEm: new Date().toISOString(), lida: false });
  entregarResposta(p, projeto, resposta, lerSessoesDoApp(estado.raiz()));
  res.writeHead(303, { Location: '/' }).end();
}

/**
 * Para quem vai a resposta da página: a sessão que perguntou, se o app a mostra aberta; senão (arquivada, apagada ou
 * pergunta sem sessão), a orquestradora do projeto: a gravada, ou a sessão aberta do projeto com "orquestradora" no
 * título. Com a leitura do app velha não dá para saber se a dona vive: vai a ela, e a orquestradora fica de reserva
 * (a barra tenta a reserva se a entrega falhar). `null` quando não há para quem mandar: a resposta fica para
 * `perguntas novidades`.
 */
export function destinoDaResposta(p, projeto, app, agora = Date.now()) {
  const fresca = app.lidoEm !== null && agora - app.lidoEm <= LEITURA_FRESCA_MS;
  const abertas = app.sessoes.filter((s) => !s.arquivada);
  const aberta = (id) => abertas.some((s) => s.sessionId === id);
  const gravada = estado.orquestradoraDe(projeto);
  const peloTitulo = abertas.find((s) => s.projeto === projeto && /orquestradora/i.test(s.titulo))?.sessionId ?? null;
  const orquestradora = fresca ? ((gravada && aberta(gravada) ? gravada : null) ?? peloTitulo) : (gravada ?? peloTitulo);
  const dona = ehSessaoDoApp(p.sessao) ? p.sessao : null;
  if (dona && (!fresca || aberta(dona))) return { sessao: dona, dona: true, reserva: orquestradora !== dona ? orquestradora : null };
  return orquestradora ? { sessao: orquestradora, dona: dona === orquestradora, reserva: null } : null;
}

const textoParaADona = (p, resposta) => `${p.id} · pergunta aberta por esta sessão («${p.titulo}»), resposta do operador pela página: ${resposta}`;

function textoParaAOrquestradora(p, projeto, resposta) {
  const de = p.sessao ? `pela sessão ${p.sessao}, que não está mais aberta` : 'sem sessão gravada';
  const item = p.item ? ` (item ${estado.rotulo(projeto, p.item)})` : '';
  return `${estado.rotulo(projeto, p.id)} · resposta do operador pela página à pergunta «${p.titulo}»${item}, aberta ${de}: ${resposta}\n`
    + 'A dona não vai receber: aja com essa decisão (retome o item com outra dona, ou siga você) ou diga ao operador que não há o que fazer. Depois, `perguntas novidades` para marcá-la lida.';
}

/** Grava o pedido que a barra entrega; a sessão pode ter se limpado depois de perguntar, então o texto traz o título. */
export function entregarResposta(p, projeto, resposta, app, agora = Date.now()) {
  const destino = destinoDaResposta(p, projeto, app, agora);
  if (!destino) return null;
  const texto = destino.dona ? textoParaADona(p, resposta) : textoParaAOrquestradora(p, projeto, resposta);
  const reserva = destino.reserva ? { sessao: destino.reserva, texto: textoParaAOrquestradora(p, projeto, resposta) } : null;
  return gravarPedido('responder', destino.sessao, texto, reserva);
}

/** O botão de tema: grava `claro` ou `escuro` no `tema.json` (o mesmo da barra e do painel de cotas). */
async function trocarTema(req, res, porta) {
  if (!origemLocal(req, porta)) { res.writeHead(403).end('origem recusada'); return; }
  const tema = new URLSearchParams(await lerCorpo(req)).get('tema');
  if (!estado.TEMAS.includes(tema)) { res.writeHead(400).end('tema desconhecido'); return; }
  estado.gravarTema(tema, 'painel');
  res.writeHead(204).end();
}

/** As chaves da gaveta de temas: grava `ligado` (`true` ou `false`) no `tema-do-app.json` (que a barra relê) ou no `tema-do-painel.json`. */
const trocarLigado = (gravar) => async (req, res, porta) => {
  if (!origemLocal(req, porta)) { res.writeHead(403).end('origem recusada'); return; }
  const ligado = new URLSearchParams(await lerCorpo(req)).get('ligado');
  if (ligado !== 'true' && ligado !== 'false') { res.writeHead(400).end('ligado: true ou false'); return; }
  gravar(ligado === 'true', 'painel');
  res.writeHead(204).end();
};
const trocarTemaDoApp = trocarLigado((ligado, por) => estado.gravarTemaDoApp(ligado, por));
const trocarTemaDoPainel = trocarLigado((ligado, por) => estado.gravarTemaDoPainel(ligado, por));

/** O nível de efeitos da gaveta: grava `nenhum`, `poucos` ou `completo` no `efeitos.json` (que a barra relê). */
async function trocarEfeitos(req, res, porta) {
  if (!origemLocal(req, porta)) { res.writeHead(403).end('origem recusada'); return; }
  const efeitos = new URLSearchParams(await lerCorpo(req)).get('efeitos');
  if (!estado.EFEITOS.includes(efeitos)) { res.writeHead(400).end('efeitos: nenhum, poucos ou completo'); return; }
  estado.gravarEfeitos(efeitos, 'painel');
  res.writeHead(204).end();
}

/** Arquiva em todos os projetos o que já saiu da página; devolve os ids lidos (`IZA-F3`). */
let atualizandoKit = false;

/**
 * `POST /atualizar-kit`: roda o `claude plugin update` das instalações que a própria página achou velhas (nada vem do
 * pedido além do clique). Responde JSON: `{ ok: true }`, ou `{ ok: false, erro, comando }` com o comando para rodar à mão.
 */
async function atualizarKitPelaPagina(req, res, porta, { aviso = avisoDoKit, atualizar = atualizarKit } = {}) {
  const json = (codigo, corpo) => res.writeHead(codigo, { 'Content-Type': 'application/json; charset=utf-8' }).end(JSON.stringify(corpo));
  if (!origemLocal(req, porta)) { res.writeHead(403).end('origem recusada'); return; }
  await lerCorpo(req);
  const kit = aviso();
  if (!kit?.velhos?.length) { json(409, { ok: false, erro: 'não há plugin para atualizar' }); return; }
  if (atualizandoKit) { json(409, { ok: false, erro: 'já estou atualizando' }); return; }
  atualizandoKit = true;
  try {
    const r = await atualizar(kit.velhos);
    aviso.esquecer();
    if (r.ok) json(200, { ok: true });
    else json(500, { ok: false, erro: `falhou: ${r.falhou.saida.split('\n').pop() || 'sem saída'}`, comando: comandoDeAtualizar(kit.velhos) });
  } finally {
    atualizandoKit = false;
  }
}

export function arquivarTudo(agora = Date.now()) {
  return estado.projetos().flatMap((projeto) => estado.arquivar(projeto, agora).map((id) => estado.rotulo(projeto, id)));
}

export function criarServidor(portaPedida = PORTA_PADRAO, opcoes = {}) {
  let ultimaLimpeza = -Infinity;
  // A limpeza roda ao abrir a página, no máximo uma vez por dia por processo: sem laço em segundo plano.
  const limparSeDeuODia = () => {
    if (Date.now() - ultimaLimpeza < DIA_MS) return;
    ultimaLimpeza = Date.now();
    try { arquivarTudo(); } catch (err) { process.stderr.write(`pagina: limpeza falhou: ${err.message}\n`); }
  };
  // Porta 0: o sistema escolhe uma livre, e a origem aceita passa a ser a que ele escolheu.
  const servidor = createServer(async (req, res) => {
    const porta = portaPedida || servidor.address().port;
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
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(html(Date.now(), (opcoes.aviso ?? avisoDoKit)()));
        return;
      }
      if (req.method === 'GET' && caminho === '/uso') {
        const amostra = await (opcoes.coleta ?? coletaDeUso).amostra();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(secaoDeUso(amostra));
        return;
      }
      if (req.method === 'POST' && caminho === '/responder') { await responder(req, res, porta); return; }
      if (req.method === 'POST' && caminho === '/tema') { await trocarTema(req, res, porta); return; }
      if (req.method === 'POST' && caminho === '/tema-do-app') { await trocarTemaDoApp(req, res, porta); return; }
      if (req.method === 'POST' && caminho === '/tema-do-painel') { await trocarTemaDoPainel(req, res, porta); return; }
      if (req.method === 'POST' && caminho === '/efeitos') { await trocarEfeitos(req, res, porta); return; }
      if (req.method === 'POST' && caminho === '/atualizar-kit') { await atualizarKitPelaPagina(req, res, porta, opcoes); return; }
      res.writeHead(404).end('não existe');
    } catch (err) {
      process.stderr.write(`pagina: ${err.message}\n`);
      if (!res.headersSent) res.writeHead(500).end('erro ao ler o estado');
    }
  });
  return servidor;
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
