// As sessões ativas da página (como a vista Sessões do kit antigo): cada item vivo com a sessão dona, o estado por
// urgência e a esteira; mais as sessões abertas sem item. O status ao vivo vem de `sessoes-do-app.json`, que a barra grava
// a cada minuto a partir do `list_sessions` do app (só o app o enxerga). Tudo puro, menos `lerSessoesDoApp`.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ARQUIVO_DO_APP = 'sessoes-do-app.json';
/** Leitura do app mais velha que isto não decide nada: a página só mostra a idade. */
export const LEITURA_FRESCA_MS = 3 * 60_000;
/** Dona sem rodar há mais que isto, sem pergunta aberta, conta como parada. */
export const PARADA_APOS_MS = 30 * 60_000;

/** Da mais urgente para o operador à menos (a ordem do kit antigo, sem fila de merge). */
export const ORDEM_DOS_ESTADOS = ['esperando', 'parada', 'no-pr', 'revisando', 'trabalhando'];
export const ROTULO_DO_ESTADO = { esperando: 'esperando você', parada: 'parada', 'no-pr': 'no PR', revisando: 'em revisão', trabalhando: 'trabalhando' };
const ESTEIRA = ['planejamento', 'execução', 'revisão', 'PR', 'entregue'];
const POSICAO_NA_ESTEIRA = { planejamento: 0, execucao: 1, revisao: 2, pr: 3 };

const texto = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const numeroDoId = (id) => Number(/(\d+)$/.exec(String(id ?? ''))?.[1] ?? Number.MAX_SAFE_INTEGER);

/** O projeto de uma pasta: worktree em `<repo>/.claude/worktrees/<nome>` conta como `<repo>`; senão, o último nome. */
export function projetoDaPasta(cwd) {
  const t = texto(cwd);
  if (!t) return null;
  return t.replace(/\/+$/, '').replace(/\/\.claude\/worktrees\/[^/]+$/, '').split('/').pop() || null;
}

/** Uma sessão do arquivo, sem confiar nele: o que não tem `sessionId` fica de fora. */
function sessaoLida(o) {
  if (!o || typeof o !== 'object') return null;
  const id = texto(o.sessionId);
  if (!id) return null;
  return {
    sessionId: id,
    titulo: texto(o.title) ?? id,
    projeto: projetoDaPasta(o.originCwd ?? o.cwd),
    arquivada: o.isArchived === true,
    rodando: o.isRunning === true,
    pr: Number.isInteger(o.prNumber) && o.prNumber > 0 ? o.prNumber : null,
    prEstado: texto(o.prState),
    ultimaAtividade: texto(o.lastActivityAt) && !Number.isNaN(Date.parse(o.lastActivityAt)) ? o.lastActivityAt : null,
    link: /^claude:\/\/[\w./-]+$/.test(String(o.link ?? '')) ? o.link : null,
  };
}

/** O que a barra gravou: `{ lidoEm (ms), sessoes }`, ou `{ erro }` quando não há arquivo ou ele não se lê. */
export function lerSessoesDoApp(raiz) {
  let bruto;
  try { bruto = JSON.parse(readFileSync(join(raiz, ARQUIVO_DO_APP), 'utf8')); } catch (err) {
    return { lidoEm: null, sessoes: [], erro: err?.code === 'ENOENT' ? 'sem-arquivo' : 'ilegivel' };
  }
  const lidoEm = Date.parse(bruto?.lidoEm);
  if (!Array.isArray(bruto?.sessoes) || Number.isNaN(lidoEm)) return { lidoEm: null, sessoes: [], erro: 'ilegivel' };
  return { lidoEm, sessoes: bruto.sessoes.map(sessaoLida).filter(Boolean), erro: null };
}

/** As bolinhas: feito, agora e falta. */
export function esteira(etapa) {
  const pos = POSICAO_NA_ESTEIRA[etapa] ?? 0;
  return ESTEIRA.map((nome, i) => ({ nome, estado: i < pos ? 'feito' : i === pos ? 'agora' : 'falta' }));
}

