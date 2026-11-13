// O painel de sessões: funções puras, sem `$`. Recebem o que o mod leu (lista do app, itens e perguntas do kit)
// e devolvem as linhas que o pane desenha.

import type { LinhaDeSessao, StatusDaSessao } from '../types'

export const PANE_SESSOES = 'sessoes'
export const TITULO_SESSOES = 'Sessões'
/** A leitura do app enquanto o pane está aberto. Fechado, nada é lido. */
export const SESSOES_INTERVALO_MS = 60_000
export const SESSOES_LIMITE = 50

/** O projeto de uma pasta: worktree em `<repo>/.claude/worktrees/<nome>` conta como `<repo>`; senão, o último nome. */
export function projetoDaPasta(cwd: string | null | undefined): string | null {
  if (!cwd) return null
  const sem = cwd.replace(/\/+$/, '').replace(/\/\.claude\/worktrees\/[^/]+$/, '')
  const nome = sem.split('/').pop()

  return nome || null
}

/** Uma entrada do `list_sessions`/`get_session`, só com o que o painel usa; o resto é ignorado. */
export type SessaoDoApp = {
  sessionId: string
  title?: string
  cwd?: string
  originCwd?: string
  isArchived?: boolean
  isRunning?: boolean
  prNumber?: number
  prState?: string
  lastActivityAt?: string
  createdAt?: string
  link?: string
}

const texto = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined)

/** Lê a resposta do app sem confiar nela: o que não for objeto com `sessionId` fica de fora. */
export function lerSessoes(bruto: unknown): SessaoDoApp[] {
  const lista = Array.isArray(bruto) ? bruto : bruto && typeof bruto === 'object' ? [bruto] : []
  const saida: SessaoDoApp[] = []
  for (const v of lista) {
    if (!v || typeof v !== 'object') continue
    const o = v as Record<string, unknown>
    const id = texto(o.sessionId)
    if (!id) continue
    saida.push({
      sessionId: id,
      title: texto(o.title),
      cwd: texto(o.cwd),
      originCwd: texto(o.originCwd),
      isArchived: o.isArchived === true,
      isRunning: o.isRunning === true,
      prNumber: typeof o.prNumber === 'number' ? o.prNumber : undefined,
      prState: texto(o.prState),
      lastActivityAt: texto(o.lastActivityAt),
      createdAt: texto(o.createdAt),
      link: texto(o.link),
    })
  }

  return saida
}

/** O texto de uma resposta de ferramenta MCP como JSON; `null` se não for JSON. */
export function jsonDaFerramenta(r: { text?: string } | null | undefined): unknown {
  if (!r?.text) return null
  try {
    return JSON.parse(r.text)
  } catch {
    return null
  }
}

export type ItemDoKit = { id: string; etapa?: string; sessao?: string; pr?: number | null }
export type PerguntaDoKit = { id: string; estado?: string; sessao?: string; item?: string }

export function lerItem(textoDoArquivo: string): ItemDoKit | null {
  try {
    const o = JSON.parse(textoDoArquivo) as Record<string, unknown>
    const id = texto(o.id)
    if (!id) return null

    return { id, etapa: texto(o.etapa), sessao: texto(o.sessao), pr: typeof o.pr === 'number' ? o.pr : null }
  } catch {
    return null
  }
}

export function lerPergunta(textoDoArquivo: string): PerguntaDoKit | null {
  try {
    const o = JSON.parse(textoDoArquivo) as Record<string, unknown>
    const id = texto(o.id)
    if (!id) return null

    return { id, estado: texto(o.estado), sessao: texto(o.sessao), item: texto(o.item) }
  } catch {
    return null
  }
}

const ROTULO_ETAPA: Record<string, string> = {
  planejamento: 'planejamento',
  execucao: 'execução',
  revisao: 'revisão',
  pr: 'PR aberto',
  feito: 'feito',
  parado: 'parado',
  descartado: 'descartado',
}

export const ICONE: Record<StatusDaSessao, string> = { trabalhando: '●', aguarda: '◐', parada: '○', mergeado: '✓' }
export const COR: Record<StatusDaSessao, 'success' | 'warning' | 'inactive' | 'merged'> = {
  trabalhando: 'success',
  aguarda: 'warning',
  parada: 'inactive',
  mergeado: 'merged',
}
export const ROTULO_STATUS: Record<StatusDaSessao, string> = {
  trabalhando: 'trabalhando',
  aguarda: 'aguarda você',
  parada: 'parada',
  mergeado: 'PR mergeado',
}

