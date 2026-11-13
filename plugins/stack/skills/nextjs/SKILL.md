---
name: nextjs
description: Next.js 15/16 com App Router — fronteira server/client, params e cookies assíncronos, cache (fetch, "use cache", revalidate), Server Actions, proxy.ts, Turbopack, hidratação, metadata e variáveis de ambiente. Use ao escrever ou depurar app/, route handlers, middleware/proxy, erro de hidratação, página que não atualiza ou que ficou lenta, ou ao subir de versão do Next.
---

# Next.js (App Router, 15 e 16)

Texto adaptado de affaan-m/ECC (MIT). **Primeiro descubra a versão** (`next` no `package.json`) e se o projeto usa `app/` ou `pages/`: quase todo erro aqui é conselho de uma versão aplicado em outra. Dúvida de API: agente `docs` (context7) em vez da memória. **VTEX FastStore** é Next por baixo, mas fixa a própria versão e estrutura (`@faststore/core`); não presuma App Router nem `proxy.ts` nele, leia o que está instalado.

## O que mudou (confira a versão antes de aplicar)

**Next 15**
- `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` são **assíncronos**: `const { id } = await params;`. Em componente cliente, `use(params)`. Codemod: `npx @next/codemod@canary upgrade latest`.
- `fetch`, rota GET e o Router Cache do cliente **deixaram de cachear por padrão**. Cache agora é opt-in: `fetch(url, { cache: "force-cache" })`, `next: { revalidate: 60, tags: ["produto"] }`, `export const dynamic = "force-static"`.
- `after()` roda trabalho depois da resposta. `<Form>` de `next/form`. React 19.

**Next 16**
- **Turbopack é o padrão** em `dev` e `build`. Plugin de webpack só existe com `--webpack`.
- **`middleware.ts` virou `proxy.ts`** (função exportada `proxy`, runtime Node). **Não aponte `proxy.ts` como erro em Next 16**, e não renomeie de volta: quebra.
- **Cache Components**: `cacheComponents: true` no `next.config`. Tudo é dinâmico por padrão e você marca o que cacheia com a diretiva **`"use cache"`** (função, componente ou arquivo), com `cacheLife("hours")` e `cacheTag("produto")`. Substitui `experimental.ppr`, `dynamicIO` e, na prática, `unstable_cache`. Dado de requisição (`cookies()`, `headers()`, `searchParams`) fica **fora** do escopo `"use cache"`: leia fora e passe como argumento.
- `revalidateTag(tag, "max")` passa a pedir o perfil de cache como 2º argumento. Em Server Action que precisa ler o que acabou de gravar, `updateTag(tag)`; `refresh()` atualiza a rota.
- React Compiler estável (`reactCompiler: true`). `next lint` removido (rode ESLint/Biome direto). Node 20.9+. Rota paralela exige `default.js`.

## Server e Client (a regra de ouro)

1. Tudo em `app/` é Server Component até haver `"use client"`. Ponha a diretiva na **folha** (o botão, não a página).
2. Biblioteca de terceiros que usa estado/efeito sem `"use client"` quebra no servidor: embrulhe num componente seu com a diretiva.
3. Provider de contexto (tema, Query, auth) é Client Component que recebe `children` e fica no layout; o resto continua servidor.
4. Passe Server Component para dentro de Client Component **como `children`/prop**, nunca importando.
5. `import "server-only"` em módulo de banco/segredo; `client-only` no inverso.
6. Props para o cliente: só o necessário e serializável.

## Cache: quem está servindo dado velho?

Diagnóstico em ordem:
1. Qual versão? (15 = opt-in; 16 com `cacheComponents` = `"use cache"`; 14 ou menos = cache agressivo por padrão.)
2. A rota é estática ou dinâmica? `next build` lista `○` (estática) e `ƒ` (dinâmica). Usar `cookies()`/`headers()`/`searchParams` torna dinâmica.
3. Há tag/`revalidate` onde o dado muda? Server Action que grava chama `revalidatePath("/produtos")` ou `revalidateTag(...)`/`updateTag(...)`.
4. CDN/borda na frente (Vercel, Cloudflare, VTEX): olhe `Cache-Control` da resposta, o cache do Next não é o único.
5. Router Cache do cliente: `router.refresh()` ou `refresh()` na action.

