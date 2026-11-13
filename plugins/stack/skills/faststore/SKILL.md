---
name: faststore
description: VTEX FastStore v4 (e v3 em manutenção) — discovery.config.js, pasta .faststore x src/, override de seção nativa com getOverriddenSection e src/components/index.tsx, extensão da API GraphQL (src/graphql/vtex e thirdParty, fragments em src/fragments com gql de @faststore/core/api), tema SCSS com tokens --fs-* e data-fs-*, conteúdo no Content Platform (vtex content) ou Headless CMS legado, CLI faststore e WebOps. Use ao criar ou mexer numa loja FastStore, customizar seção, PDP/PLP, buscar dado novo do catálogo ou de API de terceiro, estilizar, subir de versão (v3 → v4) ou investigar erro de build/deploy no WebOps.
---

# VTEX FastStore

Vitrine headless da VTEX sobre Next.js, empacotada no `@faststore/core`. Você não escreve um app Next: você **customiza** o core por pastas e funções previstas. **Primeiro descubra a versão** (`@faststore/core` no `package.json`): a doc antiga (v1/v2, incluindo o que o Context7 traz em `/vtex/faststore-docs`) ensina caminhos que não existem mais. Doc atual: `developers.vtex.com/docs/guides/faststore`. Dúvida de API: agente `docs` com essa URL.

## Versões (conferido em 13/11/2026)

- **v4 é a atual** (`@faststore/core` e `@faststore/cli` 4.11.x). O core traz o **Next 16** como dependência e fixa `react`/`react-dom` **18.2.0** como *peer*. v3 segue em manutenção, mas projeto novo é v4.
- **Não declare `next` no `package.json` da loja** na v4: quem gerencia é a CLI. Versão de React diferente da do core quebra o build.
- Node: o pacote exige `>=20.9`; o WebOps roda a v4 em **Node 24** (`experimental.nodeVersion: 24` no config + ajuste no WebOps).
- Recursos com versão mínima: `api.customSortMap` (4.9+), `api.preserveCartLines` (4.10.3+). Confira antes de usar.
- Vindo da v2: primeiro o guia v2 → v3, depois o v3 → v4.

## Estrutura

- `.faststore/` é gerada pelo core a cada `dev`/`build`: **não edite nem versione**; mudança ali some. Toda customização vai em `src/`.
- `discovery.config.js` (antigo `faststore.config.js`, renomeado em dez/2024): `platform: "vtex"`, `api.storeId`, `api.workspace`, `api.environment`, `session` (moeda, locale, canal, país), `seo`, `storeUrl`, `secureSubdomain`, `checkoutUrl`, `analytics.gtmContainerId`, `theme`, `contentSource`, `experimental`.
- `vtex.env` é **só para o ambiente local** e não guarda segredo. Variável de produção: WebOps › Settings › *Variables and Secrets*.
- CLI `faststore`: `dev`, `build`, `start`, `generate-graphql`, `test`. Rode pelos scripts do `package.json` (`yarn dev`), que já apontam para ela.

## Customizar seção nativa (override)

Seção nativa (`ProductDetails`, `Hero`, `Navbar`, `ProductShelf`, `Alert`…) se customiza trocando ou ajustando os **componentes internos**, sem copiar a seção.

```tsx
// src/components/sections/ProductDetailsCustom.tsx
import { getOverriddenSection, ProductDetailsSection } from "@faststore/core";
import CustomBuyButton from "../CustomBuyButton";

export default getOverriddenSection({
  Section: ProductDetailsSection,
  components: {
    BuyButton: { Component: CustomBuyButton }, // troca o componente
    Icon: { props: { weight: "bold" } },       // só ajusta props
  },
});
```

```tsx
// src/components/index.tsx — registra pelo nome da seção nativa
import ProductDetailsCustom from "./sections/ProductDetailsCustom";
export default { ProductDetails: ProductDetailsCustom };
```

