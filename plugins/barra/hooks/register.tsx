import { atom, read, update } from 'claude-code'
import type { ElementConstructor, EngineInterface, Register, SvgProps } from 'claude-code'

import type { Ausente, Botao, Cache, LinhaDeSessao, Painel } from '../types'
import {
  CACHE_TTL_MS,
  COMANDO_COM_URL_PRAZO_MS,
  CONTADOR_INTERVALO_MS,
  CONTADOR_PRAZO_MS,
  FERRAMENTA_NAVEGADOR_DO_APP,
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
import {
  CICLO_CINTILA,
  COR_BOTAO_TERMINAL,
  COR_BRILHO_TERMINAL,
  COR_ESTRELA_TERMINAL,
  COR_FUNDO,
  COR_TEXTO,
  PX_POR_COLUNA,
  linhaDeEstrelas,
  pedeMenosMovimento,
  svgDoCeu,
} from './ceu'
import { atenderPedidos } from './pedidos'
import {
  COR,
  PANE_SESSOES,
  SESSOES_INTERVALO_MS,
  SESSOES_LIMITE,
  TITULO_SESSOES,
  jsonDaFerramenta,
  lerItem,
  lerPergunta,
  lerSessoes,
  linhasDoPainel,
  projetoDaPasta,
  relogioSP,
} from './sessoes'
import type { ItemDoKit, PerguntaDoKit, SessaoDoApp } from './sessoes'

// A barra acima do prompt: o relógio do cache de 1 h, o botão de ausente e os botões que os outros plugins
// declaram no `barra.json`. Só arquivos e os contadores declarados; nunca `list_sessions` em laço.

const SEM_CACHE: Cache = { expiraEm: null, segundos: null }
export const cache = atom({ plugin: 'barra', key: 'cache' } as const, SEM_CACHE)
export const ausente = atom({ plugin: 'barra', key: 'ausente' } as const, null as Ausente | null)
export const trocando = atom({ plugin: 'barra', key: 'trocando' } as const, false)
export const botoes = atom({ plugin: 'barra', key: 'botoes' } as const, [] as Botao[])
export const selos = atom({ plugin: 'barra', key: 'selos' } as const, {} as Record<string, number | null>)
const PAINEL_VAZIO: Painel = { linhas: [], lidoEm: null, erro: null, lendo: false }
export const painel = atom({ plugin: 'barra', key: 'painel' } as const, PAINEL_VAZIO)
/** O quadro da cintilação do terminal; `null` = parado (menos movimento pedido). */
export const fase = atom({ plugin: 'barra', key: 'fase' } as const, null as number | null)

const mensagem = (err: unknown): string => (err instanceof Error ? err.message : String(err))
const logar = ($: EngineInterface, texto: string): void => {
  void Promise.resolve($.ui.log(texto)).catch(() => undefined)
}

// O projeto (cwd do session.start): decide qual instalação `project`/`local` vale. Volta a cada session.start.
let projeto: string | null = null
let timers: Array<{ cancel: () => void }> = []
let lendo = false
let lendoPainel = false
let atendendo = false
let geracaoAusente = 0
let errosVistos = ''
let semMovimento = false
const PRAZO_DEFAULTS_MS = 3000

/** Lido uma vez por session.start: a variável `BARRA_SEM_ANIMACAO` e o "Reduzir movimento" do macOS. */
async function lerMovimento($: EngineInterface): Promise<boolean> {
  let saida: string | null = null
  try {
    const r = await $.process.run(['defaults', 'read', 'com.apple.Accessibility', 'ReduceMotionEnabled'], { timeoutMs: PRAZO_DEFAULTS_MS })
    if (r.exitCode === 0) saida = r.stdout
  } catch {
    saida = null
  }

  return pedeMenosMovimento(await $.env.get('BARRA_SEM_ANIMACAO'), saida)
}

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

/**
 * Abre a página no painel de navegador do app. Sem a ferramenta (o terminal, ou o app sem o painel), cai no
 * navegador do sistema; recusa ou erro do app vira aviso.
 */
async function abrirNoApp($: EngineInterface, b: Botao, url: string): Promise<void> {
  let r: { text?: string; isError?: boolean; deny?: string }
  try {
    r = (await $.tool.call({ tool: FERRAMENTA_NAVEGADOR_DO_APP, url } as never)) as typeof r
  } catch {
    await $.process.run(['open', url], { timeoutMs: CONTADOR_PRAZO_MS })
    return
  }
  if (r.deny !== undefined) $.ui.toast(`"${b.rotulo}": o app não abriu o navegador (${r.deny || 'negado'}).`)
  else if (r.isError) $.ui.toast(`"${b.rotulo}": o app não abriu o navegador (${r.text || 'erro sem texto'}).`)
}

export async function clicar($: EngineInterface, b: Botao): Promise<void> {
  try {
    // Com `url`, o comando sobe a página e a barra espera ele terminar para abrir no navegador do app.
    const argv = b.url ? b.comando : argvDesacoplado(b.comando)
    const prazo = b.url ? COMANDO_COM_URL_PRAZO_MS : CONTADOR_PRAZO_MS
    const r = await $.process.run(argv, { timeoutMs: prazo, env: { CLAUDE_PLUGIN_ROOT: b.raiz } })
    if (r.exitCode !== 0) return void $.ui.toast(`Não consegui rodar "${b.rotulo}" (${r.stderr.trim() || `saída ${r.exitCode}`}).`)
    if (b.url) await abrirNoApp($, b, b.url)
  } catch (err) {
    $.ui.toast(`Não consegui rodar "${b.rotulo}" (${mensagem(err)}).`)
  }
}

// ---- painel de sessões ----
// Interface do mod, fora da conversa: nada entra no contexto do modelo. Só lê com o pane aberto.

/** Aberto e posto numa tela: o pane guardado sem tela (sessão fora de vista) não conta, nem para ler nem para fechar. */
export const painelAberto = async ($: EngineInterface): Promise<boolean> =>
  (await $.ui.panes()).some(p => p.id === PANE_SESSOES && p.isPlaced)

type Resposta = { text?: string; isError?: boolean; deny?: string }

async function chamar($: EngineInterface, chamada: Record<string, unknown>): Promise<Resposta> {
  return (await $.tool.call(chamada as never)) as Resposta
}

async function lerColecao<T>($: EngineInterface, pasta: string, ler: (t: string) => T | null): Promise<T[]> {
  if (!(await $.fs.exists(pasta))) return []
  const nomes = (await $.fs.list(pasta)).filter(e => e.kind === 'file' && e.name.endsWith('.json')).map(e => e.name)
  const lidos = await Promise.all(nomes.map(n => Promise.resolve($.fs.read(`${pasta}/${n}`)).then(t => ler(String(t)), () => null)))

  return lidos.filter((x): x is Awaited<T> => x !== null) as T[]
}

/** Uma leitura por vez: a lista do app, a própria sessão (que a lista não traz), os itens e as perguntas do projeto. */
export async function lerPainel($: EngineInterface): Promise<void> {
  if (lendoPainel) return
  lendoPainel = true
  await update($, painel, p => ({ ...p, lendo: true }))
  try {
    const [lista, eu] = await Promise.all([
      chamar($, { tool: 'mcp__ccd_session_mgmt__list_sessions', limit: SESSOES_LIMITE }),
      chamar($, { tool: 'mcp__ccd_session_mgmt__get_session', session_id: 'self' }).catch(() => ({}) as Resposta),
    ])
    if (lista.deny !== undefined || lista.isError) throw new Error(lista.deny || lista.text || 'a lista de sessões falhou')
    const propria = lerSessoes(jsonDaFerramenta(eu))[0] ?? null
    const sessoes: SessaoDoApp[] = [...(propria ? [propria] : []), ...lerSessoes(jsonDaFerramenta(lista))]
    const nome = projetoDaPasta(propria?.originCwd ?? projeto)
    const base = await pastaIchikawa($)
    const [itens, perguntas] = nome
      ? await Promise.all([
          lerColecao<ItemDoKit>($, `${base}/itens/${nome}`, lerItem),
          lerColecao<PerguntaDoKit>($, `${base}/perguntas/${nome}`, lerPergunta),
        ])
      : [[], []]
    const agora = await $.clock.now()
    const linhas = linhasDoPainel(sessoes, itens, perguntas, nome, propria?.sessionId ?? null, agora)
    await update($, painel, () => ({ linhas, lidoEm: agora, erro: null, lendo: false }))
  } catch (err) {
    await update($, painel, p => ({ ...p, erro: mensagem(err), lendo: false }))
  } finally {
    lendoPainel = false
  }
}

export async function alternarPainel($: EngineInterface): Promise<void> {
  if (await painelAberto($)) return void (await $.ui.close({ id: PANE_SESSOES }))
  const r = await $.ui.open({ id: PANE_SESSOES, title: TITULO_SESSOES })
  if (!r.isPlaced) logar($, `painel: sem lugar (${(r as { reason?: string }).reason ?? 'sem motivo'})`)
  await lerPainel($)
}

/** O app só põe em foco a própria sessão ou uma que esta abriu; fora disso, copia o endereço. */
export async function abrirSessao($: EngineInterface, l: LinhaDeSessao): Promise<void> {
  let porque = ''
  try {
    const r = await chamar($, { tool: 'mcp__ccd_window__open_session_in', session_id: l.propria ? 'self' : l.sessionId, target: 'focus' })
    if (r.deny === undefined && !r.isError) return
    porque = r.deny || r.text || 'recusado'
  } catch (err) {
    porque = mensagem(err)
  }
  if (!l.link) return void $.ui.toast(`Não consegui abrir "${l.titulo}" (${porque}).`)
  const c = await $.ui.copy({ text: l.link }).catch(() => undefined)
  $.ui.toast(c?.isCopied ? `Não abri daqui (${porque}): endereço de "${l.titulo}" copiado.` : `Não consegui abrir "${l.titulo}" (${porque}).`)
}

async function vezDoPainel($: EngineInterface): Promise<void> {
  if (await painelAberto($)) await lerPainel($)
}

// ---- relógios ----

async function tique($: EngineInterface): Promise<void> {
  if (!semMovimento) await update($, fase, f => ((f ?? 0) + 1) % CICLO_CINTILA)
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
    $.clock.every(SESSOES_INTERVALO_MS, () => void vezDoPainel($).catch(() => undefined)),
  ]
}

