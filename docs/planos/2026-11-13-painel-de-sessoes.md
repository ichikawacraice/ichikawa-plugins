# ICH-F8 · Painel de sessões sem gastar contexto

Pedido: o kit antigo tinha um painel de sessões (ícone, detalhes, status, tempo). Trazer para o kit novo sem aumentar o
contexto das sessões nem deixar as tarefas mais lentas.

Pronto quando: plano escrito, painel funcionando no app, contexto inicial de uma sessão sem crescer (medido), PR para
`develop` mergeado.

## O que o painel antigo fazia (painel-sessoes, até a 0.9.22, PR #210 de 07/11)

Fonte: `kit-de-orquestracao.bundle`, `plugins/painel-sessoes` no commit anterior ao `892bfecc` (3.335 linhas no
`register.tsx`, 1.250 no `desenho.ts`). Depois do #210 o pane saiu e o plugin ficou só com a barra.

| Parte | O que fazia | Entra no contexto do modelo? | Trazer? |
|---|---|---|---|
| Pane `/painel` ao lado do chat | Perguntas abertas, travados, rodando, fila; etapa, dona e PRs de cada item; desenho em SVG | Não: é interface do mod | **Sim**, só a lista de sessões (ver abaixo) |
| Comando `/painel` (`$.command.register`) | Abria o pane | Incerto: entra na lista de comandos da sessão | **Não**: o pane abre por um botão na barra |
| Ferramenta `onde_esta_o_painel` (`$.tool.register`) | Diagnóstico de onde o pane foi desenhado | **Sim**: esquema de ferramenta em toda sessão | Não |
| Leitura de `list_sessions` a cada 60 s, só com o pane aberto | Estado vivo das sessões (rodando, PR, última atividade) | Não: chamada do mod, fora da conversa | **Sim**, mesma regra: só com o pane aberto |
| Responder pergunta pelo pane (`$.prompt.submit` / `send_message`) | Botões de resposta | Sim, quando usado (vira mensagem) | Não: a página de perguntas já faz |
| Reabrir o pane depois da limpeza (store por sessão) | Pane voltava após `/clear` | Não | Não (*assumida, a confirmar*): o botão reabre com um clique |
| Batida a cada 10 min | Cutucava donas, escrevia na conversa | **Sim** (mensagens) | Não: o kit novo tirou de propósito |
| Barra acima do prompt | Cache, ausente, abrir a página | Não | Já existe no plugin `barra` |

## O que entra

Um pane **Sessões** no plugin `barra`, aberto e fechado pelo botão `▦ Sessões` da própria barra. Sem comando, sem
ferramenta, sem hook com saída: custo zero de contexto.

- Uma linha por sessão do projeto atual (o da pasta da sessão; worktree conta como o projeto principal):
  - **ícone de status**: `●` trabalhando (verde), `◐` aguarda pergunta minha (âmbar, quando o item tem pergunta aberta),
    `○` parada (cinza), `✓` PR mergeado;
  - título da sessão (já traz `ICH-F7 · tema`), etapa do item (de `~/.claude/ichikawa/itens/<projeto>/F*.json`) e PR;
  - **tempo**: há quanto tempo foi a última atividade (`há 3 min`) e idade da sessão.
- Clique na linha abre a sessão no app (`mcp__ccd_window__open_session_in`, chamado pelo mod).
- Leitura: `list_sessions` + `get_session self` ao abrir e a cada 60 s **só enquanto o pane estiver aberto**; itens e
  perguntas são arquivos. Fechado, o pane não lê nada: a barra continua igual.
- Sessões arquivadas ficam de fora.

Decisões *assumidas, a confirmar*:

- Dentro do `barra`, não num plugin novo: o botão mora na barra e não há outra coisa a instalar. Desligar o painel é
  desligar a barra; aceitável porque ele não lê nada fechado.
- Só o projeto atual. Outro projeto aparece abrindo o pane numa sessão de lá.
- Sem SVG: `Box`/`Text` com cor do tema, que o app e o terminal desenham.

## Tarefas

1. Lógica pura (`hooks/sessoes.ts`): projeto da sessão, filtro, status, ícone, tempo relativo, junção com itens e
   perguntas. Testes em `tests/sessoes.test.ts`. Risco: não.
2. Pane e botão no `register.tsx`, leitura só com o pane aberto. Teste do botão e do desenho em `tests/barra.test.tsx`.
   Risco: não.
3. README da barra e `docs/contratos.md` se citarem o que a barra faz. Risco: não.
4. Medir o contexto inicial antes e depois: `claude -p "responda só: ok" --plugin-dir <barra> --output-format json`,
   soma de `input + cache_creation + cache_read`, com a barra de `origin/develop` e com a nova. Risco: não.
5. Ver no app: abrir o pane pelo botão, conferir linhas e clique. Risco: não.

## Medição (13/11, 12:10 SP)

`claude -p "responda só: ok" --strict-mcp-config --mcp-config '{"mcpServers":{}}' --plugin-dir <barra> --output-format json`,
soma de `input + cache_creation + cache_read`, três rodadas alternadas:

| Rodada | Barra de `origin/develop` | Barra com o painel |
|---|---|---|
| 1 | 45.805 | 45.805 |
| 2 | 45.660 | 45.665 |
| 3 | 45.656 | 45.662 |

Igual: a sobra de ≤6 tokens varia entre rodadas da mesma barra (hora e estado do git no prompt). Com os MCP ligados a
medição oscila ~2,4 mil entre rodadas (servidor que conecta ou não a tempo), nas duas barras; por isso a medida oficial é
sem MCP.

No app (mod carregado nesta sessão por `dev-mods`): a leitura pelo mod trouxe as três sessões do projeto com ícone,
status, etapa, PR e tempo certos. Com a sessão fora da tela o app não põe o pane (`no-surface`); o pane fica guardado e
não lê nada até ser posto.