/** Rodando vence tudo; depois a pergunta aberta; depois o PR mergeado; senão, parada. */
export function statusDe(s: SessaoDoApp, temPergunta: boolean): StatusDaSessao {
  if (s.isRunning) return 'trabalhando'
  if (temPergunta) return 'aguarda'
  if (s.prState === 'MERGED') return 'mergeado'

  return 'parada'
}

/** `agora`, `há 40 s`, `há 3 min`, `há 2 h`, `há 3 d`. Data inválida ou no futuro distante: `—`. */
export function haQuanto(iso: string | undefined, agora: number): string {
  const ms = iso ? Date.parse(iso) : NaN
  if (Number.isNaN(ms)) return '—'
  const s = Math.max(0, Math.floor((agora - ms) / 1000))
  if (s < 10) return 'agora'
  if (s < 60) return `há ${s} s`
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86_400) return `há ${Math.floor(s / 3600)} h`

  return `há ${Math.floor(s / 86_400)} d`
}

/** `14:05` no horário de São Paulo (UTC−3). */
export const relogioSP = (ms: number): string => new Date(ms - 3 * 3_600_000).toISOString().slice(11, 16)

/** Há quanto tempo a sessão existe: `12 min`, `3 h 05`, `2 d`. */
export function idade(iso: string | undefined, agora: number): string | null {
  const ms = iso ? Date.parse(iso) : NaN
  if (Number.isNaN(ms)) return null
  const min = Math.max(0, Math.floor((agora - ms) / 60_000))
  if (min < 60) return `${min} min`
  if (min < 1440) return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`

  return `${Math.floor(min / 1440)} d`
}

/**
 * As linhas do pane: as sessões do projeto, sem as arquivadas, cada uma com o item do kit que ela é dona e se há
 * pergunta aberta dela. Ordem: aguarda, trabalhando, parada, mergeado; dentro, a atividade mais recente primeiro.
 */
export function linhasDoPainel(
  sessoes: readonly SessaoDoApp[],
  itens: readonly ItemDoKit[],
  perguntas: readonly PerguntaDoKit[],
  projeto: string | null,
  propria: string | null,
  agora: number,
): LinhaDeSessao[] {
  const abertas = perguntas.filter(p => p.estado === 'aberta')
  const vistos = new Set<string>()
  const linhas: Array<LinhaDeSessao & { ultima: number }> = []
  for (const s of sessoes) {
    if (s.isArchived || vistos.has(s.sessionId)) continue
    if (projeto && projetoDaPasta(s.originCwd ?? s.cwd) !== projeto) continue
    vistos.add(s.sessionId)
    const item = itens.find(i => i.sessao === s.sessionId)
    const temPergunta = abertas.some(p => p.sessao === s.sessionId || (item !== undefined && p.item === item.id))
    const status = statusDe(s, temPergunta)
    const pr = s.prNumber ?? item?.pr ?? undefined
    const detalhes = [
      item?.etapa ? (ROTULO_ETAPA[item.etapa] ?? item.etapa) : null,
      pr ? `PR #${pr}${s.prState && s.prState !== 'MERGED' ? ` ${s.prState.toLowerCase()}` : ''}` : null,
    ].filter((x): x is string => x !== null)
    const id = idade(s.createdAt, agora)
    linhas.push({
      sessionId: s.sessionId,
      titulo: s.title ?? s.sessionId,
      status,
      icone: ICONE[status],
      detalhe: [ROTULO_STATUS[status], ...detalhes].join(' · '),
      tempo: [haQuanto(s.lastActivityAt, agora), id ? `aberta há ${id}` : null].filter(Boolean).join(' · '),
      propria: s.sessionId === propria,
      link: s.link,
      ultima: Date.parse(s.lastActivityAt ?? '') || 0,
    })
  }
  const ordem: Record<StatusDaSessao, number> = { aguarda: 0, trabalhando: 1, parada: 2, mergeado: 3 }

  return linhas
    .sort((a, b) => ordem[a.status] - ordem[b.status] || b.ultima - a.ultima)
    .map(({ ultima: _, ...l }) => l)
}