// ---- o desenho ----

const ROTULO_AUSENTE = (a: Ausente | null, mudando: boolean): string =>
  mudando ? '☾ Gravando…' : a?.ligado ? '☾ Estou de volta' : '☾ Ficar ausente'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const r = await next(e)
    projeto = e.cwd ?? null
    semMovimento = await lerMovimento($)
    await update($, fase, f => (semMovimento ? null : (f ?? 0)))
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
    const tabela = $.ui.resolve(e)
    const { Box, Text, Button } = tabela
    // O desktop (e o mobile/vscode) tem `Svg`: o céu vai desenhado e a cintilação é CSS do próprio app.
    // O terminal não tem: estrelas em caracteres, cintilando pelo relógio de 1 s. Decide pela superfície: a tabela do
    // terminal responde `'Svg' in` com um marcador vazio.
    const Svg = e.surface === 'terminal' ? null : ((tabela as { Svg?: ElementConstructor<SvgProps> }).Svg ?? null)
    const c = await read($, cache)
    const a = await read($, ausente)
    const mudando = await read($, trocando)
    const lista = await read($, botoes)
    const s = await read($, selos)
    const quadro = Svg ? null : await read($, fase)
    const nivel = nivelDoCache(c.segundos, e.props.isWorking)
    const texto = `⧗ ${e.props.isWorking ? 'ativo' : relogio(c.segundos)}`
    const moldura = nivel ? { borderStyle: 'round' as const, borderColor: nivel === 'aviso' ? ('warning' as const) : ('error' as const) } : {}
    // No terminal o rótulo leva a cor clara (o fundo agora é escuro); no desktop o botão é nativo e se pinta sozinho.
    const rotulo = (chave: string, t: string) => (Svg ? t : <Text key={chave} color={COR_BOTAO_TERMINAL}>{t}</Text>)
    const ceu = Svg ? (
      <Box key="ceu" position="absolute" top={0} left={0}>
        <Svg source={svgDoCeu((e.props.bodyColumns + 6) * PX_POR_COLUNA, semMovimento)} alt="" />
      </Box>
    ) : (
      <Box key="ceu" position="absolute" top={0} left={0}>
        <Text color={COR_ESTRELA_TERMINAL} wrap="truncate-end">
          {linhaDeEstrelas(e.props.bodyColumns, quadro)}
        </Text>
      </Box>
    )

    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={1} alignItems="center" paddingX={1} backgroundColor={COR_FUNDO} {...moldura}>
        {ceu}
        {nivel === 'alerta' || nivel === 'venceu' ? (
          <Text inverse bold>{` ${texto} `}</Text>
        ) : (
          <Text bold={nivel === 'aviso'} color={nivel === 'aviso' ? COR_BRILHO_TERMINAL : COR_TEXTO}>
            {texto}
          </Text>
        )}
        <Button key="ausente" variant="secondary" dimColor={!a?.ligado} onPress={() => void alternarAusente($)}>
          {rotulo('r-ausente', ROTULO_AUSENTE(a, mudando))}
        </Button>
        <Button key="sessoes" variant="secondary" onPress={() => void alternarPainel($)}>
          {rotulo('r-sessoes', '▦ Sessões')}
        </Button>
        {lista.map(b => (
          <Button key={b.chave} variant="secondary" onPress={() => void clicar($, b)}>
            {rotulo(`r-${b.chave}`, rotuloComSelo(b.rotulo, s[b.chave]))}
          </Button>
        ))}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE_SESSOES }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const p = await read($, painel)
    const quando = p.lidoEm === null ? '' : `lido ${relogioSP(p.lidoEm)}`

    return (
      <Box flexDirection="column" rowGap={1}>
        <Box flexDirection="row" columnGap={1} alignItems="center">
          <Text dimColor>{p.lendo ? 'lendo…' : quando}</Text>
          <Button variant="secondary" onPress={() => void lerPainel($)}>↻ Atualizar</Button>
        </Box>
        {p.erro && <Text color="error">Não li as sessões: {p.erro}</Text>}
        {p.lidoEm !== null && p.linhas.length === 0 && <Text dimColor>Nenhuma sessão aberta neste projeto.</Text>}
        {p.linhas.map(l => (
          <Box flexDirection="row" columnGap={1}>
            <Text color={COR[l.status]} bold>{l.icone}</Text>
            <Box flexDirection="column" flexGrow={1} flexShrink={1}>
              <Button key={l.sessionId} variant="secondary" onPress={() => void abrirSessao($, l)}>
                {l.propria ? `${l.titulo} (esta)` : l.titulo}
              </Button>
              <Text dimColor wrap="truncate-end">{l.detalhe}</Text>
              <Text dimColor wrap="truncate-end">{l.tempo}</Text>
            </Box>
          </Box>
        ))}
      </Box>
    )
  })
}
