import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { TestBody } from 'claude-code/testing'

// HOME temporário em memória: nada toca o ~/.claude real.
const HOME = '/tmp/home-teste'
const ICH = `${HOME}/.claude/ichikawa`
const INSTALADOS = `${HOME}/.claude/plugins/installed_plugins.json`
const PROJETO = '/work/projeto'
const ORQ = `${HOME}/.claude/plugins/cache/ichikawa/orquestracao/1.0.0`
const CONTAS = `${HOME}/.claude/plugins/cache/ichikawa/contas/1.0.0`
const EU = 'local_eu'
const AGORA = Date.UTC(2026, 10, 14, 0, 15)

type Rodada = { exitCode: number; stdout?: string; stderr?: string }
type Opcoes = {
  arquivos?: Record<string, string>
  settings?: Partial<Record<'user' | 'project' | 'local' | 'flag' | 'policy', Record<string, unknown>>>
  contador?: (argv: string[]) => Rodada | 'trava'
  ferramenta?: (tool: string, e: Record<string, unknown>) => { text?: string; isError?: boolean; deny?: string }
  mvFalha?: boolean
  env?: Record<string, string>
}

const BARRA_JSON_ORQ = JSON.stringify({
  botoes: [{ id: 'perguntas', rotulo: 'Perguntas', comando: ['node', '${CLAUDE_PLUGIN_ROOT}/bin/perguntas.mjs', 'pagina', '--abrir'], contador: ['node', '${CLAUDE_PLUGIN_ROOT}/bin/perguntas.mjs', 'contar'], ordem: 20 }],
})
const BARRA_JSON_CONTAS = JSON.stringify({ botoes: [{ id: 'contas', rotulo: 'Contas', comando: ['node', '${CLAUDE_PLUGIN_ROOT}/bin/contas.mjs'], ordem: 10 }] })
const INSTALADOS_JSON = JSON.stringify({
  version: 2,
  plugins: {
    'orquestracao@ichikawa': [{ scope: 'user', installPath: ORQ, version: '1.0.0' }],
    'contas@ichikawa': [{ scope: 'project', projectPath: PROJETO, installPath: CONTAS, version: '1.0.0' }],
  },
})

function motor(on: On, opc: Opcoes = {}) {
  const arquivos = new Map<string, string>(Object.entries({
    [INSTALADOS]: INSTALADOS_JSON,
    [`${ORQ}/barra.json`]: BARRA_JSON_ORQ,
    [`${CONTAS}/barra.json`]: BARRA_JSON_CONTAS,
    ...opc.arquivos,
  }))
  const settings = opc.settings ?? { user: { enabledPlugins: { 'orquestracao@ichikawa': true } }, project: { enabledPlugins: { 'contas@ichikawa': true } } }
  const relogio = mock.clock(on, { now: AGORA })
  mock.env(on, { HOME, CLAUDE_CODE_HOST_SESSION_ID: EU, ...opc.env })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  const toasts: string[] = []
  on('ui.toast', (_, e) => {
    toasts.push(String((e as unknown as { message?: string; text?: string }).message ?? (e as unknown as { text?: string }).text))
    return { value: undefined }
  })
  const logs: string[] = []
  on('ui.log', (_, e) => {
    logs.push(JSON.stringify(e))
    return { value: undefined }
  })
  on('settings.read', (_, e) => ({ value: (e.source ? settings[e.source] : {}) ?? {} }) as never)
  const filhos = (dir: string) => [...arquivos.keys()].filter(k => k.startsWith(`${dir}/`) && !k.slice(dir.length + 1).includes('/'))
  on('fs.exists', (_, e) => ({ value: arquivos.has(e.path) || [...arquivos.keys()].some(k => k.startsWith(`${e.path}/`)) }))
  on('fs.list', (_, e) => ({ value: filhos(e.path ?? '').map(k => ({ name: k.slice((e.path ?? '').length + 1), kind: 'file' as const, size: 1, mtimeMs: 0, isLink: false })) }))
  on('fs.read', (_, e) => {
    const t = arquivos.get(e.path)
    if (t === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: t }
  })
  on('fs.write', (_, e) => {
    arquivos.set(e.path, e.text)
    return { value: undefined }
  })
  const rodadas: string[][] = []
  const ok = (r: Rodada) => ({ value: { exitCode: r.exitCode, stdout: r.stdout ?? '', stderr: r.stderr ?? '', isStdoutTruncated: false, isStderrTruncated: false } })
  on('process.run', (_, e) => {
    const argv = [...e.argv]
    rodadas.push(argv)
    if (argv[0] === 'mkdir') return ok({ exitCode: 0 })
    if (argv[0] === 'mv') {
      const t = arquivos.get(argv[1] as string)
      if (opc.mvFalha || t === undefined) return ok({ exitCode: 1, stderr: 'No such file' })
      arquivos.delete(argv[1] as string)
      arquivos.set(argv[2] as string, t)
      return ok({ exitCode: 0 })
    }
    if (argv[0] === 'rm') {
      for (const a of argv.slice(2)) arquivos.delete(a)
      return ok({ exitCode: 0 })
    }
    if (argv[0] === '/bin/sh') return ok({ exitCode: 0 })
    const r = opc.contador?.(argv) ?? { exitCode: 0, stdout: '3\n' }
    if (r === 'trava') throw new Error('timeout')
    return ok(r)
  })
  const chamadas: Array<Record<string, unknown>> = []
  on('tool.call', (_, e) => {
    const entrada = e as unknown as Record<string, unknown>
    chamadas.push(entrada)
    const r = opc.ferramenta?.(e.tool, entrada) ?? { text: 'delivered' }
    if (r.deny !== undefined) return { deny: r.deny }
    return r.isError ? { result: {}, text: r.text, isError: true as const } : { result: {}, text: r.text }
  })
  const prompts: string[] = []
  on('prompt.submit', (_, e) => {
    prompts.push(e.text)
    return { text: e.text }
  })

  return { arquivos, relogio, toasts, logs, rodadas, chamadas, prompts }
}

