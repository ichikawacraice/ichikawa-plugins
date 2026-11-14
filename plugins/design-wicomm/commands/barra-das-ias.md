---
description: Instala a barra das IAs da Wicomm (a moldura do Wicomm Station) num app Next da família, do registro, igual em todo app (ANATOMIA, CASCO-05).
argument-hint: "[id deste app: artemis, empiria, izanagi, octo, prometheus, talos]"
---

Instale a barra das IAs da Wicomm neste app, do registro `@wicomm`, sem redesenhar nada (ANATOMIA, CASCO-05). Id deste app indicado: `$ARGUMENTS` (vazio = deduza pelo nome do repositório e confirme comigo).

1. **Confira antes.** O app é Next com App Router e já usa o registro: `components.json` com `"registries": { "@wicomm": "https://wicomm-atelie.vercel.app/r/v0.1.0/{name}.json" }`. Sem isso, rode antes o `/design-wicomm:novo` (projeto novo) ou o passo 1 dele. O id tem de estar na lista do registro (`artemis`, `empiria`, `izanagi`, `octo`, `prometheus`, `talos`); IA nova entra primeiro no tema do ateliê (`temas/wicomm/ias/` no `wicomm-atelie`, com o boneco), não no app.
2. **Instale:** `npx -y shadcn@4.21.5 add @wicomm/barra-das-ias --yes`. Grava `components/barra-das-ias.tsx`, `lib/ias-da-wicomm.ts`, `lib/barra-das-ias-no-next.tsx` e `lib/barra-aberta-no-servidor.ts`, e traz o logotipo e o monograma.
3. **Ligue no layout raiz** (`app/layout.tsx`, componente de servidor `async`): envolva todo o conteúdo do `<body>`, o casco inclusive, com
   ```tsx
   <BarraDasIasNoNext atual="<id>" comBarra={…} foraDaBarra={[…]} abertaInicial={await barraAbertaNoServidor()} pessoa={{ id, nome, foto }}>
   ```
   - `pessoa`: quem está logado (`foto` é uma URL `https` ou `null`; sem ela, saem as iniciais).
   - `comBarra`: quem está logado pode ver as IAs (o papel decide); nas telas sem login, `false`.
   - `foraDaBarra`: prefixos das rotas de tela inteira (o Editor, por exemplo), como strings: o layout de servidor não passa RegExp ao cliente.
4. **Cópia antiga:** se o app já tinha a barra própria (componente, lista das IAs, bonecos em `public/`), apague-a e troque as importações pelas do registro. O cookie agora se chama `barra-das-ias`: quem tinha a barra oculta a vê aberta uma vez — diga isso no PR.
5. **Não adapte.** Classe, medida, movimento e texto são os do registro. Se algo não encaixar, diga o quê e pare: o conserto vai para o registro (`wicomm-atelie`), não para a cópia do app.
6. **Confira:** typecheck, testes, `wicomm-guardas` e build, com a saída à vista; abra o app nos dois temas, com a barra aberta e oculta. O guia e o prompt estão em `https://wicomm-atelie.vercel.app/catalogo/barra-das-ias/`.