`React.cache` só deduplica dentro de uma requisição; não é cache entre usuários.

## Server Actions

- `"use server"` num **arquivo próprio** (ou inline em Server Component). Não dá para definir em arquivo `"use client"`; importe de lá.
- É endpoint público: valide com schema, **autentique dentro** e confira o dono do registro. Variável capturada por closure é criptografada, mas não é autorização.
- Devolva erro como dado (`useActionState`), não lance para validação de formulário.
- `redirect()` fora do `try/catch` (ele lança de propósito).

## Route handlers e proxy

- `app/api/x/route.ts` exporta `GET`, `POST`…; `params` assíncrono: `ctx: { params: Promise<{ id: string }> }`.
- Webhook: leia o corpo bruto (`await req.text()`) para conferir a assinatura antes de `JSON.parse`; trate repetição de evento com idempotência.
- `proxy.ts` (16) / `middleware.ts` (≤15): auth leve, redirecionamento, reescrita, cabeçalhos. Não faça consulta de banco pesada nele. O `matcher` exclui `_next/static`, imagens e `favicon`.
- Autorização de verdade fica na **fonte do dado** (Server Component, action, RLS), não só no proxy.

## Hidratação (`Hydration failed…`)

Causas, da mais comum à rara:
1. Valor diferente entre servidor e cliente: `Date.now()`, `Math.random()`, `new Date().toLocaleString()` (fuso/idioma), `window`/`localStorage` lidos no render. Conserto: leia no `useEffect`/`useSyncExternalStore`, ou renderize igual e ajuste depois.
2. HTML inválido: `<div>` dentro de `<p>`, `<a>` dentro de `<a>`, `<tr>` fora de `<tbody>`.
3. Extensão do navegador mexendo no DOM (confirme em janela anônima).
4. `suppressHydrationWarning` só em folha com diferença esperada (relógio), nunca em subárvore.
5. `next/dynamic` com `ssr: false` só dentro de Client Component.

## Metadata, SEO e imagens

- `export const metadata` / `generateMetadata` (assíncrono, com `await params`); dado repetido com a página: `React.cache`. Canonical em `alternates.canonical`; `app/sitemap.ts`, `app/robots.ts`; JSON-LD num `<script type="application/ld+json">` (escape `<` como `<`).
- `next/image` com `width`/`height` (ou `fill` + `sizes`), `priority` na imagem do LCP; `remotePatterns` no config para domínio externo (VTEX CDN, Supabase Storage).
- `next/font` auto-hospeda e evita CLS.
- `useSearchParams` em rota estática precisa de `<Suspense>` por cima, senão o build reclama.

## Arquivos especiais

`loading.tsx` (Suspense da rota), `error.tsx` (**Client Component**; pega erro da árvore abaixo, não o do `layout.tsx` do mesmo segmento; para o layout raiz use `global-error.tsx`), `not-found.tsx` + `notFound()`, `template.tsx` (remonta a cada navegação, `layout.tsx` não).

## Variáveis de ambiente

- `NEXT_PUBLIC_*` é **trocado no build** e vai ao navegador: nunca segredo, e mudar o valor em runtime não muda o bundle (rebuilde).
- Sem prefixo só existe no servidor. Valide no start (`zod` sobre `process.env`) para falhar cedo.

## Turbopack e build

- Dev lento: confira que está no Turbopack (padrão no 16), que `.next` não está sendo apagado a cada vez e se há `import` de barrel enorme.
- Peso do bundle: `@next/bundle-analyzer` (ou o analisador experimental do 16.1+).
- Plugin de webpack sem equivalente: `next dev --webpack` / `next build --webpack` como saída temporária, e abra tarefa para migrar.
- Docker: `output: "standalone"`.

Fonte: adaptado de affaan-m/ECC (MIT)