async function iniciar($: Parameters<TestBody>[0], on: On, opc: Opcoes = {}) {
  const m = motor(on, opc)
  await $.session.start({ cwd: PROJETO, surface: 'desktop', isInteractive: true })
  await m.relogio.settle()
  return m
}

const BARRA = {
  plugin: 'barra',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isCollapsed: false, isWorking: false, maxRows: 20, bodyColumns: 120, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const
const SUPERFICIES = ['terminal', 'desktop'] as const
const montar = ($: Parameters<TestBody>[0], surface: (typeof SUPERFICIES)[number], props: Record<string, unknown> = {}) =>
  $.ui.mount({ ...BARRA, surface, props: { ...BARRA.props, ...props } } as never)
const textos = async (ui: { findAll: (q: object) => Promise<Array<{ text: string }>> }) => (await ui.findAll({})).map(x => x.text).join('\n')
const turno = (extra: Record<string, unknown> = {}) => ({ answer: 'ok', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', ...extra }) as never

// ---- cache ----

test('cache: — sem resposta; 60:00 depois de um turno principal; o de subagente não reinicia; conta para baixo', async ($, on) => {
  const m = await iniciar($, on)
  for (const surface of SUPERFICIES) {
    const ui = await montar($, surface)
    expect(await textos(ui)).toMatch(/⧗ —/)
    await ui.unmount()
  }
  await $.turn.complete(turno({ agentId: 'sub' }))
  await m.relogio.settle()
  let ui = await montar($, 'terminal')
  expect(await textos(ui)).toMatch(/⧗ —/)
  await ui.unmount()
  await $.turn.complete(turno())
  await m.relogio.settle()
  for (const surface of SUPERFICIES) {
    const u = await montar($, surface)
    expect(await textos(u)).toMatch(/⧗ 60:00/)
    await u.unmount()
  }
  await m.relogio.advance(61_000)
  ui = await montar($, 'terminal')
  expect(await textos(ui)).toMatch(/⧗ 58:59/)
  await ui.unmount()
  ui = await montar($, 'terminal', { isWorking: true })
  expect(await textos(ui), 'com o turno rodando').toMatch(/⧗ ativo/)
  await ui.unmount()
})

// ---- botões de outros plugins ----

test('botões: os dois plugins ligados aparecem na ordem do barra.json, com o selo do contador', async ($, on) => {
  const m = await iniciar($, on)
  for (const surface of SUPERFICIES) {
    const ui = await montar($, surface)
    const t = await textos(ui)
    expect(t).toMatch(/Ficar ausente/)
    expect(t).toMatch(/Contas/)
    expect(t).toMatch(/Perguntas · 3/)
    expect(t.indexOf('Ficar ausente'), 'os próprios da barra vêm antes').toBeLessThan(t.indexOf('Contas'))
    expect(t.indexOf('Contas'), 'ordem 10 antes da 20').toBeLessThan(t.indexOf('Perguntas'))
    await ui.unmount()
  }
  expect(m.rodadas.some(a => a[0] === 'node' && a[1] === `${ORQ}/bin/perguntas.mjs` && a[2] === 'contar'), 'o contador roda com a raiz trocada').toBe(true)
})

test('botões: plugin desligado numa fonte de maior precedência não aparece', async ($, on) => {
  await iniciar($, on, {
    settings: {
      user: { enabledPlugins: { 'orquestracao@ichikawa': true } },
      project: { enabledPlugins: { 'contas@ichikawa': true } },
      local: { enabledPlugins: { 'orquestracao@ichikawa': false } },
    },
  })
  const ui = await montar($, 'desktop')
  const t = await textos(ui)
  expect(t).toMatch(/Contas/)
  expect(t).not.toMatch(/Perguntas/)
  await ui.unmount()
})

test('botões: instalação de projeto vale só no próprio projeto', async ($, on) => {
  motor(on)
  await $.session.start({ cwd: '/work/outro', surface: 'desktop', isInteractive: true })
  const ui = await montar($, 'desktop')
  const t = await textos(ui)
  expect(t).toMatch(/Perguntas/)
  expect(t).not.toMatch(/Contas/)
  await ui.unmount()
})

test('botões: o clique roda o comando desacoplado, com a raiz trocada', async ($, on) => {
  const m = await iniciar($, on)
  const ui = await montar($, 'desktop')
  await ui.press({ key: 'orquestracao@ichikawa/perguntas' })
  const sh = m.rodadas.find(a => a[0] === '/bin/sh')
  expect(sh?.slice(4)).toEqual(['node', `${ORQ}/bin/perguntas.mjs`, 'pagina', '--abrir'])
  expect(m.toasts).toEqual([])
  await ui.unmount()
})

const BARRA_JSON_COM_URL = JSON.stringify({
  botoes: [{ id: 'perguntas', rotulo: 'Perguntas', comando: ['node', '${CLAUDE_PLUGIN_ROOT}/lib/cli.mjs', 'pagina', '--subir'], url: 'http://127.0.0.1:4747', ordem: 20 }],
})

test('botões: com url, espera o comando subir a página e abre no navegador do app', async ($, on) => {
  const m = await iniciar($, on, { arquivos: { [`${ORQ}/barra.json`]: BARRA_JSON_COM_URL } })
  const ui = await montar($, 'desktop')
  await ui.press({ key: 'orquestracao@ichikawa/perguntas' })
  expect(m.rodadas).toContainEqual(['node', `${ORQ}/lib/cli.mjs`, 'pagina', '--subir'])
  expect(m.rodadas.find(a => a[0] === '/bin/sh')).toBeUndefined()
  const navegador = m.chamadas.find(c => c.tool === 'mcp__Claude_Browser__preview_start')
  expect(navegador?.url).toBe('http://127.0.0.1:4747')
  expect(m.rodadas.find(a => a[0] === 'open')).toBeUndefined()
  expect(m.toasts).toEqual([])
  await ui.unmount()
})

test('botões: com url e sem o navegador do app (terminal), abre no navegador do sistema', async ($, on) => {
  const m = await iniciar($, on, {
    arquivos: { [`${ORQ}/barra.json`]: BARRA_JSON_COM_URL },
    ferramenta: tool => {
      if (tool === 'mcp__Claude_Browser__preview_start') throw new Error('no tool named mcp__Claude_Browser__preview_start')
      return { text: 'ok' }
    },
  })
  const ui = await montar($, 'terminal')
  await ui.press({ key: 'orquestracao@ichikawa/perguntas' })
  expect(m.rodadas).toContainEqual(['open', 'http://127.0.0.1:4747'])
  expect(m.toasts).toEqual([])
  await ui.unmount()
})

test('botões: com url, comando que falha não abre navegador e avisa', async ($, on) => {
  const m = await iniciar($, on, {
    arquivos: { [`${ORQ}/barra.json`]: BARRA_JSON_COM_URL },
    contador: argv => (argv.includes('--subir') ? { exitCode: 1, stderr: 'porta ocupada' } : { exitCode: 0, stdout: '3' }),
  })
  const ui = await montar($, 'desktop')
  await ui.press({ key: 'orquestracao@ichikawa/perguntas' })
  expect(m.chamadas.find(c => c.tool === 'mcp__Claude_Browser__preview_start')).toBeUndefined()
  expect(m.toasts.join('\n')).toMatch(/porta ocupada/)
  await ui.unmount()
})

test('botões: contador que falha ou trava fica sem selo, e o botão segue', async ($, on) => {
  await iniciar($, on, { contador: () => 'trava' })
  const ui = await montar($, 'terminal')
  const t = await textos(ui)
  expect(t).toMatch(/Perguntas/)
  expect(t).not.toMatch(/Perguntas ·/)
  await ui.unmount()
})

test('botões: o contador roda de novo só depois de 30 s', async ($, on) => {
  const m = await iniciar($, on)
  const contagens = () => m.rodadas.filter(a => a[2] === 'contar').length
  const antes = contagens()
  await m.relogio.advance(29_000)
  expect(contagens()).toBe(antes)
  await m.relogio.advance(1_000)
  expect(contagens()).toBe(antes + 1)
})

// ---- ausente ----

test('ausente: o clique liga gravando o contrato, e o seguinte desliga', async ($, on) => {
  const m = await iniciar($, on)
  for (const surface of SUPERFICIES) {
    const ui = await montar($, surface)
    expect(await textos(ui)).toMatch(/Ficar ausente/)
    await ui.unmount()
  }
  let ui = await montar($, 'desktop')
  await ui.press({ key: 'ausente' })
  await ui.unmount()
  expect(JSON.parse(m.arquivos.get(`${ICH}/ausente.json`) as string)).toEqual({ ligado: true, desde: '2026-11-13T21:15:00-03:00', por: 'barra' })
  ui = await montar($, 'desktop')
  expect(await textos(ui)).toMatch(/Estou de volta/)
  await ui.press({ key: 'ausente' })
  await ui.unmount()
  expect(JSON.parse(m.arquivos.get(`${ICH}/ausente.json`) as string).ligado).toBe(false)
  ui = await montar($, 'terminal')
  expect(await textos(ui)).toMatch(/Ficar ausente/)
  await ui.unmount()
})

test('ausente: o arquivo gravado por outra sessão aparece na leitura de 30 s', async ($, on) => {
  const m = await iniciar($, on)
  m.arquivos.set(`${ICH}/ausente.json`, '{"ligado": true, "desde": "2026-11-13T20:00:00-03:00", "por": "orquestracao"}')
  await m.relogio.advance(30_000)
  const ui = await montar($, 'desktop')
  expect(await textos(ui)).toMatch(/Estou de volta/)
  await ui.unmount()
})

test('ausente: ICHIKAWA_HOME troca a pasta', async ($, on) => {
  const m = await iniciar($, on, { env: { ICHIKAWA_HOME: '/tmp/outra/' } })
  const ui = await montar($, 'desktop')
  await ui.press({ key: 'ausente' })
  await ui.unmount()
  expect(m.arquivos.has('/tmp/outra/ausente.json')).toBe(true)
})

// ---- pedidos da página ----

const pedido = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({ tipo: 'responder', sessao: 'local_outra', texto: 'Pode apagar.', criadoEm: new Date(AGORA - 60_000).toISOString(), ...extra })

test('pedidos: responder a outra sessão manda send_message e apaga o pedido', async ($, on) => {
  const m = await iniciar($, on, { arquivos: { [`${ICH}/pedidos/p1.json`]: pedido() } })
  await m.relogio.advance(5_000)
  const envio = m.chamadas.find(c => c.tool === 'mcp__ccd_session_mgmt__send_message')
  expect(envio?.session_id).toBe('local_outra')
  expect(envio?.message).toBe('Pode apagar.')
  expect(m.rodadas.some(a => a[0] === 'mv' && a[2] === `${ICH}/pedidos/tomados/p1.json`), 'tomou por mv').toBe(true)
  expect([...m.arquivos.keys()].filter(k => k.includes('/pedidos/'))).toEqual([])
})

test('pedidos: responder à própria sessão vira prompt, sem send_message', async ($, on) => {
  const m = await iniciar($, on, { arquivos: { [`${ICH}/pedidos/p1.json`]: pedido({ sessao: EU }) } })
  await m.relogio.advance(5_000)
  expect(m.prompts).toEqual(['Pode apagar.'])
  expect(m.chamadas.some(c => c.tool === 'mcp__ccd_session_mgmt__send_message')).toBe(false)
})

test('pedidos: outra sessão tomou antes (mv falha): nada é enviado', async ($, on) => {
  const m = await iniciar($, on, { arquivos: { [`${ICH}/pedidos/p1.json`]: pedido() }, mvFalha: true })
  await m.relogio.advance(5_000)
  expect(m.chamadas.length).toBe(0)
  expect(m.prompts.length).toBe(0)
})

test('pedidos: vencido ou inválido vai para falhos com o motivo, sem executar', async ($, on) => {
  const m = await iniciar($, on, {
    arquivos: {
      [`${ICH}/pedidos/velho.json`]: pedido({ criadoEm: new Date(AGORA - 31 * 60_000).toISOString() }),
      [`${ICH}/pedidos/ruim.json`]: pedido({ tipo: 'apagar' }),
    },
  })
  await m.relogio.advance(5_000)
  expect(m.chamadas.length).toBe(0)
  expect(JSON.parse(m.arquivos.get(`${ICH}/pedidos/falhos/velho.json`) as string).motivo).toBe('vencido (mais de 30 min)')
  expect(JSON.parse(m.arquivos.get(`${ICH}/pedidos/falhos/ruim.json`) as string).motivo).toMatch(/tipo desconhecido/)
  expect(m.arquivos.has(`${ICH}/pedidos/tomados/velho.json`)).toBe(false)
})

test('pedidos: envio recusado vai para falhos com o texto do app', async ($, on) => {
  const m = await iniciar($, on, {
    arquivos: { [`${ICH}/pedidos/p1.json`]: pedido() },
    ferramenta: () => ({ isError: true, text: 'session not found' }),
  })
  await m.relogio.advance(5_000)
  expect(JSON.parse(m.arquivos.get(`${ICH}/pedidos/falhos/p1.json`) as string).motivo).toBe('session not found')
})

test('pedidos: abrir-sessao chama open_session_in com focus ("self" quando é a própria)', async ($, on) => {
  const criadoEm = new Date(AGORA - 1000).toISOString()
  const m = await iniciar($, on, {
    arquivos: {
      [`${ICH}/pedidos/a.json`]: JSON.stringify({ tipo: 'abrir-sessao', sessao: 'local_outra', criadoEm }),
      [`${ICH}/pedidos/b.json`]: JSON.stringify({ tipo: 'abrir-sessao', sessao: EU, criadoEm }),
    },
  })
  await m.relogio.advance(5_000)
  const aberturas = m.chamadas.filter(c => c.tool === 'mcp__ccd_window__open_session_in').map(c => `${c.session_id}:${c.target}`)
  expect(aberturas.sort()).toEqual(['local_outra:focus', 'self:focus'])
})

test('pedidos: sem a pasta não lê nada além de conferir que ela não existe', async ($, on) => {
  const m = await iniciar($, on)
  const antes = m.rodadas.length
  await m.relogio.advance(5_000)
  expect(m.rodadas.filter(a => a[0] === 'mv' || a[0] === 'mkdir').length).toBe(0)
  expect(m.rodadas.length).toBe(antes)
})
