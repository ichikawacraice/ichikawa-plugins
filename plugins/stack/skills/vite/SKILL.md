---
name: vite
description: Vite para apps React/TypeScript — vite.config, variáveis de ambiente (VITE_ não é segredo), proxy de dev, chunks, build que não checa tipo, modo biblioteca, pré-bundle, deploy de SPA e erros comuns (chunk velho após deploy, Docker, monorepo, allowedHosts). Use ao mexer em vite.config.ts, .env, build lento ou quebrado, HMR com problema, ou ao subir a versão do Vite.
---

# Vite

Texto adaptado de affaan-m/ECC (MIT). Confira a versão: **Vite 7** usa Rollup/esbuild; **Vite 8** passa a usar Rolldown e Oxc (as opções viram `build.rolldownOptions`, `minify: "oxc"`; se algo da config não existir, veja o guia de migração da sua versão com o agente `docs`). Node 20.19+ ou 22.12+.

## Config mínima

```ts
// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), ["VITE_"]); // prefixo explícito
  return {
    plugins: [react(), tailwindcss(), tsconfigPaths()],
    server: command === "serve" ? { port: 3000, proxy: { "/api": { target: env.VITE_API_URL, changeOrigin: true } } } : undefined,
    build: { sourcemap: false },
  };
});
```

- `defineConfig` sempre (inferência de tipo). Alias que já está no `tsconfig.json` entra por `vite-tsconfig-paths`, não por 30 linhas de `resolve.alias`.
- React Compiler: `react({ babel: { plugins: ["babel-plugin-react-compiler"] } })`.
- Tailwind v4: plugin `@tailwindcss/vite`, sem PostCSS nem `tailwind.config`.

## Variáveis de ambiente

- Só o que começa com `VITE_` chega ao código do navegador, via `import.meta.env.VITE_X`. Tipos em `vite-env.d.ts` (`/// <reference types="vite/client" />`; declare as suas em `ImportMetaEnv`).
- **`VITE_` não é fronteira de segurança.** O valor é gravado em texto no bundle; minificar não esconde. Só URL pública, flag, chave pública. Token de API, URL de banco, `service_role` do Supabase ficam num servidor (função, Edge Function) que o app chama.
- **Armadilhas:** `loadEnv(mode, root, "")` carrega **tudo**, incluindo segredos, e um `define` as inlina no cliente; use lista de prefixos. `envPrefix: ""` expõe tudo.
- Arquivos: `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local` (os `.local` no `.gitignore`). `import.meta.env.MODE/DEV/PROD/BASE_URL`.
- Mudou `.env` com o servidor ligado? Reinicie.

## `vite build` não checa tipo

Ele só transpila: erro de TypeScript chega à produção. Rode `tsc --noEmit` (ou `tsc -b`) no CI e no gate, ou use `vite-plugin-checker` em dev. Em app com Tailwind/React isso é o erro mais barato de evitar.

## Dev server

- **Proxy** para o back-end: `server.proxy` (`changeOrigin: true` para host virtual; `rewrite` para tirar o prefixo; `ws: true` para websocket). Evita CORS em dev; em produção o CORS/rewrite é do servidor ou da hospedagem.
- **Docker/container/túnel:** `server.host: true` (0.0.0.0). Acesso por domínio de túnel (ngrok, Cloudflare) dá "Blocked request": acrescente em `server.allowedHosts`. Atrás de proxy reverso: `server.hmr.clientPort`.
- **Monorepo:** pacote fora da raiz é bloqueado; `server.fs.allow: [".."]` (ou a raiz do workspace).
- Dev lento: evite barrel `index.ts` (carrega tudo que reexporta), escreva extensão no import quando o projeto permitir, `server.warmup.clientFiles` para as rotas quentes, `vite --profile` + Speedscope para achar o plugin lento.
- Cache do pré-bundle fica em `node_modules/.vite`; erro fantasma depois de trocar de branch ou remendar dependência: apague a pasta (ou `vite --force`).
- CJS que dá erro de interop em dev: `optimizeDeps.include: ["pacote"]`.

## Build e chunks

- Divida por **rota** com `React.lazy` + `import()`, que é o que mais reduz a entrada. `manualChunks` só para separar vendor grande e estável (`react`, `react-dom`); nunca um chunk por pacote (centenas de arquivos).
- Analise antes de cortar: `rollup-plugin-visualizer` (com `enforce: "post"`).
- `@vitejs/plugin-legacy` só com dado real de navegador antigo: incha o bundle.
- Source map em produção expõe o código-fonte. Só envie ao Sentry e apague do deploy.
- `vite preview` é teste do build, **não servidor de produção**. Publique `dist/` em hospedagem estática (Vercel, Cloudflare Pages, Nginx).

## Deploy de SPA

- Rota do cliente (`/produto/123`) dá 404 se a hospedagem não reescrever tudo para `index.html`: configure o rewrite (Vercel `rewrites`, Cloudflare `_redirects`, Nginx `try_files`).
- `base` quando o app não está na raiz do domínio.
- **Chunk velho depois do deploy:** o usuário com a aba aberta pede `Page-abc123.js` que não existe mais. Escute o evento e recarregue: `window.addEventListener("vite:preloadError", () => window.location.reload())`. Mantenha os `assets/` antigos no ar por um tempo, se der.
- Cabeçalhos: `assets/*` com `Cache-Control: public, max-age=31536000, immutable`; `index.html` com `no-cache`.

## Modo biblioteca

`build.lib` com `entry` e `formats`. Dois cuidados: (1) o Vite **não emite tipos**: use `vite-plugin-dts` ou `tsc --emitDeclarationOnly`; (2) **externalize** peer dependencies (`react`, `react-dom`, `react/jsx-runtime`) em `rollupOptions.external` (`rolldownOptions` no 8), senão o consumidor fica com dois Reacts.

## SSR

Montar servidor SSR à mão é trabalho de autor de framework. Em app, use Next, React Router, TanStack Start ou Astro. O que se mexe: `ssr.noExternal` (força incluir no bundle pacote só-ESM que quebra) e `ssr.external`.

## Plugins úteis

`@vitejs/plugin-react` (Babel; aceita React Compiler), `@tailwindcss/vite`, `vite-tsconfig-paths`, `vite-plugin-checker`, `vite-plugin-svgr`, `vite-plugin-pwa`, `vite-plugin-dts`. Plugin próprio é raro: comece inline na config (`name`, `enforce`, `apply`, hooks `transform`/`resolveId`/`load`; módulo virtual com prefixo `\0`).

## Antipadrões

`require()` em código de app (Vite é ESM); `envPrefix: ""`; um chunk por pacote; esperar que o build cheque tipo; tratar `preview` como produção; apagar `node_modules/.vite` só quando "dá erro" sem saber por quê; reatribuir `import.meta.hot.data` (mute as propriedades).

Fonte: adaptado de affaan-m/ECC (MIT)
