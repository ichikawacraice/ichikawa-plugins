# ICH-F13 · Redesign do painel inspirado no reflect.app

Pedido: "ajustar o layout como um todo: cores, anatomia, hierarquia de título, subtítulo e texto, tamanho de fonte, fonte, tudo". Comportamento e dados ficam iguais.

## Decisões

- **Fonte:** Geist Medium (OFL, Vercel) embutida em `lib/publico/fontes/` com a licença; só nos títulos. Corpo em `system-ui`. Um peso só (500), como os títulos do Reflect. *Decidida pelo operador.*
- **Paleta:** fundo `#030014`; texto `#fff`; secundário `rgba(239,237,253,.6)`; terciário `.55` (~5,5:1); fios `rgba(239,237,253,.08/.14)`; acento lilás `#c4b5fd` / violeta `#8b5cf6`. Selos ok/parcial/parado mantêm o sentido, com cor mais suave. *assumida, a confirmar*
- **Escala (coluna 300–420 px):** h1 24/30; h2 17/22; título de cartão 15/20; corpo 14/20; apoio (subtítulo, grupo, Ver mais) 13/18; rótulo e metadado 12/16. Tela larga: h1 32/38, h2 19/24. *assumida, a confirmar*
- **Anatomia:** topo à moda do pricing do Reflect — selo em pílula, título com degradê, linha de apoio com os números do momento. Seções com fio fino em cima e muito respiro; cartões de vidro escuro com borda de 1 px; botões de contorno fino, o primário em vidro violeta. O nome do projeto e os rótulos dos campos perdem a caixa-alta gritante e viram texto secundário.
- **Céu e planeta:** o céu passa a partir de `#030014`, nebulosas puxadas para o violeta; o planeta (PR #13) fica, com o halo afinado à paleta.
- `estilo.css` era cópia do painel de contas: sai o que esta página não usa (contas, sessões, faixas, barras).

## Tarefas

1. Fonte + licença em `lib/publico/fontes/`, servida com `font/woff2` (sem charset). Teste: GET da fonte devolve 200 e o tipo certo. Risco: não.
2. `html()`: topo novo (selo, h1, apoio com contagens) e `<link rel=preload>` da fonte; marcação dos cartões intacta (testes e o ICH-F12 dependem dela). Risco: não.
3. `estilo.css` + `perguntas.css` reescritos com tokens, escala e anatomia novos. Risco: não.
4. `ceu.js` / `planeta.js`: só cores. Risco: não.
5. Prints antes/depois em 380 px e 1280 px no PR; testes afetados (`node --test tests/orquestracao.test.mjs`).

Diff passa de ~400 linhas → revisão pelo `orquestracao:revisor`.

## Pronto quando

A página usa a hierarquia, as cores e a anatomia novas, com prints antes/depois em ~380 px e tela larga no PR, e os testes passam.
