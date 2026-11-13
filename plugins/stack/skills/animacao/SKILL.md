---
name: animacao
description: Animação de interface em React e Next com motion (motion/react) e CSS — tokens e molas, prefers-reduced-motion, entrada e saída com AnimatePresence, lista com stagger, transição de página, scroll, layout, SSR sem flash. Use ao animar botão, modal, toast, lista, aba, página ou scroll, ao tratar movimento reduzido, ou quando a animação causa flash na hidratação, quebra o LCP ou fica pesada.
---

# Animação

Texto adaptado de affaan-m/ECC (MIT), das skills `motion-foundations` e `motion-patterns`, com correções.

## Antes de animar

O movimento precisa fazer ao menos uma coisa: guiar a atenção, comunicar estado ou preservar a continuidade espacial. Senão, corte. Resposta rápida vale mais que suavidade: animação que atrasa o clique é pior que nenhuma.

**Ordem de ferramenta (a mais simples que serve):**
1. **CSS** (`transition`, `@keyframes`, `@starting-style`, `transition-behavior: allow-discrete`) para hover, foco, abrir/fechar simples. Zero JS.
2. **`motion`** (React) para o que precisa de saída (`exit`), física de mola, layout, gesto, scroll ligado ao valor.
3. GSAP/outros só se o projeto já usa.

## Pacote e importação

- O pacote é `motion`; importe de **`motion/react`**. `framer-motion` é o nome antigo da mesma biblioteca: não misture os dois na árvore.
- Componente com `motion.*` é Client Component (`"use client"`). Para usar `motion` dentro de Server Component sem marcar o arquivo, importe de `motion/react-client`: `import * as motion from "motion/react-client"`.
- Bundle: `LazyMotion` com `domAnimation` e o componente `m` no lugar de `motion` corta o peso inicial; carregue as features de forma assíncrona.

## Movimento reduzido (obrigatório)

`prefers-reduced-motion: reduce` desliga movimento espacial; opacidade e cor podem ficar, curtas (≤ 0,2 s).

```tsx
// uma vez, na raiz: o motion desliga transform/layout para quem pediu menos movimento
import { MotionConfig } from "motion/react";
<MotionConfig reducedMotion="user">{children}</MotionConfig>
```

- Fora do `motion`, use `useReducedMotion()` para trocar `y: 16` por `y: 0`, ou o CSS:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; scroll-behavior: auto !important; }
}
```
- Tailwind: `motion-safe:animate-…` (só anima se permitido) e `motion-reduce:transition-none`.
- Animação que o usuário não controla, com mais de 5 s, precisa de botão de pausar (WCAG 2.2.2). Nada pisca mais de 3 vezes por segundo.

## Só transform e opacidade

`transform` (`x`, `y`, `scale`, `rotate`) e `opacity` rodam no compositor, sem recalcular layout. `width`, `height`, `top`, `left`, `margin`, `padding` forçam layout a cada quadro: evite em lista e em tela cheia.
- Sanfona: `grid-template-rows: 0fr → 1fr` no CSS, ou `height: "auto"` do `motion` num elemento pequeno e isolado. Barra de progresso: `scaleX` com `transform-origin: left`.
- `layout` do `motion` anima por transform e serve para mudanças pequenas e isoladas. Não use em subárvore grande; texto dentro de container que cresce leva `layout="position"` para não reflowar animando.
- `will-change` só no que vai animar, e tire depois. SVG: anime o `div` em volta.

## Tokens (um arquivo, ninguém digita número solto)

```ts
// lib/motion-tokens.ts
export const duration = { instant: 0.08, fast: 0.18, normal: 0.35, slow: 0.6 } as const;
export const easing = { suave: [0.22, 1, 0.36, 1], seca: [0.4, 0, 0.2, 1] } as const;
export const distance = { sm: 8, md: 16, lg: 24 } as const;
export const springs = {
  snappy:  { type: "spring", stiffness: 300, damping: 30 }, // UI comum: botão, chip, item de menu
  gentle:  { type: "spring", stiffness: 120, damping: 14 }, // card, painel pousando
  bouncy:  { type: "spring", stiffness: 400, damping: 10 }, // estado vazio, onboarding
  instant: { type: "spring", stiffness: 600, damping: 35 }, // tooltip, popover
} as const;
```

Escolha: `instant` para tooltip e foco; `fast` para feedback de botão; `normal` para modal e card; `slow` só em entrada de herói. Animação de interação: 150–300 ms.

## SSR e hidratação (a correção importante)

- O `motion` renderiza o `initial` no HTML do servidor. Com `initial={{ opacity: 0 }}` o conteúdo chega **invisível** ao HTML: sem JS não aparece, o bot lê pouco, e se for o maior elemento da tela o **LCP só conta depois da hidratação**. Não anime a partir de `opacity: 0` o elemento do LCP, o título e o preço da PDP.
- Para componente que já está na tela ao carregar, `initial={false}` pula a animação de entrada e usa o valor de `animate` direto.
- Aviso de hidratação vem de `initial`/estilo que depende de `window`, `Math.random()` ou de `matchMedia` lido no render. Leia `window` só em efeito ou com `useReducedMotion`/`useInView`, nunca no escopo do módulo.
- Entrada ao rolar: `whileInView` com `viewport={{ once: true, margin: "-80px" }}`; repetir ao sair da tela distrai.

## Padrões

**Entrada e saída.** Três coisas sempre juntas: `AnimatePresence` em volta do condicional, `key` no filho direto, `exit` no filho. Faltou uma, a saída não roda.

```tsx
<AnimatePresence>
  {aberto && (
    <motion.div key="painel" initial={{ opacity: 0, y: distance.sm }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: distance.sm }} transition={springs.gentle} />
  )}
