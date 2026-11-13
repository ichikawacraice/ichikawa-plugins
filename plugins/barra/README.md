# barra

A barra acima do prompt do Claude Code (app desktop e terminal). Mostra:

- **Cache**: quanto falta do cache de 1 h desde a última resposta da conversa principal (`⧗ 42:10`), com moldura amarela aos 20 min e vermelha aos 10.
- **Ausente**: botão que liga e desliga o modo ausente, gravando `~/.claude/ichikawa/ausente.json` (`$ICHIKAWA_HOME` troca a pasta).
- **Botões de outros plugins**: de cada plugin instalado e ligado neste projeto, lê o `barra.json` da raiz e mostra os botões, na ordem.
- **Sessões para a página**: a cada 60 s grava `~/.claude/ichikawa/sessoes-do-app.json` com a lista de sessões do app (`list_sessions`, que só o app enxerga), para a seção Sessões da página do kit. Se outra sessão gravou há menos de 50 s, não lê de novo. É interface do mod: nada entra no contexto do modelo.
- **Pedidos da página**: a cada 5 s confere `~/.claude/ichikawa/pedidos/` e executa o que a página de perguntas pediu (abrir uma sessão, responder a uma sessão).

Só lê arquivos, roda os contadores declarados e lê `list_sessions` no máximo uma vez por minuto entre todas as sessões abertas.

## Tema (céu noturno)

A barra segue o tema do painel: fundo `#030014`, estrelas e um brilho de planeta violeta/rosa.

- **Desktop**: o céu é um SVG atrás dos botões; a cintilação é CSS em degraus (nada repinta mais de uma vez por segundo) e para sozinha com o "Reduzir movimento" do sistema.
- **Terminal**: estrelas em caracteres (`· ✦ ⋆`) atrás dos botões, cintilando pelo relógio de 1 s que a barra já tinha.
- **Menos movimento**: `BARRA_SEM_ANIMACAO=1` no ambiente, ou o "Reduzir movimento" do macOS (lido ao abrir a sessão), deixam o céu parado.
- Os botões do desktop são nativos do app e se pintam sozinhos; o mod não muda a cor deles.

## Contrato `barra.json` (resumo)

1. Fica na raiz do plugin, ao lado de `.claude-plugin/`: `{ "botoes": [ … ] }`.
2. Cada botão: `id`, `rotulo`, `comando` (argv, sem shell), `ordem` (menor à esquerda); `dica`, `contador` e `url` são opcionais.
3. `${CLAUDE_PLUGIN_ROOT}` em qualquer argumento vira a pasta do plugin dono.
4. O clique roda o `comando` desacoplado; a barra não espera. Com `url` (só página local), espera o `comando` e abre a página no navegador do app; no terminal, no navegador do sistema.
5. `contador` imprime um inteiro, mostrado como selo (`Perguntas · 3`), rodado no máximo a cada 30 s com prazo de 3 s.

O contrato completo está em [`docs/contratos.md`](../../docs/contratos.md).

## Testes

```sh
claude plugin test plugins/barra
```
