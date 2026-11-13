---
name: react
description: Padrões de React 19 e TypeScript para escrever e revisar componentes — hooks, estado, efeitos, formulários com actions, fronteira server/client, Suspense e erros, listas, acessibilidade. Use ao criar ou mudar componente, hook ou formulário React, ao migrar de React 18, ou quando "useEffect" parece a resposta para tudo.
---

# React 19

Texto adaptado de affaan-m/ECC (MIT) e, na parte de composição e desempenho, de vercel-labs/agent-skills (MIT, © Vercel). Detalhes em `referencias/`: `composicao.md` (componentes que escalam), `desempenho.md` (cascatas, bundle, re-render). Teste de componente e de tela: skill `orquestracao:testes-de-tela`.

## O que mudou no React 19 (erro comum de quem vem do 18)

- **`ref` é prop comum.** Sem `forwardRef`: `function Input({ ref, ...props }: Props & { ref?: React.Ref<HTMLInputElement> })`. `forwardRef` ainda funciona, não escreva em código novo.
- **`<Ctx value={…}>`** no lugar de `<Ctx.Provider>`. **`use(Ctx)`** lê contexto e, ao contrário de `useContext`, pode estar dentro de `if`. `use(promise)` lê uma promessa criada **fora** do render (do servidor ou de cache), com `<Suspense>`; promessa criada no render recria a cada vez.
- **Formulário com action:** `<form action={fn}>` chama `fn(formData)`, reseta os campos no sucesso e não precisa de `preventDefault`. Estado e pendência: `useActionState(fn, estadoInicial)` devolve `[estado, action, pendente]`; `useFormStatus()` (de `react-dom`) lê a pendência no filho do form; `useOptimistic` mostra o resultado antes do servidor responder e volta sozinho se falhar.
- **`useEffectEvent`** (19.2): leia valor novo dentro de efeito sem pôr na lista de dependências. **`<Activity mode="hidden">`** (19.2) esconde sem desmontar e preserva estado (abas, painéis).
- **`<title>`, `<meta>`, `<link>` no componente** são levados ao `<head>` pelo React; no Next use a API de `metadata`.
- **Tipos:** `useRef<T>(null)` exige o argumento e dá `RefObject<T | null>`; o namespace global `JSX` sumiu (`React.JSX.Element`); `ref={el => (guarda = el)}` agora é erro (callback de ref pode devolver função de limpeza, então escreva com chaves). `props` de `ReactElement` é `unknown`.
- **React Compiler 1.0** memoiza sozinho. Com ele ligado (`babel-plugin-react-compiler`, ou `reactCompiler: true` no Next), pare de escrever `useMemo`/`useCallback`/`memo` de rotina.
- Erros: `createRoot(el, { onCaughtError, onUncaughtError })` para reportar a um monitor; erro de hidratação agora mostra um diff.

## Regras que valem sempre

1. **Render é função pura de props e estado.** Calcule o derivado no render; não guarde em estado nem sincronize com efeito.
2. **`useEffect` é para sincronizar com sistema externo** (assinatura, API do navegador, biblioteca de terceiros). Não é para: derivar estado, transformar dado para exibir, reiniciar estado quando a prop muda (use `key` no pai), avisar o pai (chame o callback no handler), buscar dado da aplicação (use RSC, TanStack Query ou SWR: efeito + `fetch` dá corrida, sem cache, sem retry).
3. **Todo efeito que assina algo limpa.** Listener, intervalo, `fetch` com `AbortController`.
4. **Hooks no topo**, nunca em condição, laço ou depois de `return` antecipado. Ligue `react-hooks/rules-of-hooks` e `exhaustive-deps` como erro; `eslint-disable` de dependência pede comentário do motivo.
5. **Atualização que depende do valor anterior usa a forma funcional:** `setN(n => n + 1)`.
6. **Nunca mude estado no lugar** (`lista.push`, `obj.x = 1`). Crie cópia: `[...lista, item]`, `{ ...obj, x: 1 }`, `toSorted()`.
7. **Não defina componente dentro de componente**: a cada render vira outro tipo e desmonta os filhos.
8. **`key` estável e único** (id do banco), nunca o índice em lista que muda. `key` também reinicia um componente de propósito.
9. **`{n > 0 ? <X/> : null}`**, não `{n && <X/>}`: o `0` aparece na tela.

## Onde fica o estado

