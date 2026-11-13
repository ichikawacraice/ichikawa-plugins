# barra

A barra acima do prompt do Claude Code (app desktop e terminal). Mostra:

- **Cache**: quanto falta do cache de 1 h desde a última resposta da conversa principal (`⧗ 42:10`), com moldura amarela aos 20 min e vermelha aos 10.
- **Ausente**: botão que liga e desliga o modo ausente, gravando `~/.claude/ichikawa/ausente.json` (`$ICHIKAWA_HOME` troca a pasta).
- **Botões de outros plugins**: de cada plugin instalado e ligado neste projeto, lê o `barra.json` da raiz e mostra os botões, na ordem.
- **Pedidos da página**: a cada 5 s confere `~/.claude/ichikawa/pedidos/` e executa o que a página de perguntas pediu (abrir uma sessão, responder a uma sessão).

Só lê arquivos e roda os contadores declarados; nunca `list_sessions` em laço.

## Contrato `barra.json` (resumo)

1. Fica na raiz do plugin, ao lado de `.claude-plugin/`: `{ "botoes": [ … ] }`.
2. Cada botão: `id`, `rotulo`, `comando` (argv, sem shell), `ordem` (menor à esquerda); `dica` e `contador` são opcionais.
3. `${CLAUDE_PLUGIN_ROOT}` em qualquer argumento vira a pasta do plugin dono.
4. O clique roda o `comando` desacoplado; a barra não espera.
5. `contador` imprime um inteiro, mostrado como selo (`Perguntas · 3`), rodado no máximo a cada 30 s com prazo de 3 s.

O contrato completo está em [`docs/contratos.md`](../../docs/contratos.md).

## Testes

```sh
claude plugin test plugins/barra
```
