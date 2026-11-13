# Desempenho em React e Next

Por ordem de ganho. Meça antes e depois (Lighthouse, Profiler, analisador de bundle). Adaptado de vercel-labs/agent-skills, `react-best-practices` (MIT, © Vercel), e de affaan-m/ECC (MIT).

## 1. Cascatas de requisição (maior ganho)

Todo `await` em sequência soma a latência inteira.

```ts
// ruim
const user = await getUser(id);
const posts = await getPosts(id);

// bom: independentes em paralelo
const [user, posts] = await Promise.all([getUser(id), getPosts(id)]);

// dependência parcial: dispare cedo, espere tarde
const userP = getUser(id);
const postsP = getPosts(id);
const perfil = await getProfile(id);
if (perfil.privado) return null;
const [user, posts] = await Promise.all([userP, postsP]);
```

- Cheque a condição barata (prop, flag) **antes** do `await` remoto; mova o `await` para o ramo que usa o dado.
- Em Server Component, dois `await` no mesmo componente rodam em sequência. Separe em filhos (`<UserSection/>`, `<CartSection/>`) e o React os roda em paralelo, cada um atrás do seu `<Suspense>`.
- Laço com `await` dentro: `Promise.all(itens.map(...))`, com limite de concorrência se forem centenas.

## 2. Bundle de entrada

- **Sem barrel (`index.ts`) em código seu**: importe do arquivo (`@/components/Button`). Em lib de terceiros, o Next tem `optimizePackageImports` (ícones, `lodash-es`, `date-fns` já vêm na lista); fora dela, importe pelo caminho.
- Componente pesado e não crítico: `React.lazy` (Vite) ou `next/dynamic` (Next). `ssr: false` só dentro de Client Component.
- Terceiros (tag manager, chat, analytics): depois da hidratação. `next/script` com `strategy="afterInteractive"` ou `"lazyOnload"`.
- `import()` com caminho montado por variável derrota a análise do bundler; liste os ramos.
- Descubra o que pesa antes de cortar: `@next/bundle-analyzer`, `rollup-plugin-visualizer`, `source-map-explorer`. Moment, lodash inteiro e biblioteca de ícones inteira são os suspeitos de sempre.

## 3. Servidor (RSC, actions, rotas)

- `React.cache(fn)` deduplica dentro de **uma** requisição: três componentes chamando `getUser(id)` fazem uma consulta. Entre requisições, use o cache do framework (no Next 16: `"use cache"`; ver skill `nextjs`).
- Não guarde estado mutável em módulo no servidor: é compartilhado entre todos os usuários. Use `cookies()`/`headers()` ou `AsyncLocalStorage`.
- Trabalho que não precisa segurar a resposta (log, analytics, aquecer cache): `after()` do Next.
- Leitura de arquivo/fonte estática: no escopo do módulo, uma vez.
- Passe ao cliente só os campos que ele usa; o mesmo dado passado a vários Client Components é serializado várias vezes.

## 4. Dados no cliente

- Dado compartilhado entre componentes: TanStack Query ou SWR (uma requisição, um cache). Nunca `useEffect` + `fetch` para isso.
- Listener global (scroll, resize) uma vez só, com `{ passive: true }` no scroll.
- `localStorage` é síncrono: payload pequeno, com campo `version` para migrar ou descartar o formato antigo.

## 5. Re-render

Só depois de medir (e com o React Compiler ligado, quase tudo aqui é automático).

- Assine o derivado, não o bruto: `useStore(s => s.carrinho.length > 0)`, não `useStore(s => s.carrinho)`.
- Estado lido só dentro de callback: leia na hora (`store.getState()`), não assine.
- Dependência de efeito em primitivos (`[id, nome]`), não em objeto novo a cada render.
- Default não primitivo no escopo do módulo (`const VAZIO: Item[] = []`), senão quebra o `memo` do filho.
- `useTransition`/`startTransition` para atualização não urgente (filtro, aba); `useDeferredValue` para render caro que acompanha digitação.
- Estado inicial caro: `useState(() => parse(grande))`.
- Valor que muda toda hora e não deve renderizar (timestamp, última tecla): `useRef`.

## 6. Renderização e CWV

- **LCP:** imagem do topo com `width`/`height`, prioridade alta (`priority`/`fetchpriority="high"`), sem `loading="lazy"`; fonte com `font-display: swap` e só o peso crítico em preload; não anime o elemento LCP a partir de `opacity: 0`.
- **CLS:** dimensões em toda imagem e embed, espaço reservado para o que chega depois (preço, selo, banner), esqueleto com a altura final.
- **INP:** quebre tarefa longa; handler leve; `startTransition` para o trabalho pesado do clique; virtualize lista longa.
- Lista de centenas de linhas fora da tela: `content-visibility: auto` com `contain-intrinsic-size`.
- Tema/idioma necessário antes da hidratação: script inline mínimo que põe `data-theme` no `<html>`; `suppressHydrationWarning` só nesse nó.
- Mostrar/esconder aba ou painel que guarda estado: `<Activity>` (19.2) em vez de desmontar.
- Animação em `transform`/`opacity`; SVG animado: anime o `div` em volta.
- Dica de recurso: `preconnect`/`preload` de `react-dom` para o que a rota sempre usa.

## 7. JavaScript em laço quente

`Map`/`Set` para busca repetida em vez de `array.find`/`includes`; `toSorted()`; um `flatMap` no lugar de `filter().map()`; regex fora do laço; mínimo/máximo com um laço, não `sort()`.

## Mapa métrica → onde olhar

| Métrica | Primeiro olhe |
|---|---|
| LCP | cascatas, bundle de entrada, imagem/fonte do topo |
| INP | re-render, tarefa longa, lista sem virtualização |
| CLS | dimensões, Suspense sem esqueleto, conteúdo tardio |
| TBT | bundle, terceiros, JS do cliente |

Fonte: adaptado de vercel-labs/agent-skills (MIT) e affaan-m/ECC (MIT)
