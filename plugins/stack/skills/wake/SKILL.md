---
name: wake
description: Wake Commerce (ex-Fbits/Traycorp) — Storefront API GraphQL (TCS-Access-Token, product/search/uri, checkout de createCheckout a checkoutComplete, login do cliente, partnerAccessToken), API administrativa REST (token, limite de 120 chamadas/min, Retry-After), webhooks, paginação e tema Storefront 2.0 com Scriban e Storefront SDK. Use ao integrar com loja Wake, montar vitrine ou checkout headless sobre a Storefront API, escrever integração de pedido/estoque pela API REST, receber webhook da Wake ou mexer em tema Scriban.
---

# Wake Commerce

Plataforma brasileira de e-commerce (antiga Fbits, da Traycorp). Dois mundos com credenciais diferentes: a **Storefront API** (GraphQL, para a vitrine) e a **API administrativa** (REST, para integração de back-office). A doc oficial é `wakecommerce.readme.io`, com explorador GraphQL na aba **GraphQL** do portal; no Context7, `/llmstxt/wakecommerce_readme_io_llms_txt`. Nome de campo e mutation: confira no schema do explorador, não na memória — várias mudaram de nome.

## Storefront API (GraphQL)

- **Autenticação da loja:** cabeçalho `TCS-Access-Token`. A loja é identificada pelo token (a query `shop` devolve nome, `mainUrl`, `checkoutUrl`, chave do reCAPTCHA). **Endpoint:** pegue o do painel/explorador da loja; não fixe URL da memória.
- **Trate o token como credencial:** a doc não diz que ele é público. Chame a API do seu servidor (route handler, BFF) e guarde o token em variável de ambiente, nunca com prefixo público (`NEXT_PUBLIC_*`, `VITE_*`).
- **Cliente logado:** `customerAuthenticatedLogin` (a antiga `customerAccessTokenCreate` está **descontinuada**). O token vale ~12 h; renove com `customerAccessTokenRenew`. Ele vai **como argumento** da query/mutation (`customer(customerAccessToken: …)`, `checkoutAddressAssociate(customerAccessToken: …)`), não como cabeçalho. No navegador, só em cookie `httpOnly`.
- **Roteamento da vitrine:** `uri(url: "/caminho")` diz o que é a URL — `kind` = `PRODUCT`, `HOTSITE` (subtipo `CATEGORY`, `BRAND`, `PORTFOLIO`, `BUY_LIST`), `REDIRECT` (com `redirectCode`/`redirectUrl`), `NOT_FOUND` ou `PARTNER`. Use isso para escolher o template e devolver 301/404 de verdade (SEO).
- **Catálogo:** `product`, `products`, `search(query:)` (traz `breadcrumbs` e `redirectUrl`), `autocomplete`, `hotsite`.

### Paginação

- Cursor (`first`/`after`, `last`/`before`) nas *connections* — `edges { node { … } }`.
- `limit`/`offset` em `search` e `hotsite`, **limitado a 10 mil produtos**: listagem completa de catálogo vai pela API REST ou por cursor, não por offset.

### Parceiros (preço e sortimento por grupo)

`partnerAccessToken` muda produto, preço e disponibilidade. Três tipos: **aberto** (vem da query `partners`, qualquer visitante), **fechado** (`partnerAccessTokenCreate`, com usuário e senha) e **por cliente** (vem da query `customer`). Passe o token em toda chamada de produto daquela sessão; esquecer em uma mostra o preço errado. Resposta com parceiro **não** pode ir para cache compartilhado sem o token na chave.

### Checkout headless (ordem do fluxo)

1. `createCheckout(products: [{ productVariantId, quantity }])` → `checkoutId` (Uuid). Depois, `checkoutAddProduct` para somar itens.
2. Login do cliente (acima) e `checkoutAddressAssociate(customerAccessToken, addressId, checkoutId)` → devolve `cep` e a `url` do checkout.
3. Frete: cotações do checkout e `checkoutSelectShippingQuote(checkoutId, shippingQuoteId, additionalInformation?)` — `additionalInformation` (documento e nome) é para retirada em loja.
4. Cupom: `checkoutAddCoupon(checkoutId, coupon, customerAccessToken?)`.
5. `checkoutSelectPaymentMethod(checkoutId, paymentMethodId)` → parcelas (`installments`).
6. `checkoutComplete(checkoutId, customerAccessToken, paymentData)` → `completed`.

Cuidados no fechamento:
- `paymentData` leva **dado de cartão** codificado em URL. Se passar pelo seu servidor, você entra no escopo PCI: nunca registre em log, nunca guarde, e prefira o checkout da própria Wake (`checkoutUrl`) quando não houver motivo forte para o headless.
- Erro vem em `errors[].extensions.code`: `GTW100` (falha ao processar o meio de pagamento), `GTW101` (recusa da adquirente, com `acquirerReturnCode` quando ela informa). O mapeamento código → mensagem amigável é do front.
- Valor (total, frete, desconto) sempre o que a API devolveu; nunca calcule preço no cliente e mande de volta.

## API administrativa (REST)

- Token gerado no painel (**Configurações › Integrações › Tokens**), confidencial, só no servidor. Os exemplos da doc usam o domínio `api.fbits.net`; confira o formato do cabeçalho de autenticação na página do endpoint antes de escrever o cliente.
- **Limite: 120 chamadas por minuto, por grupo de endpoint.** Excedeu → resposta com `Retry-After`. **Cinco excessos com o limite esgotado bloqueiam o token por 1 hora** — o que derruba toda a integração. Respeite o `Retry-After`, ponha fila com taxa (ex.: um *worker* por grupo) e nunca faça laço de repetição sem espera.
- Carga grande (catálogo, estoque, preços): lote, horário de baixo tráfego e retomada pelo último ID processado.

## Webhooks

- Cadastro pela API (`/webhook/inscricao`); entrega por `POST` com JSON.
- **A doc não descreve assinatura (HMAC).** A proteção disponível são cabeçalhos personalizados cadastrados junto (ex.: um segredo seu). Confira esse cabeçalho em tempo constante, responda 2xx rápido e processe em fila.
- Trate como **notificação, não verdade**: busque o pedido/produto na API antes de agir, e seja idempotente (o mesmo evento pode chegar mais de uma vez).

## Tema (Storefront 2.0)

- Templates `.html` com **Scriban**; o repositório do tema fica no GitLab da Wake (acesso pelo painel, em **Repositório (Git)**), com *merge request* para publicar. Confira o fluxo de publicação da loja antes de mexer na branch principal.
- Interação no navegador: **Storefront SDK** (`storefront-sdk.min.js`, objeto global `StorefrontClient`; na 2.0, o SDK Full). Não é Next.js nem React.
- Vitrine própria em Next/React é o caminho *headless*: Storefront API no servidor, SEO pelo `uri`, e o checkout da Wake ou o fluxo acima.

## Ambiente de teste

A doc cita um ambiente de testes com acesso pedido à Wake (canal de parceiros). Não teste mutation de checkout, webhook ou carga REST na loja de produção.

Fonte: texto próprio, fatos conferidos em wakecommerce.readme.io (via Context7 e web) em 13/11/2026.
