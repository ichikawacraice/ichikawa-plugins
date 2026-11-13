// Lógica pura da barra: sem `$`, testada direto. A descoberta dos botões, a precedência dos settings,
// a troca de ${CLAUDE_PLUGIN_ROOT}, o relógio do cache, o ausente e os pedidos da página.

import type { Ausente, Botao, Pedido } from '../types'

// ---- cache de 1 h desde a última resposta ----

export const CACHE_TTL_MS = 3_600_000
export const AVISO_S = 20 * 60
export const ALERTA_S = 10 * 60

/** A moldura do cache: nunca com o turno rodando (o cache está sendo renovado); `null` sem resposta ainda. */
export function nivelDoCache(segundos: number | null, trabalhando: boolean): 'aviso' | 'alerta' | 'venceu' | null {
  if (segundos === null || trabalhando) return null
  if (segundos <= 0) return 'venceu'
  if (segundos <= ALERTA_S) return 'alerta'

  return segundos <= AVISO_S ? 'aviso' : null
}

const dois = (n: number) => String(n).padStart(2, '0')

export const relogio = (segundos: number | null): string =>
  segundos === null ? '—' : segundos <= 0 ? 'venceu' : `${dois(Math.floor(segundos / 60))}:${dois(segundos % 60)}`

export const segundosRestantes = (expiraEm: number, agora: number): number => Math.max(0, Math.ceil((expiraEm - agora) / 1000))

// ---- ausente.json ----

/** São Paulo não tem horário de verão desde 2019: o fuso é fixo em −03:00. */
const SP_OFFSET_MS = 3 * 3_600_000

/** ISO-8601 no horário de São Paulo, sem milissegundos: `2026-11-13T21:15:00-03:00`. */
export const isoSaoPaulo = (ms: number): string => `${new Date(ms - SP_OFFSET_MS).toISOString().slice(0, 19)}-03:00`

/** O contrato: sem arquivo, ou `ligado` diferente de `true`, é presente. JSON inválido lança. */
export function lerAusente(texto: string | null): Ausente {
  if (texto === null) return { ligado: false }
  const v = JSON.parse(texto) as unknown
  if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new Error('ausente.json não é um objeto JSON')
  const o = v as Record<string, unknown>

  return { ligado: o.ligado === true, ...(typeof o.desde === 'string' ? { desde: o.desde } : {}) }
}

/** O que a barra grava ao trocar o modo: `desde` é o momento da troca. */
export const textoDoAusente = (ligado: boolean, agora: number): string =>
  `${JSON.stringify({ ligado, desde: isoSaoPaulo(agora), por: 'barra' }, null, 2)}\n`

// ---- quais plugins estão instalados e ligados ----

/** As fontes de settings, da menor para a maior precedência (a ordem do Claude Code). */
export const FONTES_DE_SETTINGS = ['user', 'project', 'local', 'flag', 'policy'] as const

/**
 * `enabledPlugins` de cada fonte, da menor para a maior precedência: a última que diz `true`/`false` vence, chave a chave.
 * Valor que não é booleano é ignorado (não liga nem desliga).
 */
export function mesclarLigados(camadas: ReadonlyArray<unknown>): Record<string, boolean> {
  const fim: Record<string, boolean> = {}
  for (const camada of camadas) {
    if (camada === null || typeof camada !== 'object' || Array.isArray(camada)) continue
    for (const [id, v] of Object.entries(camada as Record<string, unknown>)) {
      if (typeof v === 'boolean') fim[id] = v
    }
  }

  return fim
}

type Instalacao = { scope?: unknown; projectPath?: unknown; installPath?: unknown }

const semBarraFinal = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p)

/**
 * A instalação que vale neste projeto: a `local` ou `project` cujo `projectPath` é o projeto, senão a `user`, senão a `managed`.
 * Instalação de outro projeto não vale aqui.
 */