/** O estado de um item vivo, pela primeira regra que casa: a pessoa antes da parada, a parada antes da etapa. */
export function estadoDoItem(item, sessao, perguntas, { fresca, agora }) {
  if (perguntas.length) return { estado: 'esperando', motivo: null };
  if (fresca && item.sessao) {
    if (!sessao || sessao.arquivada) return { estado: 'parada', motivo: 'A sessão dona não está aberta no app.' };
    const quieta = sessao.ultimaAtividade ? agora - Date.parse(sessao.ultimaAtividade) : 0;
    if (!sessao.rodando && quieta > PARADA_APOS_MS) return { estado: 'parada', motivo: 'Sem movimento: a dona terminou o turno sem entregar.' };
  }
  if (item.etapa === 'pr') return { estado: 'no-pr', motivo: null };
  if (item.etapa === 'revisao') return { estado: 'revisando', motivo: null };
  return { estado: 'trabalhando', motivo: null };
}

const urgencia = (s) => ORDEM_DOS_ESTADOS.indexOf(s.estado);

/**
 * As sessões por projeto. `itens` e `perguntas` são `[{ projeto, i }]` e `[{ projeto, p }]` (só os vivos e as abertas);
 * `app` é o `lerSessoesDoApp`; `projetos`, os que o kit conhece (as sessões sem item só aparecem neles).
 * Devolve `{ grupos: [{ projeto, sessoes, outras }], total, lidoEm, fresca, erro }`.
 */
export function sessoesDaPagina({ itens, perguntas, app, projetos, agora = Date.now() }) {
  const fresca = app.lidoEm !== null && agora - app.lidoEm <= LEITURA_FRESCA_MS;
  const doApp = new Map(app.sessoes.map((s) => [s.sessionId, s]));
  const donas = new Set();
  const porProjeto = new Map();
  const grupo = (projeto) => {
    if (!porProjeto.has(projeto)) porProjeto.set(projeto, { projeto, sessoes: [], outras: [] });
    return porProjeto.get(projeto);
  };
  for (const { projeto, i } of itens) {
    const sessao = i.sessao ? doApp.get(i.sessao) ?? null : null;
    const pr = i.pr ?? sessao?.pr ?? null;
    if (i.sessao) donas.add(i.sessao);
    const minhas = perguntas.filter(({ projeto: pj, p }) => pj === projeto && ((i.id && p.item === i.id) || (i.sessao && p.sessao === i.sessao))).map(({ p }) => p);
    const { estado, motivo } = estadoDoItem(i, sessao, minhas, { fresca, agora });
    grupo(projeto).sessoes.push({
      item: i.id, titulo: i.titulo ?? i.id, etapa: i.etapa ?? null, estado, motivo,
      rodando: fresca && sessao?.rodando === true,
      pr, prEstado: pr && sessao?.pr === pr ? sessao.prEstado : null,
      ultimaAtividade: sessao?.ultimaAtividade ?? null, link: sessao?.link ?? null,
      perguntas: minhas.map((p) => ({ id: p.id, titulo: p.titulo ?? null })),
      esteira: esteira(i.etapa),
    });
  }
  const conhecidos = new Set(projetos);
  for (const s of app.sessoes) {
    if (s.arquivada || donas.has(s.sessionId) || !conhecidos.has(s.projeto)) continue;
    grupo(s.projeto).outras.push({ titulo: s.titulo, rodando: fresca && s.rodando, ultimaAtividade: s.ultimaAtividade, link: s.link });
  }
  const grupos = [...porProjeto.values()];
  for (const g of grupos) {
    g.sessoes.sort((a, b) => urgencia(a) - urgencia(b) || numeroDoId(a.item) - numeroDoId(b.item));
    g.outras.sort((a, b) => (b.ultimaAtividade ?? '').localeCompare(a.ultimaAtividade ?? ''));
  }
  // O grupo com o cartão mais urgente sobe; só com sessões sem item, vai para o fim; entre iguais, o nome.
  const topo = (g) => (g.sessoes.length ? urgencia(g.sessoes[0]) : ORDEM_DOS_ESTADOS.length);
  grupos.sort((a, b) => topo(a) - topo(b) || a.projeto.localeCompare(b.projeto));
  const total = grupos.reduce((n, g) => n + g.sessoes.length + g.outras.length, 0);
  return { grupos, total, lidoEm: app.lidoEm, fresca, erro: app.erro };
}
