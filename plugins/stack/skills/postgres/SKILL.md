---
name: postgres
description: Consulta rápida de Postgres e Supabase — qual índice para cada consulta, ordem de coluna em índice composto, índice parcial e de cobertura, RLS rápida e segura, tipos corretos (timestamptz, numeric, text, bigint), UPSERT, paginação por cursor, fila com SKIP LOCKED, achar FK sem índice e consulta lenta. Use ao escrever SQL, desenhar tabela, criar índice ou política de RLS, ou quando uma consulta está lenta.
---

# Postgres (e Supabase)

- **Migration** (adicionar/remover coluna, índice em tabela com dado, backfill): `orquestracao:migrations-seguras`. Esta skill é para desenhar e consultar.
- **Supabase** (Auth, Storage, Edge Functions, `@supabase/ssr`, CLI, MCP, advisors): o plugin oficial `supabase@claude-plugins-official` e a skill `supabase` dele. Aqui só o que é Postgres puro.
- Para revisão de uma mudança de banco, o agente `stack:revisor-banco`.

## Qual índice

| A consulta faz | Índice |
|---|---|
| `col = x`, `col > x` | B-tree (o padrão) |
| `a = x AND b > y` | composto `(a, b)`: igualdade primeiro, faixa depois |
| `jsonb @> '{…}'`, array `@>` | GIN |
| busca de texto `tsv @@ query` | GIN em `tsvector` |
| faixa de tempo em tabela enorme e ordenada por inserção | BRIN |
| só linhas "vivas" (`deleted_at is null`) | parcial |
| consulta que só lê 2–3 colunas | cobertura (`INCLUDE`) |

```sql
create index on pedidos (status, criado_em);                       -- WHERE status = 'pago' AND criado_em > …
create index on usuarios (email) where deleted_at is null;         -- parcial: menor e mais rápido
create index on usuarios (email) include (nome, criado_em);        -- cobertura: sem voltar à tabela
```

- **Toda FK precisa de índice** na coluna filha (o Postgres não cria). Sem ele, `DELETE` no pai e `JOIN` varrem a tabela. Consulta para achar as que faltam: `referencias/diagnostico.md`.
- Índice a mais custa escrita. Não crie "por garantia": crie quando `EXPLAIN` mostrar `Seq Scan` numa tabela que importa.
- Em tabela com tráfego, `create index concurrently` e em arquivo próprio (ver `orquestracao:migrations-seguras`).

## Medir antes de mexer

```sql
explain (analyze, buffers) select … ;
```
Procure `Seq Scan` em tabela grande, `rows` estimado muito diferente do real (rode `analyze tabela`), `Sort` em disco. Consulta lenta de verdade em produção: `pg_stat_statements` (`referencias/diagnostico.md`). Uma mudança por vez e meça de novo (`stack:desempenho`).

## Tipos

| Para | Use | Evite |
|---|---|---|
| ID | `bigint generated always as identity`, ou `uuid` (v7 se puder: ordena por tempo) | `int`; `uuid` v4 aleatório como chave de tabela enorme (fragmenta o índice) |
| Texto | `text` (+ `check` se precisa limitar) | `varchar(255)` por hábito |
| Data/hora | `timestamptz` | `timestamp` (perde o fuso) |
| Dinheiro | `numeric(12,2)` ou inteiro em centavos | `float`, `real` |
| Flag | `boolean` | `int`, `varchar` |
| Estado fechado | `text` + `check`, ou enum se for realmente fixo | número mágico |

## RLS (Supabase)

```sql
alter table pedidos enable row level security;

create policy "dono lê" on pedidos for select
  using ((select auth.uid()) = usuario_id);        -- (select …) faz o Postgres avaliar uma vez, não por linha
create policy "dono altera" on pedidos for update
  using ((select auth.uid()) = usuario_id)
  with check ((select auth.uid()) = usuario_id);
```

- **Toda tabela exposta pela API tem RLS ligada.** RLS ligada sem política = ninguém lê (seguro); tabela sem RLS no schema exposto = qualquer um com a chave `anon` lê.
- Embrulhe `auth.uid()` em `(select …)`; indexe a coluna que a política usa (`usuario_id`).
- Política por papel via `auth.jwt()` claims, nunca por dado que o usuário edita (`user_metadata`).
- `service_role` ignora RLS: só no servidor, nunca no navegador. Função `security definer` roda com o dono dela: fixe `set search_path = ''` e valide quem chama.
- Teste a política com dois usuários: o dono vê, o outro não.

## Receitas

```sql
-- UPSERT
insert into configuracoes (usuario_id, chave, valor) values ($1, $2, $3)
on conflict (usuario_id, chave) do update set valor = excluded.valor;

-- Paginação por cursor (O(1); OFFSET é O(n))
select * from produtos where id > $ultimo_id order by id limit 20;

-- Fila: cada worker pega um item diferente, sem esperar
update jobs set status = 'processando'
where id = (select id from jobs where status = 'pendente' order by criado_em limit 1 for update skip locked)
returning *;
```

## Operação

- `statement_timeout` e `idle_in_transaction_session_timeout` curtos para a role da aplicação (transação esquecida aberta segura vacuum e trava).
- Em serverless (Vercel, Cloud Run, Functions), conecte pelo pooler (porta transacional do Supabase/pgbouncer), não direto: cada instância abre conexão e o limite acaba.
- Não dê `ALTER SYSTEM` em banco gerenciado; use as configurações do provedor.
- Dado que você vai ler junto, em linhas que mudam juntas, fica na mesma tabela; não normalize além do que a consulta pede, nem desnormalize antes de medir.

Fonte: adaptado de affaan-m/ECC (MIT) — `postgres-patterns`, que por sua vez cita as Supabase Agent Skills (Supabase, MIT).
