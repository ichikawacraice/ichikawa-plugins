# Tailwind v3 → v4: o que muda em classe e em comportamento

Rode `npx @tailwindcss/upgrade` (Node 20+) numa branch, leia o diff e passe esta lista. Adaptado de wshobson/agents (MIT, © 2024 Seth Hobson) e affaan-m/ECC (MIT); conferir com o guia oficial de upgrade da versão instalada.

## Configuração
- [ ] `@tailwind base/components/utilities` → `@import "tailwindcss";`
- [ ] `tailwind.config.ts` → `@theme { … }` no CSS (cores em `--color-*`, fontes `--font-*`, raios `--radius-*`, breakpoints `--breakpoint-*`)
- [ ] `darkMode: "class"` → `@custom-variant dark (&:is(.dark *));`
- [ ] plugin `tailwindcss-animate` → `tw-animate-css` ou keyframes no `@theme`
- [ ] plugin JS próprio → `@utility nome { … }` / `@plugin` / `@variant`
- [ ] PostCSS: pacote `@tailwindcss/postcss`; Vite: `@tailwindcss/vite`; remova `autoprefixer` e `postcss-import`
- [ ] `content: [...]` some (detecção automática); pasta extra com `@source`
- [ ] prefixo: `@import "tailwindcss" prefix(tw);` e as classes viram `tw:flex`

## Utilitários renomeados
| v3 | v4 |
|---|---|
| `shadow-sm` | `shadow-xs` |
| `shadow` | `shadow-sm` |
| `drop-shadow-sm` / `drop-shadow` | `drop-shadow-xs` / `drop-shadow-sm` |
| `blur-sm` / `blur` | `blur-xs` / `blur-sm` |
| `rounded-sm` / `rounded` | `rounded-xs` / `rounded-sm` |
| `outline-none` | `outline-hidden` (`outline-none` agora tira o contorno de verdade) |
| `ring` (3px) | `ring-3` (`ring` agora é 1px) |
| `bg-opacity-50`, `text-opacity-*` | `bg-black/50`, `text-white/70` |
| `flex-shrink-0` / `flex-grow` | `shrink-0` / `grow` |
| `overflow-ellipsis` | `text-ellipsis` |
| `decoration-slice` / `decoration-clone` | `box-decoration-slice` / `box-decoration-clone` |
| `h-10 w-10` | `size-10` (opcional) |
| `bg-gradient-to-r` | `bg-linear-to-r` (o antigo ainda funciona) |
| `bg-[--marca]` | `bg-(--marca)` |
| `!flex` | `flex!` (o antigo ainda funciona) |

## Comportamento que muda sem aviso
- Cor de borda e de `divide-*` padrão é `currentColor` (era `gray-200`): ponha `border-border`/`border-gray-200` onde dependia do padrão.
- `ring` sem número é 1px e cor `currentColor` (era 3px azul).
- `hover:` só em dispositivo com hover.
- `<button>` tem `cursor: default` (era `pointer`): reponha em `@layer base` se quiser.
- Placeholder usa a cor do texto a 50%, não `gray-400`.
- Variáveis de tema viram variáveis CSS reais: `var(--color-primary)` funciona em qualquer lugar, inclusive em `style`.
- `@layer components/utilities` foi trocado por `@utility` para classes que precisam de variantes (`hover:minha-classe`).
- Valores de espaçamento são calculados de `--spacing` (`p-17` existe); uma escala própria muda `--spacing`.
- `space-x-*`/`space-y-*` mudaram o seletor; se o layout quebrar, use `gap` com flex/grid.

## Cuidados
- Teste claro e escuro, e a página com e sem JS.
- Suporte: Safari 16.4+, Chrome 111+, Firefox 128+.
- Depois do upgrade, procure `@apply` em arquivo que não importa o CSS principal (precisa `@reference`).

Fonte: adaptado de wshobson/agents (MIT, © 2024 Seth Hobson) e affaan-m/ECC (MIT)
