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

/** O status que o painel de sessões mostra, pelo ícone e pela cor. */
export type StatusDaSessao = 'trabalhando' | 'aguarda' | 'parada' | 'mergeado'

/** Uma linha do painel de sessões, já pronta para desenhar. */
export type LinhaDeSessao = {
  sessionId: string
  titulo: string
  status: StatusDaSessao
  icone: string
  /** `trabalhando · execução · PR #12 open` */
  detalhe: string
  /** `há 3 min · aberta há 1 h 05` */
  tempo: string
  /** A sessão que desenha o pane. */
  propria: boolean
  link?: string
}

/** O que o pane leu por último; `lidoEm` `null` antes da primeira leitura. */
export type Painel = { linhas: LinhaDeSessao[]; lidoEm: number | null; erro: string | null; lendo: boolean }

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
      /** O painel de sessões: só se lê com o pane aberto. */
      painel: Painel
    }
  }
}