</AnimatePresence>
```
`mode="wait"` para trocar conteúdo um por vez; `"sync"` (padrão) quando sobrepor não incomoda (toasts); `"popLayout"` para item removido de lista que reflui.

**Lista com stagger.** `variants` no `ul` com `transition: { staggerChildren: 0.08 }` (entre 0,05 e 0,1 s) e `hidden`/`visible` nos `li`. Acima de ~20 itens, não faça stagger na lista inteira.

**Botão.** `whileTap={{ scale: 0.95 }}` com `springs.snappy`; foco visível continua do CSS.

**Modal.** O movimento é a parte fácil. Foco preso, `Escape`, travar o scroll, `role="dialog"` e `aria-modal` vêm do `Dialog` do Radix/shadcn: use `forceMount` + `AnimatePresence`, ou animação CSS por `data-[state=open]`. Não monte trap de foco à mão.

**Toast.** `layout` em cada toast, `AnimatePresence`, saída para o lado de onde veio. Quem anuncia é `aria-live`/`role="status"`, não a animação.

**Elemento compartilhado.** `layoutId="mesmo-id"` nos dois contextos (miniatura → imagem grande). Um `layoutId` por elemento visível.

**Scroll ligado ao valor.** `useScroll()` + `useTransform()`; barra de progresso com `style={{ scaleX: scrollYProgress }}`. Em CSS, `animation-timeline: scroll()`/`view()` onde o navegador suporta (confira o suporte antes).

**Transição de página no App Router.** `AnimatePresence mode="wait"` com `key={pathname}` é frágil: o Next troca a árvore antes da saída rodar. Prefira transição de **entrada** só (sem `exit`), ou a View Transitions API (`viewTransition` no `next.config`, `<ViewTransition>` do React), e teste na navegação real e no botão voltar. Nunca bloqueie a navegação esperando animação.

## Desempenho

Teste em celular intermediário, não só no seu Mac. Animação com `repeat: Infinity` fora da tela consome bateria: pause com `useInView`. Biblioteca de animação grande entra por `import()` dinâmico se só serve abaixo da dobra. Medida: aba Performance do Chrome (quadros perdidos) e INP depois de animar.

## Antipadrões

`framer-motion` e `motion/react` juntos; duração e mola digitadas em cada componente; `exit` sem `AnimatePresence`; `AnimatePresence` sem `key`; animar `width`/`height`/`top` em lista; esquecer `prefers-reduced-motion`; `initial={{ opacity: 0 }}` no LCP; esconder conteúdo importante atrás de animação de entrada; ler `window` no escopo do módulo; `layout` em árvore grande; efeito decorativo sem função.

Fonte: adaptado de affaan-m/ECC (MIT)