export function instalacaoAqui(entradas: unknown, projeto: string | null): string | null {
  if (!Array.isArray(entradas)) return null
  const lista = entradas.filter((x): x is Instalacao => x !== null && typeof x === 'object' && typeof (x as Instalacao).installPath === 'string')
  const doProjeto = (scope: string) =>
    lista.find(x => x.scope === scope && projeto !== null && typeof x.projectPath === 'string' && semBarraFinal(x.projectPath) === semBarraFinal(projeto))
  const escolhida = doProjeto('local') ?? doProjeto('project') ?? lista.find(x => x.scope === 'user') ?? lista.find(x => x.scope === 'managed')

  return escolhida ? semBarraFinal(escolhida.installPath as string) : null
}

export type PluginLigado = { id: string; raiz: string }

/** `installed_plugins.json` (formato `{ version, plugins: { "<nome>@<marketplace>": [instalações] } }`) cruzado com os ligados. */
export function pluginsLigados(instalados: unknown, ligados: Record<string, boolean>, projeto: string | null): PluginLigado[] {
  const plugins = (instalados as { plugins?: unknown } | null)?.plugins
  if (plugins === null || typeof plugins !== 'object' || Array.isArray(plugins)) return []

  return Object.entries(plugins as Record<string, unknown>)
    .filter(([id]) => ligados[id] === true)
    .map(([id, entradas]) => ({ id, raiz: instalacaoAqui(entradas, projeto) }))
    .filter((p): p is PluginLigado => p.raiz !== null)
    .sort((a, b) => a.id.localeCompare(b.id))
}

// ---- barra.json ----

export const ORDEM_PADRAO = 100
const ID_DO_BOTAO = /^[A-Za-z0-9_-]{1,40}$/
const MARCA_DA_RAIZ = '${CLAUDE_PLUGIN_ROOT}'

/** Troca `${CLAUDE_PLUGIN_ROOT}` pela pasta do plugin dono, em cada argumento (sem shell: nada mais é interpretado). */
export const trocarRaiz = (argv: readonly string[], raiz: string): string[] => argv.map(a => a.split(MARCA_DA_RAIZ).join(raiz))

const ehArgv = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length > 0 && v.every(a => typeof a === 'string') && (v[0] as string).trim() !== ''

/** Lê o `barra.json` de um plugin: os botões válidos, com a raiz trocada, e um erro por botão recusado. */
export function lerBarraJson(texto: string, plugin: PluginLigado): { botoes: Botao[]; erros: string[] } {
  const erros: string[] = []
  let v: unknown
  try {
    v = JSON.parse(texto)
  } catch (err) {
    return { botoes: [], erros: [`${plugin.id}: barra.json não é JSON (${err instanceof Error ? err.message : String(err)})`] }
  }
  const lista = (v as { botoes?: unknown } | null)?.botoes
  if (!Array.isArray(lista)) return { botoes: [], erros: [`${plugin.id}: barra.json sem a lista "botoes"`] }
  const botoes: Botao[] = []
  const vistos = new Set<string>()
  lista.forEach((b: unknown, i) => {
    const o = (b ?? {}) as Record<string, unknown>
    const onde = `${plugin.id}: botão ${typeof o.id === 'string' ? o.id : `#${i + 1}`}`
    if (typeof o.id !== 'string' || !ID_DO_BOTAO.test(o.id)) return void erros.push(`${onde}: "id" inválido`)
    if (vistos.has(o.id)) return void erros.push(`${onde}: "id" repetido`)
    if (typeof o.rotulo !== 'string' || o.rotulo.trim() === '') return void erros.push(`${onde}: sem "rotulo"`)
    if (!ehArgv(o.comando)) return void erros.push(`${onde}: "comando" não é uma lista de textos`)
    if (o.contador !== undefined && !ehArgv(o.contador)) return void erros.push(`${onde}: "contador" não é uma lista de textos`)
    vistos.add(o.id)
    botoes.push({
      chave: `${plugin.id}/${o.id}`,
      plugin: plugin.id,
      raiz: plugin.raiz,
      rotulo: o.rotulo.trim(),
      ...(typeof o.dica === 'string' ? { dica: o.dica } : {}),
      comando: trocarRaiz(o.comando, plugin.raiz),
      ...(o.contador !== undefined ? { contador: trocarRaiz(o.contador as string[], plugin.raiz) } : {}),
      ordem: typeof o.ordem === 'number' && Number.isFinite(o.ordem) ? o.ordem : ORDEM_PADRAO,
    })
  })

  return { botoes, erros }
}