```
Um componente só usa?            -> useState nele
O pai e alguns descendentes?     -> suba para o ancestral comum
Longe na árvore, muda pouco?     -> Context (tema, usuário, idioma)
Muda toda hora e é compartilhado -> store (Zustand, Jotai)
Vem do servidor?                 -> RSC, TanStack Query ou SWR (não copie para store)
Pode ser compartilhado por link? -> URL (filtro, ordem, página, aba, busca)
Formulário grande?               -> React Hook Form / TanStack Form
```

Quase nenhuma página precisa de store global. Context com valor que muda a toda hora re-renderiza todos os consumidores: separe um contexto por assunto.

## Server e Client Components

- Padrão é **Server Component** (assíncrono, não manda JS próprio). Só ponha `"use client"` onde há estado, efeito, handler de evento ou API do navegador, e o mais fundo na árvore que der: a diretiva arrasta tudo que o arquivo importa.
- Server → Client só passa props **serializáveis** (sem função, classe, `Date` vira string se serializar à mão) ou `children`. Passe o campo que o cliente precisa, não o registro inteiro: usuário com hash e token no objeto vaza no payload.
- Client Component não importa Server Component; receba-o por `children`/prop.
- Módulo que não pode ir ao navegador (banco, chave) importa `server-only` para quebrar o build se alguém o puxar para o cliente.
- **Server Action (`"use server"`) é endpoint público.** Valide a entrada com schema, autentique **dentro** da action, confira que o usuário pode mexer **naquele** registro. A função de action vive em arquivo próprio com `"use server"` no topo (ou inline em Server Component); em arquivo `"use client"` não pode ser definida. Não ligue o `service_role` do Supabase ao cliente.
- Variável com prefixo público (`NEXT_PUBLIC_*`, `VITE_*`) vai para o bundle: nunca segredo.

## Formulários

```tsx
"use client";
import { useActionState } from "react";
import { atualizarPerfil } from "./actions"; // arquivo com "use server"

export function PerfilForm() {
  const [estado, action, pendente] = useActionState(atualizarPerfil, { erro: null });
  return (
    <form action={action}>
      <label htmlFor="nome">Nome</label>
      <input id="nome" name="nome" required />
      <button type="submit" disabled={pendente}>Salvar</button>
      {estado.erro && <p role="alert">{estado.erro}</p>}
    </form>
  );
}
```

- Campo precisa de `name` para entrar no `FormData`. Input controlado só quando o valor dirige outra parte da tela ou valida a cada tecla.
- Valide **no servidor** sempre; a validação do cliente é conforto.

## Suspense e erros

- `<Suspense>` perto do dado, não na raiz da rota: a página pinta o que já tem. Reserve o espaço (esqueleto ou `min-height`) para não dar salto de layout.
- Error boundary pega erro de render, não de handler nem de código assíncrono. Use `react-error-boundary`; no Next, `error.tsx` (que é Client Component).

## Acessibilidade (a parte que o revisor mais acha)

- HTML semântico antes de `role`: `<button>` para ação, `<a href>` para navegação, `<nav>`, `<main>`. `<div onClick>` não recebe teclado.
- Todo `input` tem `<label htmlFor>` ou `aria-label`. `<img>` tem `alt` (`alt=""` se decorativa).
- Foco: ao abrir modal, mova o foco para dentro e devolva ao fechar; use o `Dialog` do Radix/shadcn em vez de montar trap de foco à mão.
- Erro e estado não dependem só de cor. `target="_blank"` leva `rel="noopener noreferrer"`.
- Rode `axe` (`vitest-axe`/`jest-axe`) nos testes de componente interativo.

## Segurança em React

- `dangerouslySetInnerHTML` só com HTML sanitizado **no mesmo ponto** (DOMPurify com allowlist). Markdown do usuário: biblioteca que sanitiza.
- URL vinda do usuário em `href`/`src`: confira o esquema (`http:`, `https:`, `mailto:`). O React avisa de `javascript:` mas não bloqueia.
- Token de sessão em cookie `httpOnly`, não em `localStorage`.

## Antes de memoizar

Meça no Profiler. `memo`/`useMemo`/`useCallback` sem ganho medido é ruído (e, com Compiler, redundante). Vale para: filho caro que recebe as mesmas props quase sempre, valor cuja identidade entra em dependência de outro hook, cálculo pesado. Lista com mais de ~50 linhas não triviais: virtualize (`@tanstack/react-virtual`).

Fonte: adaptado de affaan-m/ECC (MIT) e vercel-labs/agent-skills (MIT)
