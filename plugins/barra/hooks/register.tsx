import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Ausente, Botao, Cache } from '../types'
import {
  CACHE_TTL_MS,
  CONTADOR_INTERVALO_MS,
  CONTADOR_PRAZO_MS,
  FONTES_DE_SETTINGS,
  PEDIDOS_INTERVALO_MS,
  argvDesacoplado,
  lerAusente,
  lerBarraJson,
  lerContador,
  mesclarLigados,
  nivelDoCache,
  ordenarBotoes,
  pluginsLigados,
  relogio,
  rotuloComSelo,
  segundosRestantes,
  textoDoAusente,
} from './logica'
import { atenderPedidos } from './pedidos'

// A barra acima do prompt: o relógio do cache de 1 h, o botão de ausente e os botões que os outros plugins
// declaram no `barra.json`. Só arquivos e os contadores declarados; nunca `list_sessions` em laço.

const SEM_CACHE: Cache = { expiraEm: null, segundos: null }
export const cache = atom({ plugin: 'barra', key: 'cache' } as const, SEM_CACHE)
export const ausente = atom({ plugin: 'barra', key: 'ausente' } as const, null as Ausente | null)
export const trocando = atom({ plugin: 'barra', key: 'trocando' } as const, false)
export const botoes = atom({ plugin: 'barra', key: 'botoes' } as const, [] as Botao[])
export const selos = atom({ plugin: 'barra', key: 'selos' } as const, {} as Record<string, number | null>)

const mensagem = (err: unknown): string => (err instanceof Error ? err.message : String(err))
const logar = ($: EngineInterface, texto: string): void => {
  void Promise.resolve($.ui.log(texto)).catch(() => undefined)
}

// O projeto (cwd do session.start): decide qual instalação `project`/`local` vale. Volta a cada session.start.
let projeto: string | null = null
let timers: Array<{ cancel: () => void }> = []
let lendo = false
let atendendo = false
let geracaoAusente = 0
let errosVistos = ''

async function pastaIchikawa($: EngineInterface): Promise<string> {
  const propria = await $.env.get('ICHIKAWA_HOME')
  if (propria) return propria.replace(/\/+$/, '')

  return `${await $.env.get('HOME')}/.claude/ichikawa`
}

async function pastaClaude($: EngineInterface): Promise<string> {
  const config = await $.env.get('CLAUDE_CONFIG_DIR')

  return config ? config.replace(/\/+$/, '') : `${await $.env.get('HOME')}/.claude`
}

async function lerSeExiste($: EngineInterface, caminho: string): Promise<string | null> {
  if (!(await $.fs.exists(caminho))) return null

  return (await $.fs.read(caminho)) as string
}

// ---- ausente ----

async function lerModo($: EngineInterface): Promise<void> {
  const geracao = geracaoAusente
  let valor: Ausente | null = null
  try {
    valor = lerAusente(await lerSeExiste($, `${await pastaIchikawa($)}/ausente.json`))
  } catch (err) {
    logar($, `ausente.json: ${mensagem(err)}`)
  }
  // Um clique durante a leitura vence: a leitura antiga não escreve por cima.
  if (geracao === geracaoAusente && !(await read($, trocando))) await update($, ausente, () => valor)
}

export async function alternarAusente($: EngineInterface): Promise<void> {
  if (await read($, trocando)) return
  const antes = await read($, ausente)
  const ligando = !(antes?.ligado ?? false)
  await update($, trocando, () => true)
  geracaoAusente++
  try {
    const agora = await $.clock.now()
    await $.fs.write(`${await pastaIchikawa($)}/ausente.json`, textoDoAusente(ligando, agora))
    await update($, ausente, () => lerAusente(textoDoAusente(ligando, agora)))
    $.ui.toast(ligando ? 'Modo ausente ligado.' : 'Modo ausente desligado.')
  } catch (err) {
    $.ui.toast(`Não consegui ${ligando ? 'ligar' : 'desligar'} o modo ausente (${mensagem(err)}).`)
  } finally {
    geracaoAusente++
    await update($, trocando, () => false)
  }
}

// ---- descoberta dos botões ----

/** Os plugins instalados e ligados neste projeto e os botões dos `barra.json` deles. */
export async function descobrir($: EngineInterface): Promise<{ botoes: Botao[]; erros: string[] }> {
  const erros: string[] = []
  let instalados: unknown = null
  try {
    const texto = await lerSeExiste($, `${await pastaClaude($)}/plugins/installed_plugins.json`)
    instalados = texto === null ? null : JSON.parse(texto)
  } catch (err) {
    erros.push(`installed_plugins.json: ${mensagem(err)}`)
  }
  const camadas = await Promise.all(
    FONTES_DE_SETTINGS.map(source => $.settings.read({ key: 'enabledPlugins', source }).catch(() => undefined)),
  )
  const achados: Botao[] = []
  for (const plugin of pluginsLigados(instalados, mesclarLigados(camadas), projeto)) {
    try {
      const texto = await lerSeExiste($, `${plugin.raiz}/barra.json`)
      if (texto === null) continue
      const lido = lerBarraJson(texto, plugin)
      achados.push(...lido.botoes)
      erros.push(...lido.erros)
    } catch (err) {
      erros.push(`${plugin.id}: barra.json: ${mensagem(err)}`)
    }
  }

  return { botoes: ordenarBotoes(achados), erros }
}

