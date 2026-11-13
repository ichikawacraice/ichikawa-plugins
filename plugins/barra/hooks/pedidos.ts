// Os pedidos da página de perguntas: a página (servidor local, sem as ferramentas do app) grava
// `pedidos/<uuid>.json`; o mod de qualquer sessão viva toma o pedido (mv atômico para `tomados/`),
// executa e apaga; falha vai para `falhos/` com o motivo. Só arquivos, no máximo a cada 5 s.

import type { EngineInterface } from 'claude-code'

import type { Pedido } from '../types'
import { NOME_DO_PEDIDO, PEDIDO_GRAVANDO_MS, lerPedido } from './logica'

const PRAZO_FS_MS = 5_000
const PRAZO_ENVIO_MS = 60_000

const mensagem = (err: unknown): string => (err instanceof Error ? err.message : String(err))

export type Pastas = { pedidos: string; tomados: string; falhos: string }

export const pastasDosPedidos = (base: string): Pastas => ({
  pedidos: `${base}/pedidos`,
  tomados: `${base}/pedidos/tomados`,
  falhos: `${base}/pedidos/falhos`,
})

/** O mv atômico (rename): de duas sessões, só uma consegue; a outra vê o arquivo sumir. */
async function tomar($: EngineInterface, p: Pastas, nome: string): Promise<boolean> {
  await $.process.run(['mkdir', '-p', p.tomados], { timeoutMs: PRAZO_FS_MS })
  const r = await $.process.run(['mv', `${p.pedidos}/${nome}`, `${p.tomados}/${nome}`], { timeoutMs: PRAZO_FS_MS })

  return r.exitCode === 0
}

async function apagar($: EngineInterface, caminho: string): Promise<void> {
  await $.process.run(['rm', '-f', caminho], { timeoutMs: PRAZO_FS_MS })
}

/** Grava o pedido em `falhos/` com o motivo e tira o original (de `pedidos/` ou de `tomados/`). */
async function falhar($: EngineInterface, p: Pastas, nome: string, origem: string, texto: string, motivo: string): Promise<void> {
  let original: unknown = texto
  try {
    original = JSON.parse(texto)
  } catch {
    /* fica o texto cru */
  }
  const agora = new Date(await $.clock.now()).toISOString()
  await $.fs.write(`${p.falhos}/${nome}`, `${JSON.stringify({ pedido: original, motivo, falhouEm: agora }, null, 2)}\n`)
  await apagar($, origem)
  await $.ui.log(`pedido ${nome}: ${motivo}`)
}

/** Executa um pedido já tomado. Devolve o motivo da falha, ou `null` se deu certo. */
export async function executar($: EngineInterface, pedido: Pedido, eu: string | undefined): Promise<string | null> {
  const propria = eu !== undefined && pedido.sessao === eu
  if (pedido.tipo === 'responder') {
    if (propria) {
      const r = await $.prompt.submit({ text: pedido.texto })

      return r.drop !== undefined ? `o prompt foi recusado (${r.drop || 'sem motivo'})` : null
    }
    const r = await $.tool.call({ tool: 'mcp__ccd_session_mgmt__send_message', session_id: pedido.sessao, message: pedido.texto })

    return r.deny !== undefined ? r.deny || 'negado' : r.isError ? r.text || 'erro sem texto' : null
  }
  // `open_session_in` só mostra a própria sessão ("self") ou uma que esta sessão abriu, e só age com esta sessão na tela.
  const r = await $.tool.call({ tool: 'mcp__ccd_window__open_session_in', session_id: propria ? 'self' : pedido.sessao, target: 'focus' })
  if (r.deny !== undefined) return r.deny || 'negado'
  if (r.isError) return r.text || 'erro sem texto'
  await $.ui.log(`abrir-sessao ${pedido.sessao}: ${r.text ?? ''}`)

  return null
}

/** Uma volta: lista `pedidos/`, toma um a um e executa. Erros de um pedido não param os outros. */
export async function atenderPedidos($: EngineInterface, base: string, eu: string | undefined): Promise<void> {
  const p = pastasDosPedidos(base)
  if (!(await $.fs.exists(p.pedidos))) return
  const agora = await $.clock.now()
  const entradas = (await $.fs.list(p.pedidos)).filter(e => e.kind === 'file' && NOME_DO_PEDIDO.test(e.name))
  for (const e of [...entradas].sort((a, b) => a.mtimeMs - b.mtimeMs)) {
    try {
      await atenderUm($, p, e.name, e.mtimeMs, agora, eu)
    } catch (err) {
      await $.ui.log(`pedido ${e.name}: ${mensagem(err)}`)
    }
  }
}

async function atenderUm($: EngineInterface, p: Pastas, nome: string, mtimeMs: number, agora: number, eu: string | undefined): Promise<void> {
  const texto = (await $.fs.read(`${p.pedidos}/${nome}`).catch(() => null)) as string | null
  if (texto === null) return
  const lido = lerPedido(texto, agora)
  // JSON ainda incompleto: a página pode estar gravando.
  if ('motivo' in lido && lido.motivo === 'não é JSON' && agora - mtimeMs < PEDIDO_GRAVANDO_MS) return
  if (!(await tomar($, p, nome))) return
  const tomado = `${p.tomados}/${nome}`
  if ('motivo' in lido) return falhar($, p, nome, tomado, texto, lido.motivo)
  let prazo: { cancel: () => void } | undefined
  const motivo = await Promise.race([
    executar($, lido.pedido, eu).catch(err => mensagem(err)),
    new Promise<string>(fim => {
      prazo = $.clock.after(PRAZO_ENVIO_MS, () => fim('sem resposta em 60 s'))
    }),
  ])
  prazo?.cancel()
  if (motivo !== null) return falhar($, p, nome, tomado, texto, motivo)
  await apagar($, tomado)
}
