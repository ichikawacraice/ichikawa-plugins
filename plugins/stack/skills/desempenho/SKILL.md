---
name: desempenho
description: Como medir e otimizar desempenho sem chutar — baseline e correção antes de mexer, uma hipótese por vez, metas de Core Web Vitals (LCP, INP, CLS), latência p50/p95/p99 de API, tamanho de bundle, tempo de build e teste, e o mapa de qual métrica ruim aponta para qual causa em React/Next. Use quando disserem "está lento", "faz mais rápido", "melhora o LCP", ao comparar antes/depois de um PR, ou antes de otimizar qualquer coisa. Para analisar código atrás de gargalo, use o agente stack:desempenho.
---

# Desempenho

**Não otimize sem número.** Sem medida, você troca um gargalo imaginário por complexidade real. O agente `stack:desempenho` aplica esta skill em código.

## Antes de mexer (obrigatório)

Anote, no plano ou no PR:

1. **A operação** (rota `/produto/[slug]`, endpoint `GET /api/pedidos`, o build).
2. **O portão de correção** que continua verde (os testes afetados, o resultado que não pode mudar).
3. **A métrica** (LCP, p95, linhas/s, custo, memória) e **o baseline medido** — mesma máquina, mesmos dados, mais de uma rodada.
4. **O orçamento**: quantas variantes, quanto tempo, quanto custo, que impacto em dado.

Sem os quatro, o trabalho é medir, não otimizar. Pedido irreal ("20x mais rápido") mantém a ambição e ganha um limite medível.

## O laço

1. Meça o baseline.
2. Ache o gargalo **pela evidência** (perfil, `EXPLAIN`, waterfall de rede, bundle analyzer), não pelo palpite.
3. Uma hipótese por variante; mexa em **uma** coisa.
4. Rode com o mesmo formato de entrada que o baseline.
5. Descarte o que quebra o portão de correção ou não se repete.
6. Fique com a variante mais rápida e segura; registre.
7. Rode baseline e vencedora de novo para confirmar a diferença.

Registre em tabela (no PR serve):

```text
Variante   | Hipótese            | Comando             | Tempo | Correto? | Nota
baseline   | caminho atual       | npm run job         | 120s  | sim      |
lote-500   | menos idas ao banco | job --lote 500      | 42s   | sim      | vencedora
paralelo-8 | mais workers        | job --workers 8     | 31s   | não      | estoura limite de taxa
```

**Pare** quando o ganho cair dentro do ruído, a correção falhar, o custo passar do orçamento, ou você estiver mudando mais coisas do que consegue explicar. Diga "melhor variante segura medida", não "ótimo", salvo se a busca foi exaustiva.

Uma variante só vira padrão com: testes verdes, ganho repetido ou explicado, rollback óbvio, mudança no código (não só no seu terminal) e os comandos e números no resumo.

## O que medir

### Página (navegador)

| Métrica | Meta (bom) |
|---|---|
| LCP | < 2,5 s |
| INP | < 200 ms |
| CLS | < 0,1 |
| TTFB | < 800 ms |
| JS por página (gzip) | < 200 KB como ponto de partida |

Meça no campo (dados reais, Search Console/CrUX) **e** em laboratório (Lighthouse, painel Performance do Chrome, throttling de rede/CPU móvel). Laboratório acha a causa; campo diz se importa. Peso total, número de requisições, recursos que bloqueiam renderização e scripts de terceiros entram na conta.

### API

100 chamadas por endpoint, relate **p50, p95, p99** (a média esconde a cauda), tamanho da resposta e status; repita com concorrência (ex.: 10 em paralelo). Compare com a meta combinada (SLA). Consulta lenta: `EXPLAIN (ANALYZE, BUFFERS)` (`stack:postgres`).

### Build e feedback

Build a frio, HMR, `tsc`, lint, suíte de testes, build de Docker. Quem espera isso toda hora paga o juro mais alto.

## Qual métrica aponta para onde (React / Next)

| Métrica ruim | Olhe primeiro |
|---|---|
| LCP | requisições em cascata (waterfall), JS inicial, imagem principal sem prioridade/`preload`, dado buscado tarde |
| INP | re-render excessivo, trabalho longo na thread principal, handler pesado, hidratação |
| CLS | imagem/vídeo sem dimensão, fonte trocando, conteúdo inserido acima do que já está na tela |
| TBT / carregamento lento | tamanho do bundle, import de barril, biblioteca pesada, script de terceiro |

Ordem de ataque em React: **cascatas de `await`** e **tamanho do bundle** primeiro (rendem mais); depois desempenho no servidor (Server Components, cache de requisição); só então re-render e micro-ajustes de JS. Mudar `useMemo`/`useCallback` sem perfil quase nunca paga, e com React Compiler é ruído. As regras de React em si ficam na skill `react` deste plugin.

Ferramentas: `@next/bundle-analyzer`, React DevTools Profiler, Lighthouse, painel Network do Chrome, `EXPLAIN`, `pg_stat_statements`.

## Depois de soltar

Compare com o baseline na produção (RUM/Search Console/logs de latência) alguns dias depois. Regressão que só aparece com tráfego real não aparece no laboratório.

Fonte: adaptado de affaan-m/ECC (MIT) — `benchmark`, `benchmark-optimization-loop` e `react-performance` (esta, por sua vez, de Vercel Labs `react-best-practices`, MIT).
