// As sessões do app para a página do kit: funções puras, sem `$`. O mod lê `list_sessions` (só o app o enxerga) e grava
// `sessoes-do-app.json`, que a página lê. Nada disso entra no contexto do modelo.

export const ARQUIVO_SESSOES = 'sessoes-do-app.json'
/** A leitura do app, em toda sessão aberta com a barra. */
export const SESSOES_INTERVALO_MS = 60_000
/** Arquivo gravado há menos que isto (por esta ou outra sessão): não lê o app de novo. */
export const SESSOES_FRESCO_MS = 50_000
export const SESSOES_LIMITE = 50

/** Uma entrada do `list_sessions`/`get_session`, só com o que a página usa; o resto é ignorado. */
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

/** O arquivo atual foi gravado há menos de `SESSOES_FRESCO_MS`? Arquivo ausente, ilegível ou do futuro: não. */
export function aindaFresco(atual: string | null, agora: number): boolean {
  if (atual === null) return false
  try {
    const em = Date.parse((JSON.parse(atual) as { lidoEm?: string }).lidoEm ?? '')
    return Number.isFinite(em) && em <= agora && agora - em < SESSOES_FRESCO_MS
  } catch {
    return false
  }
}

/** A própria sessão primeiro (a lista do app não a traz), sem repetir id. */
export function juntarSessoes(propria: readonly SessaoDoApp[], lista: readonly SessaoDoApp[]): SessaoDoApp[] {
  const vistos = new Set<string>()

  return [...propria, ...lista].filter(s => !vistos.has(s.sessionId) && vistos.add(s.sessionId))
}

/** O conteúdo de `sessoes-do-app.json` (contrato em docs/contratos.md). */
export const textoDoArquivo = (sessoes: readonly SessaoDoApp[], agora: number, por: string | null): string =>
  `${JSON.stringify({ lidoEm: new Date(agora).toISOString(), por, sessoes }, null, 2)}\n`
