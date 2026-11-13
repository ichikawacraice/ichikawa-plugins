/** O modo ausente como `ausente.json` o diz (contrato em docs/contratos.md). */
export type Ausente = { ligado: boolean; desde?: string }

/** Um botão vindo do `barra.json` de um plugin instalado e ligado, já com `${CLAUDE_PLUGIN_ROOT}` trocado. */
export type Botao = {
  /** `<plugin>/<id>`: única na barra. */
  chave: string
  plugin: string
  raiz: string
  rotulo: string
  dica?: string
  comando: string[]
  contador?: string[]
  /** Página local que o clique abre no painel de navegador do app, depois que o `comando` termina. */
  url?: string
  ordem: number
}

/** Um pedido da página (`pedidos/<uuid>.json`). */
export type Pedido =
  | { tipo: 'abrir-sessao'; sessao: string; criadoEm: string }
  | { tipo: 'responder'; sessao: string; texto: string; criadoEm: string }

/** O relógio do cache: quando vence (ms) e quantos segundos faltam; `null` antes da primeira resposta. */
export type Cache = { expiraEm: number | null; segundos: number | null }

declare module 'claude-code' {
  interface PluginState {
    barra: {
      cache: Cache
      /** `null` = ainda não lido, ou o arquivo não se leu. */
      ausente: Ausente | null
      /** O clique do ausente está gravando: outro clique é ignorado. */
      trocando: boolean
      botoes: Botao[]
      /** O selo de cada botão, pela chave; `null` = sem selo. */
      selos: Record<string, number | null>
    }
  }
}