/** Menor `ordem` à esquerda; empate pelo plugin e depois pelo id. */
export const ordenarBotoes = (botoes: readonly Botao[]): Botao[] =>
  [...botoes].sort((a, b) => a.ordem - b.ordem || a.chave.localeCompare(b.chave))

export const CONTADOR_INTERVALO_MS = 30_000
export const CONTADOR_PRAZO_MS = 3_000

/** A saída do contador: um inteiro sozinho (espaços em volta aceitos); qualquer outra coisa é sem selo. */
export function lerContador(saida: { exitCode: number; stdout: string }): number | null {
  if (saida.exitCode !== 0) return null
  const m = /^\s*(-?\d{1,9})\s*$/.exec(saida.stdout)

  return m ? Number(m[1]) : null
}

/** O rótulo com o selo; zero ou sem número, só o rótulo. */
export const rotuloComSelo = (rotulo: string, selo: number | null | undefined): string =>
  typeof selo === 'number' && selo !== 0 ? `${rotulo} · ${selo}` : rotulo

/**
 * O argv que roda o comando desacoplado: o `sh` só recebe o argv como "$@" (nenhum argumento é interpretado pelo shell),
 * põe o processo em segundo plano com a saída descartada e sai na hora. Assim a barra não espera, e um recarregamento
 * do mod não mata o processo (o `$.process.spawn` mataria).
 */
export const argvDesacoplado = (comando: readonly string[]): string[] => [
  '/bin/sh',
  '-c',
  'nohup "$@" </dev/null >/dev/null 2>&1 &',
  'barra',
  ...comando,
]

// ---- pedidos da página (pedidos/<uuid>.json) ----

export const PEDIDOS_INTERVALO_MS = 5_000
export const PEDIDO_VALE_MS = 30 * 60_000
/** Arquivo que não se lê como JSON e é mais novo que isto pode estar sendo gravado: espera a próxima volta. */
export const PEDIDO_GRAVANDO_MS = 10_000
export const NOME_DO_PEDIDO = /^[A-Za-z0-9_-]{1,80}\.json$/
const SESSAO = /^local_[A-Za-z0-9-]{1,80}$/

/** Valida um pedido: devolve o pedido ou o motivo da recusa. */
export function lerPedido(texto: string, agora: number): { pedido: Pedido } | { motivo: string } {
  let v: unknown
  try {
    v = JSON.parse(texto)
  } catch {
    return { motivo: 'não é JSON' }
  }
  const o = (v ?? {}) as Record<string, unknown>
  if (o.tipo !== 'abrir-sessao' && o.tipo !== 'responder') return { motivo: `tipo desconhecido: ${String(o.tipo)}` }
  if (typeof o.sessao !== 'string' || !SESSAO.test(o.sessao)) return { motivo: 'sessao inválida' }
  if (o.tipo === 'responder' && (typeof o.texto !== 'string' || o.texto.trim() === '')) return { motivo: 'responder sem texto' }
  const criado = typeof o.criadoEm === 'string' ? Date.parse(o.criadoEm) : Number.NaN
  if (Number.isNaN(criado)) return { motivo: 'criadoEm inválido' }
  if (agora - criado > PEDIDO_VALE_MS) return { motivo: 'vencido (mais de 30 min)' }

  return {
    pedido: o.tipo === 'responder'
      ? { tipo: 'responder', sessao: o.sessao, texto: o.texto as string, criadoEm: o.criadoEm as string }
      : { tipo: 'abrir-sessao', sessao: o.sessao, criadoEm: o.criadoEm as string },
  }
}
