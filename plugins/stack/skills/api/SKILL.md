---
name: api
description: Padrões para rotas de API em Next.js (route handlers) e Node — nome de recurso, método e status HTTP, validação com Zod, envelope de erro, paginação, filtro, N+1, transação, cache, retry e rate limit. Use ao criar ou revisar um endpoint, route handler, server action que expõe dados, camada de serviço/repositório, ou quando uma lista está lenta, devolve 200 com erro, repete consulta por item ou deixa a escrita pela metade.
---

# API (Next.js / Node)

Consulta rápida para rota de API. O que é do banco está em `stack:postgres`; segurança em `stack:seguranca`.

## Recurso, método, status

- Recurso é substantivo, plural, minúsculo, `kebab-case`: `/api/pedidos`, `/api/pedidos/:id/itens`. Ação que não é CRUD vira sub-recurso verbo: `POST /api/pedidos/:id/cancelar`.
- Filtro, ordem e página vão na query: `?status=ativo&ordem=-criado_em&limite=20`.
- Não versione até precisar. Precisou: `/api/v2/…`, no máximo duas versões vivas. Campo novo e query opcional nova não quebram; remover, renomear ou trocar tipo, sim.

| Caso | Status |
|---|---|
| Leitura, atualização com corpo | 200 |
| Criou (mande `Location`) | 201 |
| Apagou, sem corpo | 204 |
| JSON malformado | 400 |
| Dado válido em JSON mas sem sentido (e-mail ruim, fora da faixa) | 422 |
| Sem login / token inválido | 401 |
| Logado mas sem permissão | 403 |
| Não existe | 404 |
| Duplicado, estado em conflito | 409 |
| Limite estourado (mande `Retry-After`) | 429 |
| Falha nossa (nunca devolva detalhe) | 500 |
| Upstream caiu / sobrecarga | 502 / 503 |

Erro frequente: `200` com `{ success: false }`. Use o status; o cliente e o cache dependem dele.

**Dono do recurso:** 404 em vez de 403 quando saber que o recurso existe já é vazamento (pedido de outro cliente).

## Envelope

Escolha um e mantenha em todas as rotas do projeto. Sugestão:

```typescript
// sucesso: { data, meta? }      erro: { error: { code, message, details? } }
type Erro = { error: { code: string; message: string; details?: { field: string; message: string }[] } };
```

`code` é estável e em inglês (`validation_error`, `not_found`); `message` pode ser PT-BR. Não devolva `error.message` de exceção, SQL nem stack.

## Route handler: validar, autorizar, responder

```typescript
import { z } from 'zod';
import { NextResponse } from 'next/server';

const Criar = z.object({ email: z.string().email(), nome: z.string().min(1).max(100) });

export async function POST(req: Request) {
  const usuario = await exigirUsuario(req);               // 401 se não houver
  const corpo = Criar.safeParse(await req.json().catch(() => null));
  if (!corpo.success) {
    return NextResponse.json(
      { error: { code: 'validation_error', message: 'Dados inválidos', details: corpo.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })) } },
      { status: 422 },
    );
  }
  try {
    const criado = await criarCliente(usuario, corpo.data);
    return NextResponse.json({ data: criado }, { status: 201, headers: { Location: `/api/clientes/${criado.id}` } });
  } catch (e) {
    console.error('criarCliente falhou', { usuarioId: usuario.id, e });   // detalhe só no log
    return NextResponse.json({ error: { code: 'internal_error', message: 'Erro interno' } }, { status: 500 });
  }
}
```

- Valide **todo** input na borda (body, query, params, headers); não confie em tipo TS para dado de fora.
- Centralize o `try/catch` num `tratarErro(e)` que mapeia `ZodError` → 422, erro de domínio → 4xx, o resto → 500 logado. Não repita em cada rota.
- Autorização por recurso (é dono? tem papel?) é na rota/serviço, nunca só no front.

## Paginação

| Caso | Tipo |
|---|---|
| Painel interno, tabela pequena, "ir para página N" | offset (`limite`/`pagina`) |
| Feed, lista grande, tabela que cresce | cursor (`cursor` opaco + `limite`) |

Offset fica lento em `OFFSET` grande e repete/pula item quando entra linha nova. Cursor: busque `limite + 1`, o excedente diz se há próxima; ordene por coluna estável e única (`id`, ou `(criado_em, id)`). Sempre ponha teto no `limite` (ex.: 100) e um padrão.

## Camadas

Rota (HTTP, validação) → serviço (regra) → repositório (acesso a dados). Vale quando a regra é reutilizada ou testada à parte; para CRUD simples, a rota chamando o cliente do banco já basta. Não crie interface de repositório "para trocar de banco depois".

## N+1

```typescript
// ruim: uma consulta por item
for (const p of pedidos) p.cliente = await buscarCliente(p.cliente_id);

// bom: uma consulta só, indexada em memória
const clientes = await buscarClientes(pedidos.map(p => p.cliente_id));
const porId = new Map(clientes.map(c => [c.id, c]));
const comCliente = pedidos.map(p => ({ ...p, cliente: porId.get(p.cliente_id) }));
```

No Supabase, prefira o select com relação (`.select('id, total, cliente:clientes(id, nome)')`). Selecione só as colunas usadas, não `*`. Sinal de N+1: o log mostra a mesma consulta N vezes por requisição.

## Transação

Duas escritas que precisam andar juntas não podem ser dois `await` soltos: a segunda falha e a primeira fica. No Supabase/PostgREST cada chamada é uma transação; para várias escritas, crie uma função SQL (`rpc`) que faz tudo e deixe o Postgres desfazer sozinho se uma falhar. Com `pg`/Prisma, use `BEGIN … COMMIT` / `$transaction`.

## Cache

- **HTTP:** `Cache-Control` em resposta pública e estável; dado por usuário é `private, no-store`.
- **Next:** `revalidate`/tags no `fetch` ou `unstable_cache` para leitura repetida; invalide por tag ao escrever. Confirme a API da versão do projeto em `stack:docs-atuais`, ela muda entre majors.
- **Redis/memória:** cache-aside (lê cache → miss lê banco → grava com TTL). Chave inclui o que muda o resultado (usuário, filtro, idioma). Defina como invalida **antes** de cachear; cache sem invalidação vira dado velho.

## Retry e rate limit

- Retry com backoff exponencial **só** em operação idempotente e erro transitório (rede, 502/503/429). Teto de tentativas e jitter. Nunca repita `POST` que cobra ou cria sem chave de idempotência.
- Rate limit em rota pública e em login/busca/envio de e-mail, por IP e por usuário; devolva `429` com `Retry-After`. Em serverless o contador em memória não vale: use Redis/Upstash ou o recurso da plataforma.

## Antes de entregar um endpoint

- [ ] URL, método e status coerentes com a tabela
- [ ] Input validado por schema; erro no envelope do projeto, sem vazar detalhe
- [ ] Autenticação e autorização por recurso testadas (401, 403, 404)
- [ ] Lista com paginação e teto de `limite`; sem N+1
- [ ] Escritas relacionadas numa transação
- [ ] Teste para o caminho feliz e para 401/403/422

Fonte: adaptado de affaan-m/ECC (MIT) — `api-design` e `backend-patterns`.
