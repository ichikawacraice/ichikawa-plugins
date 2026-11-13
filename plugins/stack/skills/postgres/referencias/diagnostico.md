# Diagnóstico de Postgres

Consultas de leitura. Rode no banco certo (local ou descartável; em produção, só com o ok do operador).

## FK sem índice

```sql
select c.conrelid::regclass as tabela, a.attname as coluna
from pg_constraint c
join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
where c.contype = 'f'
  and not exists (
    select 1 from pg_index i
    where i.indrelid = c.conrelid and a.attnum = any(i.indkey)
  );
```

## Consultas mais lentas

Precisa da extensão `pg_stat_statements` (no Supabase já vem disponível).

```sql
select query, calls, mean_exec_time, total_exec_time
from pg_stat_statements
order by total_exec_time desc
limit 20;
```
Ordene por `total_exec_time` para achar o que mais pesa no conjunto; por `mean_exec_time`, o que é lento cada vez.

## Linhas mortas (vacuum atrasado)

```sql
select relname, n_dead_tup, last_autovacuum
from pg_stat_user_tables
where n_dead_tup > 1000
order by n_dead_tup desc;
```

## Índices que ninguém usa

```sql
select relname as tabela, indexrelname as indice, idx_scan
from pg_stat_user_indexes
where idx_scan = 0
order by pg_relation_size(indexrelid) desc;
```
`idx_scan = 0` desde o último reset das estatísticas. Não apague índice de constraint (`unique`, PK) nem sem olhar um período longo.

## Timeouts da role da aplicação

```sql
alter role app_role set statement_timeout = '30s';
alter role app_role set idle_in_transaction_session_timeout = '30s';
```
(Troque `app_role` pela role que a aplicação usa. Vale para conexões novas.)

Fonte: adaptado de affaan-m/ECC (MIT) — `postgres-patterns`.
