---
name: tailwind
description: Tailwind CSS v4 com tokens de design e shadcn/ui — configuração em CSS (@theme, @theme inline), modo escuro, variantes com CVA, cn(), migração de v3 para v4 e armadilhas (classe dinâmica, utilitários renomeados). Use ao montar ou revisar design system, tema e dark mode, componente shadcn, ao migrar de v3, ou quando uma classe do Tailwind "não pega".
---

# Tailwind v4 + shadcn/ui

Adaptado de wshobson/agents, `tailwind-design-system` (MIT, © 2024 Seth Hobson), via affaan-m/ECC (MIT). Trocas de nome de utilitário e mudanças de comportamento da v3 para a v4: `referencias/migracao-v3-v4.md`.

## Como a v4 funciona

- **Configuração é CSS.** Não há `tailwind.config.ts` (existe só como legado via `@config`). Não há `@tailwind base/components/utilities`: `@import "tailwindcss";`.
- Instalação: Vite com `@tailwindcss/vite`; Next/PostCSS com `@tailwindcss/postcss`. Sem `autoprefixer` nem `postcss-import`. Detecta os arquivos sozinha (respeita `.gitignore`); pasta fora do projeto: `@source "../pacote-ui";`.
- Navegadores alvo: Safari 16.4+, Chrome 111+, Firefox 128+. Precisa mais antigo? Fique na v3.
- Container query nativa (`@container`, `@sm:`, `@max-md:`), `size-10` (= `w-10 h-10`), `bg-linear-to-r`, valor arbitrário de variável com parênteses: `bg-(--marca)`.

## Tokens: três camadas

```
valor da marca (oklch)  ->  token semântico (--primary)  ->  utilitário (bg-primary)
```

Use nome por **função** (`bg-primary`, `text-muted-foreground`, `border-border`), nunca por cor (`bg-blue-500`) nos componentes. Trocar de tema vira trocar variáveis.

## CSS base no padrão shadcn (v4)

```css
/* app/globals.css */
@import "tailwindcss";
@import "tw-animate-css";            /* substitui o plugin tailwindcss-animate */

@custom-variant dark (&:is(.dark *)); /* modo escuro por classe .dark no <html> */

:root {                               /* valores reais, fora do @theme */
  --background: oklch(100% 0 0);
  --foreground: oklch(14.5% 0.025 264);
  --primary: oklch(14.5% 0.025 264);
  --primary-foreground: oklch(98% 0.01 264);
  --muted: oklch(96% 0.01 264);
  --muted-foreground: oklch(46% 0.02 264);
  --destructive: oklch(53% 0.22 27);
  --border: oklch(91% 0.01 264);
  --ring: oklch(14.5% 0.025 264);
  --radius: 0.5rem;
}
.dark {
  --background: oklch(14.5% 0.025 264);
  --foreground: oklch(98% 0.01 264);
  --primary: oklch(98% 0.01 264);
  --primary-foreground: oklch(14.5% 0.025 264);
  --muted: oklch(22% 0.02 264);
  --muted-foreground: oklch(65% 0.02 264);
  --border: oklch(22% 0.02 264);
  --ring: oklch(83% 0.02 264);
}

@theme inline {                       /* expõe as variáveis como utilitários */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-ring: var(--ring);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --font-sans: var(--font-inter), system-ui, sans-serif; /* variável do next/font */
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground antialiased; }
}
```

**`@theme` × `@theme inline` × `@theme static`:**
- `@theme { --color-x: … }` cria o token **e** o utilitário; só emite a variável CSS se for usada.
- `@theme inline` quando o valor referencia **outra variável** (`var(--background)`): o utilitário recebe o `var()` direto, e o modo escuro funciona porque a variável de baixo muda. Sem `inline`, o valor resolve cedo e o escuro "não pega".
- `@theme static` emite todas as variáveis sempre (as lidas por JS ou por lib de terceiros).
- Limpar a paleta padrão: `--color-*: initial;` antes de definir as suas.

**Cor:** OKLCH dá escala perceptualmente uniforme. Contraste mínimo WCAG AA: 4,5:1 texto normal, 3:1 texto grande e componente de interface; confira nos dois temas.

**Animação:** keyframes dentro de `@theme` com `--animate-nome: nome 0.2s ease-out;`. Entrada/saída de elemento: `@starting-style` + `transition-behavior: allow-discrete`, ou `tw-animate-css` (`animate-in fade-in`). Respeite `motion-safe:`/`motion-reduce:` (skill `animacao`).

## Modo escuro

- Por classe (acima): script inline antes da hidratação põe `.dark` no `<html>` para evitar flash; `next-themes` faz isso e `suppressHydrationWarning` fica no `<html>`.
- Só pelo sistema: não declare `@custom-variant`, o `dark:` padrão usa `prefers-color-scheme`.
- `color-scheme: light dark` para controles nativos (scroll, input).

## Componentes: CVA + `cn`

```ts
// lib/utils.ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "@radix-ui/react-slot";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        outline: "border border-border bg-background hover:bg-muted",
        ghost: "hover:bg-muted",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: { default: "h-10 px-4", sm: "h-9 px-3", lg: "h-11 px-8", icon: "size-10" },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

// React 19: ref é prop, sem forwardRef
function Button({ className, variant, size, asChild = false, ...props }:
  React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
```

- shadcn: `npx shadcn@latest add button`; o código vai para o **seu** repositório e é seu. `components.json` com `tailwind.config` vazio na v4. Edite o componente, não o envolva em dez camadas.
- Ordem mental de um componente: base → variantes → tamanhos → estados (`hover`, `focus-visible`, `disabled`, `aria-invalid`, `data-[state=…]`) → `className` do chamador por último (o `twMerge` resolve conflito).
- Foco visível sempre (`focus-visible:ring-2`); alvo de toque ≥ 24×24 px (WCAG 2.2), melhor 44.
- Estado pelo atributo, não por classe: `data-[state=open]:…`, `aria-expanded:…`, `group-data-[…]`, `peer-…`.

## Armadilhas

- **Classe montada por string não existe no CSS final.** `` `bg-${cor}-500` `` e `` `text-${tam}` `` não são detectadas. Escreva a classe inteira em um mapa (`{ vermelho: "bg-red-500", azul: "bg-blue-500" }`) ou use variante do CVA. Valor realmente dinâmico: variável CSS pelo atributo `style` (`--w`) lida com `w-(--w)`.
- **Valor arbitrário espalhado** (`w-[437px]`, `text-[#3b82f6]`) é sinal de token que falta: crie no `@theme`.
- `@apply` em CSS Module, Vue ou Svelte `<style>` precisa de `@reference "../app.css";` no topo.
- `hover:` só vale em dispositivo que tem hover (v4): no toque, não dispara; não dependa de hover para revelar ação.
- Ordem de variantes empilhadas agora é da esquerda para a direita (`*:first:pt-0`). `!` de importante vai no fim (`bg-red-500!`).
- Produção sem estilo: arquivo fora da detecção automática (`@source`), ou CSS importado errado no layout.
- Biblioteca de componentes usada por outro app: exponha as variáveis, não os valores, e documente o `@source` para ele.

## Migrando de v3 para v4

`npx @tailwindcss/upgrade` resolve a maior parte. Depois confira à mão: lista de utilitários renomeados e comportamento mudado em `referencias/migracao-v3-v4.md` (a cor de borda padrão virou `currentColor`; `ring` virou 1px; `outline-none` virou `outline-hidden`).

Fonte: adaptado de wshobson/agents (MIT, © 2024 Seth Hobson) e affaan-m/ECC (MIT)
