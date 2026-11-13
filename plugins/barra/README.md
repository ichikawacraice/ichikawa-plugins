# barra

A barra acima do prompt do Claude Code (app desktop e terminal). Mostra:

- **Cache**: quanto falta do cache de 1 h desde a última resposta da conversa principal (`⧗ 42:10`), âmbar aos 20 min e etiqueta vermelha aos 10.
- **Ausente**: botão que liga e desliga o modo ausente, gravando `~/.claude/ichikawa/ausente.json` (`$ICHIKAWA_HOME` troca a pasta).
- **Botões de outros plugins**: de cada plugin instalado e ligado neste projeto, lê o `barra.json` da raiz e mostra os botões, na ordem.
- **Sessões para a página**: a cada 60 s grava `~/.claude/ichikawa/sessoes-do-app.json` com a lista de sessões do app (`list_sessions`, que só o app enxerga), para a seção Sessões da página do kit. Se outra sessão gravou há menos de 50 s, não lê de novo. É interface do mod: nada entra no contexto do modelo.
- **Pedidos da página**: a cada 5 s confere `~/.claude/ichikawa/pedidos/` e executa o que a página de perguntas pediu (abrir uma sessão, responder a uma sessão).

Só lê arquivos, roda os contadores declarados e lê `list_sessions` no máximo uma vez por minuto entre todas as sessões abertas.

## Tema (noite e dia, pela hora do computador)

- **Noite, das 18h às 6h**: fundo `#030014`, estrelas que cintilam e a lua crescente à direita, no lugar do sol (a paleta do painel).
- **Dia, das 6h às 18h**: o céu da paleta de dia do Painel (ICH-F21: `#74b6ef` → `#d6ebfb`, texto `#0b1f3a`), o sol com brilho e raios à direita e nuvens paradas ao fundo. A hora é a local do computador (fuso lido uma vez por sessão com `date +%z`; sem resposta, o de São Paulo), e a troca acontece no redesenho de 1 s seguinte à virada. O modo ausente não muda mais o céu.
- **Ícones**: todo botão abre com um glifo (`☾ Estou de volta`, `☀ Ficar ausente`, `◫ Painel`, `◉ Contas`); outro plugin escolhe o dele pelo `icone` do `barra.json`, e sem ele vem `✦`.
- **Desktop**: o fundo da barra é a cor lisa do céu. O relógio do cache fica à esquerda, os botões encostados à direita e, entre eles, a cena em SVG (26 px, a altura de um botão) com o sol ou a lua na ponta direita colado nos botões; janela estreita demais fica sem cena. O app não pinta SVG numa caixa em camada (`position="absolute"`, medido no ICH-F22) nem SVG com `alt` vazio, por isso a cena vai em fluxo e sempre com texto alternativo. As nuvens do dia são paradas; só as estrelas cintilam. A animação é CSS do SVG e para com o "Reduzir movimento" do sistema.
- **Terminal**: a linha de estrelas (`· ✦ ⋆`, cintilando pelo relógio de 1 s) ou de nuvens (`☁`, com `☀` na ponta) atrás dos botões, e os rótulos na cor do tema.
- **Relógio do cache**: na cor do tema; aos 20 min fica âmbar, aos 10 vira etiqueta vermelha (sem moldura, para a barra não mudar de altura).
- **Menos movimento**: `BARRA_SEM_ANIMACAO=1` no ambiente, ou o "Reduzir movimento" do macOS (lido ao abrir a sessão), deixam o céu parado.
- Os botões do desktop são nativos do app e se pintam sozinhos; o mod não muda a cor nem o tamanho deles.

## Contrato `barra.json` (resumo)

1. Fica na raiz do plugin, ao lado de `.claude-plugin/`: `{ "botoes": [ … ] }`.
2. Cada botão: `id`, `rotulo`, `comando` (argv, sem shell), `ordem` (menor à esquerda); `icone` (um glifo), `dica`, `contador` e `url` são opcionais.
3. `${CLAUDE_PLUGIN_ROOT}` em qualquer argumento vira a pasta do plugin dono.
4. O clique roda o `comando` desacoplado; a barra não espera. Com `url` (só página local), espera o `comando` e abre a página no navegador do app; no terminal, no navegador do sistema.
5. `contador` imprime um inteiro, mostrado como selo (`◫ Painel · 3`), rodado no máximo a cada 30 s com prazo de 3 s.

O contrato completo está em [`docs/contratos.md`](../../docs/contratos.md).

## Testes

```sh
claude plugin test plugins/barra
```
