# ICH-F21 · Tema de dia com o modo ausente desligado

Pedido: ausente ligado = céu noturno de hoje, idêntico; ausente desligado = tema de dia (céu azul, nuvens, sol
gigante cortado no rodapé como o planeta), nas duas páginas (Painel de perguntas e painel de cotas), contraste AA.
A barra saiu do escopo (ICH-F22 redesenha e usa esta paleta).

Design aprovado pelo operador em 13/11 (ICH-Q8, artefato v3): cartões e botões planos (sem sombra nem relevo),
acento **cobalto** no lugar do violeta, sol gigante. Paleta com tokens e hex: nota `ICH-F21-paleta-de-dia.md`.

## Como

1. **Tokens** (`plugins/orquestracao/lib/publico/estilo.css`, cópia idêntica no painel de cotas): os literais de cor
   soltos viram tokens com o valor de hoje (botão, primário, degradê do h1, campo, corpo do cartão, fundo dos selos
   do topo). O dia redefine só os tokens em `:root[data-ceu="dia"]`. Risco: não.
2. **Selos e campos** (`perguntas.css`): literais `rgba(...)` → `color-mix(var(--token) N%, transparent)`, que dá a
   mesma cor de hoje. Risco: não.
3. **Céu** (`ceu.js` + novo `ceu-dia.js`, cópias idênticas no painel de cotas): `iniciarCeu` escolhe noite ou dia
   por `data-ceu` no `<html>` e troca sozinho quando o atributo muda. O código da noite não muda. Risco: não.
4. **Quem decide**:
   - Página de perguntas: o servidor grava `data-ceu` pelo `lerAusente()` ao montar o HTML; o recarregamento de 30 s
     mantém em dia.
   - Painel de cotas: o servidor grava `data-ceu` no `index.html` ao servi-lo (lendo `ausente.json` em
     `ICHIKAWA_HOME` ou `~/.claude/ichikawa`) e `GET /api/ceu` devolve o tema; o `app.js` confere a cada 10 s
     (junto com as sessões) e ao voltar para a aba. Risco: não.
5. **Cotas** (`cotas.css`): de dia, sem os brilhos (box-shadow/text-shadow) e barras de cota com preenchimento
   claro (o texto escuro fica por cima). Risco: não.
6. **Testes**: `layout-comum` passa a cobrir `ceu-dia.js`; teste do `data-ceu` no HTML das duas páginas e da rota
   `/api/ceu`.

## Pronto quando

- Ausente ligado: CSS computado e canvas iguais aos de hoje (mesmos valores dos tokens).
- Ausente desligado: tema de dia nas duas páginas, contraste AA medido no navegador.
- Testes afetados verdes (`node --test` em `plugins/orquestracao/tests` e `plugins/contas/src/painel/test`).