- As chaves de `components` são os nomes internos que a seção usa: confira na lista de seções nativas da doc antes de inventar.
- Prefira `props` a `Component`: trocar o componente inteiro tira você das correções que vêm no core.
- Componente customizado que precisa de estado/efeito segue as regras de React da skill `react`; dado de catálogo vem pela API (abaixo), não por `fetch` solto no cliente.

## Dado novo: estender a API GraphQL

- **Dado da VTEX** (campo a mais em produto, por ex.): `src/graphql/vtex/typeDefs/*.graphql` (`extend type StoreProduct { … }`) e `src/graphql/vtex/resolvers/` com `index.ts`. Os dois caminhos são **obrigatórios** com esse nome.
- **API de terceiro** (ERP, review, frete próprio): `src/graphql/thirdParty/typeDefs/` e `src/graphql/thirdParty/resolvers/`.
- **Levar o campo até a seção:** *fragment* em `src/fragments/<NomeDaQuery>.ts` (o nome do arquivo é o da query que você estende: `ServerProduct`, `ClientProduct`, `ClientManyProducts`, `ServerCollectionPage`…), com `gql` de **`@faststore/core/api`** (`@faststore/graphql-utils` saiu na v4).
- Todo `.graphql` dessas pastas entra no `dev` e no `build`. Mudou schema ou fragment e não apareceu: reinicie o `dev` (e rode `faststore generate-graphql` se o projeto usa tipos gerados).
- Resolver roda no servidor: segredo de API de terceiro fica em variável de ambiente do WebOps, nunca no front. Não confie na resposta de terceiro (valide com schema), e não pegue mais campo do que a página usa (*overfetching* pesa em toda PLP).
- Pela convenção de nome, `Server*` estende a consulta feita no servidor (entra no HTML inicial, bom para SEO) e `Client*` a feita no navegador. Preço, título e o que o Google precisa ver: no `Server*`.

## Tema e estilo

- `src/themes/custom-theme.scss`, e o nome tem de bater com `theme` no `discovery.config.js`.
- Mude **tokens** (`--fs-color-*`, `--fs-spacing-*`…) antes de escrever CSS novo; para mirar um componente, use o atributo `[data-fs-*]` dele, não classe gerada.
- v4: SCSS com `@use`, não `@import`; utilitários não são mais globais (`@use "@faststore/ui/src/styles/base/utilities" as u;`).
- Estilo de componente próprio: CSS Module ao lado do arquivo (`./x.module.scss`).

## Conteúdo (CMS)

- **v4 com Content Platform** (`contentSource.type: "CP"`): esquemas em `cms/faststore/` (`components`, `pages`, `schema.json`), enviados com a CLI da VTEX — `vtex content generate-schema` / `upload-schema`. `contentSource.project` tem de bater com o store ID do CMS.
- **Headless CMS legado** (`contentSource.type: "CMS"`, e v3): `cms/faststore/sections.json` e `content-types.json`, sincronizados com `faststore cms-sync` / `vtex cms sync`.
- Sempre num **workspace de desenvolvimento** (`vtex use <nome>`) antes do `master`. Depois de upgrade, reenvie o schema.

## Deploy (WebOps)

- O build roda no FastStore WebOps; erro de lá quase sempre é versão de Node, `next`/`react` declarado à mão, ou variável que só existe no `vtex.env` local.
- Preview por branch antes de produção; domínio vem de `storeUrl` + Host configurado no WebOps.

## Armadilhas

- Conselho de Next "puro" (App Router, `proxy.ts`, `"use cache"`) **não vale** aqui sem conferir: o core decide roteamento e cache. A skill `nextjs` serve para entender o que roda por baixo, não para mudar a estrutura.
- Copiar o código de uma seção nativa para `src/` em vez de override: perde atualização e duplica bug.
- Upgrade v3 → v4 traz quebras de componente (ex.: `ScrollToTopButton` tem de ser adicionado à mão em PLP e busca): siga o guia oficial de upgrade, item por item.

Fonte: texto próprio, fatos conferidos em developers.vtex.com/docs/guides/faststore e no registro npm (`@faststore/core` 4.11.3) em 13/11/2026.