async function contar($: EngineInterface, b: Botao): Promise<number | null> {
  if (!b.contador) return null
  try {
    return lerContador(await $.process.run(b.contador, { timeoutMs: CONTADOR_PRAZO_MS, env: { CLAUDE_PLUGIN_ROOT: b.raiz } }))
  } catch {
    return null
  }
}

/** A leitura de 30 s: o ausente, os botões e os contadores. Uma por vez. */
export async function ler($: EngineInterface): Promise<void> {
  if (lendo) return
  lendo = true
  try {
    await lerModo($)
    const achado = await descobrir($)
    await update($, botoes, () => achado.botoes)
    const juntos = achado.erros.join('\n')
    if (juntos !== errosVistos) {
      errosVistos = juntos
      for (const e of achado.erros) logar($, e)
    }
    const contados = await Promise.all(achado.botoes.map(async b => [b.chave, await contar($, b)] as const))
    await update($, selos, () => Object.fromEntries(contados))
  } catch (err) {
    logar($, `leitura: ${mensagem(err)}`)
  } finally {
    lendo = false
  }
}

export async function clicar($: EngineInterface, b: Botao): Promise<void> {
  try {
    const r = await $.process.run(argvDesacoplado(b.comando), { timeoutMs: CONTADOR_PRAZO_MS, env: { CLAUDE_PLUGIN_ROOT: b.raiz } })
    if (r.exitCode !== 0) $.ui.toast(`Não consegui rodar "${b.rotulo}" (${r.stderr.trim() || `saída ${r.exitCode}`}).`)
  } catch (err) {
    $.ui.toast(`Não consegui rodar "${b.rotulo}" (${mensagem(err)}).`)
  }
}

// ---- relógios ----

async function tique($: EngineInterface): Promise<void> {
  const c = await read($, cache)
  if (c.expiraEm === null) return
  const segundos = segundosRestantes(c.expiraEm, await $.clock.now())
  if (segundos !== c.segundos) await update($, cache, x => ({ ...x, segundos }))
}

async function vezDosPedidos($: EngineInterface): Promise<void> {
  if (atendendo) return
  atendendo = true
  try {
    await atenderPedidos($, await pastaIchikawa($), (await $.env.get('CLAUDE_CODE_HOST_SESSION_ID')) || undefined)
  } catch (err) {
    logar($, `pedidos: ${mensagem(err)}`)
  } finally {
    atendendo = false
  }
}

function iniciarRelogios($: EngineInterface): void {
  for (const t of timers) t.cancel()
  timers = [
    $.clock.every(1000, () => void tique($).catch(() => undefined)),
    $.clock.every(CONTADOR_INTERVALO_MS, () => void ler($)),
    $.clock.every(PEDIDOS_INTERVALO_MS, () => void vezDosPedidos($)),
  ]
}

// ---- o desenho ----

const ROTULO_AUSENTE = (a: Ausente | null, mudando: boolean): string =>
  mudando ? '☾ Gravando…' : a?.ligado ? '☾ Estou de volta' : '☾ Ficar ausente'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    projeto = e.cwd ?? null
    iniciarRelogios($)
    await ler($)
    void vezDosPedidos($)

    return r
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if ((e as { agentId?: string }).agentId) return r
    const agora = await $.clock.now()
    await update($, cache, () => ({ expiraEm: agora + CACHE_TTL_MS, segundos: Math.ceil(CACHE_TTL_MS / 1000) }))

    return r
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const c = await read($, cache)
    const a = await read($, ausente)
    const mudando = await read($, trocando)
    const lista = await read($, botoes)
    const s = await read($, selos)
    const nivel = nivelDoCache(c.segundos, e.props.isWorking)
    const texto = `⧗ ${e.props.isWorking ? 'ativo' : relogio(c.segundos)}`
    const moldura = nivel ? { borderStyle: 'round' as const, borderColor: nivel === 'aviso' ? ('warning' as const) : ('error' as const) } : {}

    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center" paddingX={1} {...moldura}>
        {nivel === 'alerta' || nivel === 'venceu' ? <Text inverse bold>{` ${texto} `}</Text> : <Text bold={nivel === 'aviso'}>{texto}</Text>}
        <Button key="ausente" variant="secondary" dimColor={!a?.ligado} onPress={() => void alternarAusente($)}>
          {ROTULO_AUSENTE(a, mudando)}
        </Button>
        {lista.map(b => (
          <Button key={b.chave} variant="secondary" onPress={() => void clicar($, b)}>
            {rotuloComSelo(b.rotulo, s[b.chave])}
          </Button>
        ))}
      </Box>
    )
  })
}
