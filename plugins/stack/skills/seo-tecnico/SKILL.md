---
name: seo-tecnico
description: SEO técnico para e-commerce e sites em Next.js, FastStore e Wake — rastreamento e indexação (robots, sitemap, canonical, redirect, noindex), URLs de produto/categoria/filtro, dados estruturados (Product, Offer, BreadcrumbList), title e meta description, hreflang, Core Web Vitals e erros que derrubam a indexação. Use ao criar página de produto ou categoria, mexer em rota, redirect, sitemap, metadata ou JSON-LD, ou ao investigar queda de tráfego orgânico. Para auditar um site ou diff, use o agente stack:seo.
---

# SEO técnico

Corrija o que bloqueia antes de otimizar o texto. Cada recomendação aponta para uma página ou arquivo concreto; leia a página real antes de opinar. O agente `stack:seo` audita em cima desta skill.

## Rastreamento e indexação

- **robots.txt** libera o que importa e bloqueia só o que não deve ser rastreado (busca interna, carrinho, checkout, parâmetros de sessão). Bloquear no robots **não** tira da busca; para isso, `noindex` (e a página precisa ser rastreável para o `noindex` ser lido).
- Nenhuma página importante com `noindex` por herança de layout ou de ambiente: **confira que `noindex` de homologação não foi para a produção** (erro clássico em deploy).
- Páginas importantes a poucos cliques da home; paginação e categorias linkadas com `<a href>` real, não só por clique em JS.
- Redirect: 301 definitivo, no máximo uma ou duas voltas, sem cadeia nem laço. Produto descontinuado: 301 para o substituto ou a categoria; 404/410 quando não há equivalente. Evite "soft 404" (página vazia com status 200).
- **Canonical** autorreferente e consistente; uma URL preferida (com/sem barra final, `https`, `www` ou não). Variações por filtro/ordenação/utm apontam o canonical para a versão limpa.
- **Sitemap** só com URLs canônicas, indexáveis e com status 200; gerado a partir do catálogo, com `lastmod` verdadeiro. Dividido por tipo quando o catálogo é grande. Declarado no robots.
- Multi-idioma/região: `hreflang` recíproco e com canonical coerente; sem isso, deixe de fora.

## URLs de e-commerce

- Produto: `/produto-nome-slug/p` (FastStore/VTEX) ou o padrão da plataforma — estável, legível, sem ID de sessão. Mudar slug exige 301 do antigo.
- **Filtros e facetas** geram milhares de URLs quase iguais: indexe só as combinações com demanda de busca real (ex.: marca + categoria); as demais com canonical para a categoria, `noindex, follow`, ou fora do rastreamento por parâmetro.
- Variações de SKU (cor, tamanho) normalmente são uma página com canonical único, não uma por SKU.
- Páginas de categoria precisam de conteúdo próprio (título, texto breve útil, links), não só grade de produtos.

## Metadata (title, description, h1)

- `title` único por página, ~50–60 caracteres, tema principal no começo, marca no fim: `Tênis de corrida masculino Marca X | Loja`.
- `meta description` ~120–160 caracteres, honesta, com o benefício (preço, frete, estoque, diferencial). Não influencia posição direto, influencia clique.
- Um `h1` por página, igual à intenção da busca; `h2/h3` seguem a hierarquia do conteúdo, não o visual.
- Título/descrição geridos por produto e categoria; **template com a mesma string em todas as páginas** é o erro número um (`Duplicate title`). Em Next.js, `generateMetadata` por rota; confirme a API da versão em `stack:docs-atuais`.
- Imagens com `alt` descritivo; dimensões declaradas (também evita CLS).

## Dados estruturados (JSON-LD)

| Página | Tipo |
|---|---|
| Home | `Organization` (e `WebSite` com busca, se houver) |
| Produto | `Product` + `Offer` (preço, moeda, disponibilidade), `AggregateRating` só com avaliação real |
| Qualquer interna | `BreadcrumbList` |
| Artigo/blog | `Article` / `BlogPosting` |
| Perguntas e respostas reais na página | `FAQPage` |

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Tênis X",
  "image": ["https://loja.exemplo/img/tenis-x.jpg"],
  "sku": "TX-42",
  "offers": {
    "@type": "Offer",
    "price": "299.90",
    "priceCurrency": "BRL",
    "availability": "https://schema.org/InStock",
    "url": "https://loja.exemplo/tenis-x/p"
  }
}
```

- **O dado estruturado tem de bater com o que está visível na página** (preço, estoque, avaliação). Schema sem conteúdo correspondente é violação das diretrizes. Gere a partir dos mesmos dados que renderizam a tela.
- Valide com o Teste de Resultados Multimídia do Google e o relatório de melhorias do Search Console.

## Renderização

O que importa para indexar precisa estar no HTML entregue pelo servidor (SSR/SSG/ISR), não só depois de JavaScript: título, `h1`, texto, links, preço, JSON-LD. Em Next/FastStore, prefira SSG/ISR para produto e categoria; teste com `curl` na URL e veja se o conteúdo vem no HTML.

## Desempenho que conta

LCP < 2,5 s, INP < 200 ms, CLS < 0,1 (medir e atacar: `stack:desempenho`). Em e-commerce, o LCP costuma ser a imagem principal do produto: sem `loading="lazy"` nela, com prioridade/`preload`, tamanho certo, formato moderno.

## Anti-padrões

| Erro | Correção |
|---|---|
| Mesmo título em todos os produtos | Título gerado por produto/categoria |
| `noindex` de homologação na produção | Variável de ambiente que só liga em não-produção; conferir no deploy |
| Filtros indexáveis sem limite | Canonical/noindex nas combinações sem demanda |
| Sitemap com URL redirecionada ou 404 | Gerar só de canônicas com 200 |
| Schema de preço diferente do preço visível | Mesma fonte de dado nos dois |
| Cadeia de redirects | Apontar direto para o destino final |
| Conteúdo só após JS | SSR/SSG |
| Texto "melhorado" sem olhar a página | Ler a página real antes de recomendar |

Formato de achado: `[ALTO] Título duplicado nas páginas de produto — src/app/produto/[slug]/page.tsx — o título cai na string padrão — gerar a partir de nome + categoria.`

Fora do escopo desta skill: pesquisa de palavra-chave, estratégia de conteúdo e link building.

Fonte: adaptado de affaan-m/ECC (MIT) — `seo`, só a parte técnica.
