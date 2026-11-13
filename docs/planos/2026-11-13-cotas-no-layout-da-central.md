# ICH-F20 · Página de cotas no layout da Central, com aviso de reler bem visível

Pedido: "atualizar o layout da página de contas também, pra ser o mesmo da de perguntas, e o aviso de que tem que mandar ler as cotas novamente tem que ser mais evidente".

## Pronto quando

- O painel de cotas (`plugins/contas/src/painel/publico/`) usa a mesma base visual da página de perguntas: mesmo `estilo.css`, `ceu.js`, `planeta.js` e fonte Geist, topo centralizado com selo, título e subtítulo, duas colunas em tela larga, céu com planeta no rodapé.
- Leitura velha ou que falhou (inclusive `limite`: "a Anthropic pediu para esperar") mostra uma faixa destacada no topo, com o botão "Ler cota" junto.
- O limite de "velha" é constante: `COTA_VELHA_MS = 30 min` (*assumida, a confirmar*).
- `docs/contratos.md` diz qual é a fonte do layout comum, e um teste falha se as cópias divergirem.

## Tarefas

1. `regras.js`: `avisoDaCota({ contas, uso, lendoUso }, agora)` → `{ tom, titulo, texto }` ou `null`. Teste antes. Risco: não.
   - Lendo agora → `null`. Sem contas legíveis (`ativa || salva`) → `null`.
   - Alguma conta com erro → tom `erro`; `limite` com `tentarDepois` diz a hora em SP.
   - Conta legível sem leitura ou com `lidoEm` mais velho que 30 min → tom `velha`, dizendo há quanto.
2. Cópias idênticas da base (fonte agora é a página de perguntas, `plugins/orquestracao/lib/publico/`): `estilo.css`, `ceu.js`, `planeta.js`, `fontes/geist-medium.woff2` (+ licença OFL). Classes próprias do painel em `cotas.css`, só com tokens da base (`color-mix` para os tons translúcidos), para o tema de dia (ICH-F21) trocar só os tokens. Risco: não.
3. `index.html` e `app.js`: topo novo, faixa de aviso com o botão "Ler cota", colunas em `<div>`. Servidor serve os arquivos novos. Risco: não.
4. `docs/contratos.md`: fonte do layout = página de perguntas; teste `layout-comum.test.mjs` compara os bytes. Risco: não.

## Fora

Cabeçalho da página de perguntas (ICH-F19) e tema de dia (ICH-F21).
