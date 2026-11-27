# ICH-F52 · O painel não mostra como trabalhando o item sem dona nem como parada a dona que já entregou

Data: 27/11/2026 · Dona: sessão `local_ef79f63f` · Pedido do operador: "o ajuste no painel das sessões arquivadas está falhando, ta cheio de coisa la que ja acabou".

## Causa medida (27/11, 15:20 SP)

- `estadoDoItem` (`plugins/orquestracao/lib/sessoes.mjs`) cai no último `return` e devolve `trabalhando` para o item vivo sem `sessao`. No Izanagi, 39 dos 49 itens vivos nunca tiveram dona (todos em `planejamento`).
- `sessoes-do-app.json` não traz sessão arquivada: a barra chama `list_sessions` sem `include_archived` (16 sessões, nenhuma arquivada). A dona arquivada some do arquivo e a página diz "parada · A sessão dona não está aberta no app" para sempre, sem saber do PR.
- `list_sessions` com arquivadas não resolve: 185 das 200 mais recentes são arquivadas, e as donas de ESL-F96 e ESL-F209, arquivadas há um dia, já estão na posição 122 e 126. O `get_session` de uma arquivada devolve `isArchived` e `prState` (medido: `local_8e7b65f4` → `true`, `#149 MERGED`).
- O PR que o app mostra é o último da sessão, não o do item: as donas de ESL-F96 e ESL-F209 são balcões reaproveitados, e o #149 e o #117 são de outro trabalho.

## Decisão: "falta fechar", não fechar sozinho

Mostrar como **falta fechar**, sem fechar sozinho. Fechar gravaria a entrega (`desfecho`, `resultado`, `medido`) que nenhuma dona mediu, e o caso dos balcões mostra que o PR mergeado nem sempre é o do item. O cartão diz só o que se mediu ("A dona foi arquivada com o PR #149 mergeado, sem gravar a entrega") e quem fecha é a orquestradora, com `perguntas item entregar`. *Assumida, a confirmar com o operador.*

## Desenho

1. **`sessoes.mjs` (puro).**
   - `estadoDoItem`: depois de `esperando`, o item sem dona (sem `sessao` e sem sessão achada pelo título) é `sem-dona`; com a leitura fresca, a dona arquivada com `prEstado` `MERGED` é `falta-fechar`; a arquivada sem PR mergeado é `parada` ("A dona foi arquivada sem gravar a entrega."); a ausente segue `parada`.
   - `sessoesDaPagina`: o `sem-dona` vai para `g.fila` (fora de `g.sessoes`), em ordem de F; `falta-fechar` entra no fim de `ORDEM_DOS_ESTADOS`. Devolve `emAndamento` (cartões menos `falta-fechar`) e `procuradas`: ids `local_…` de dona que não está no arquivo, para a barra perguntar.
2. **`pagina.mjs`.** A fila vira um `<details>` recolhido por projeto, depois das sessões vivas: "Na fila · sem dona (N)", uma linha por item (código e título). O selo azul do topo conta `emAndamento`. A página grava `sessoes-procuradas.json` (`{ em, sessoes: [...] }`, atômico) quando a lista muda.
3. **Barra (`hooks/register.tsx`, `hooks/sessoes.ts`).** Ao gravar `sessoes-do-app.json`, lê `sessoes-procuradas.json` e chama `get_session` de cada id (até 20), juntando o que vier ao arquivo; recusa ou "not found" fica de fora.
4. **CSS.** `marcador-`, `selo-sessao-` e `sessao-falta-fechar` na cor de entregou; a fila no pontilhado de `sem-item`.
5. **Docs.** `docs/contratos.md` (arquivo novo e o `get_session` das procuradas), READMEs da raiz, do `orquestracao` e da `barra`.

## Tarefas

| # | Tarefa | Teste primeiro | Risco |
|---|---|---|---|
| 1 | `estadoDoItem` e `sessoesDaPagina`: `sem-dona`, `falta-fechar`, `procuradas`, `emAndamento` | `tests/sessoes.test.mjs` | não |
| 2 | Página: fila recolhida, selo do topo, gravar `sessoes-procuradas.json` | `tests/sessoes.test.mjs` (html) | não |
| 3 | Barra: `get_session` das procuradas | `plugins/barra/tests/barra.test.tsx` | não |
| 4 | CSS e docs | grep nos READMEs e no contrato | não |
| 5 | Conferir a página no navegador do app com o estado real | Browser pane | não |

Comandos: os quatro do gate (`CLAUDE.md` do repo).

Pronto quando: item sem dona fora do "trabalhando", num grupo recolhido por projeto abaixo das sessões vivas; dona arquivada com PR mergeado como "falta fechar"; testes dos dois casos; página conferida no navegador.
