---
name: migrations-seguras
description: Como escrever migration de Postgres e Supabase que não trava a tabela nem fica meio aplicada — lock_timeout, expandir e contrair, NOT NULL em passos, índice concorrente, backfill em lotes — e por onde aplicar e testar sem sujar o banco dos outros. Use ANTES de escrever ou revisar um arquivo em supabase/migrations (ou outra pasta de migration), ao adicionar coluna obrigatória, renomear ou remover coluna, trocar tipo, criar índice em tabela com dado, preencher coluna em massa, ou quando uma migration falhou com "contains null values", "cannot be executed within a pipeline" ou "canceling statement due to lock timeout".
---

# Migrations seguras

Uma migration que passa no banco vazio pode travar a produção por minutos, ou ficar meio aplicada. Os dois perigos:

- **Trava:** quase todo `ALTER TABLE` pede trava exclusiva. Enquanto espera por ela, enfileira atrás de si **todas** as leituras da tabela. Uma consulta longa já aberta vira a tabela inteira parada.
- **Meio aplicada:** o `supabase migration up` roda cada arquivo numa transação; se falha, o arquivo inteiro volta. O que fura essa transação (um `COMMIT` dentro do arquivo) deixa parte no banco, sem a versão em `schema_migrations`, e a reaplicação falha.

Regra de fundo: **o código que está no ar funciona antes e depois de cada migration.** Mudança que quebra o código atual se divide em passos, cada um num deploy — e cada passo num PR próprio para a `develop`, que só vai à produção no release.

Migration é sempre item de risco: a tarefa leva `Risco: sim` no plano e passa pelo `orquestracao:revisor` (`orquestracao:revisar`).

## Como aplicar

| Onde | Comando |
|---|---|
| Criar o arquivo | `supabase migration new <nome>` (nunca escreva o carimbo à mão) |
| Banco local | `supabase migration up --local`, só para migration que já está no tronco |
| Banco remoto | `supabase migration up --linked` ou `supabase db push` — produção é com o ok do operador |
| Conferir | `supabase migration list --local` |

- `psql -f arquivo.sql` aplica sem gravar em `schema_migrations`: o CLI acha depois que não rodou e tenta de novo.
- **O banco local costuma ser um só para todos os worktrees.** Aplicar ali a migration de um PR aberto deixa o banco de todos com uma tabela que o tronco não tem. Não aplique migration fora do tronco no local (nem por `execute_sql`), nem rode `db reset` (apaga o banco local inteiro).
- **Para testar a migration do PR,** use um Postgres descartável (outra porta, outra pasta de dados) e aplique cada arquivo com `psql -1 -v ON_ERROR_STOP=1 -d <url do descartável> < arquivo.sql` — o `-1` dá a mesma transação por arquivo do `migration up`. O arquivo do índice concorrente (padrão 6) vai sem `-1`. Encha a tabela com volume parecido com o real antes.

**Migration mergeada é imutável.** O remoto já a rodou; editar o arquivo não muda nada lá e faz o local divergir. Corrigir é migration nova. Reverter também: o CLI só anda para a frente.

## Os padrões

### 1. `lock_timeout` no topo

```sql
set lock_timeout = '5s';
alter table pedidos add column origem text;
```

- **Vale:** todo arquivo com `ALTER TABLE`, `DROP`, `CREATE TRIGGER` ou constraint em tabela lida em produção.
- **Não vale:** tabela criada no mesmo arquivo; o arquivo do índice concorrente.
- Sem ele, o `ALTER` espera a consulta longa e para a tabela enquanto espera. Com ele, falha com `canceling statement due to lock timeout` e a tabela segue viva. Falhou: rode de novo fora do pico.

### 2. Coluna obrigatória em passos

`add column x text not null` em tabela com linhas **falha na hora** com `contains null values`. Com `default` constante passa sem reescrever (Postgres 11+). Sem default possível:

```sql
-- arquivo 1 (deploy 1): coluna nula; o código novo já grava nela
alter table pedidos add column origem text;
-- backfill (padrão 5)
-- arquivo 2 (deploy 2): a regra, sem varrer
set lock_timeout = '5s';
alter table pedidos add constraint pedidos_origem_nn check (origem is not null) not valid;
-- arquivo 3: varre sem trancar as escritas
set lock_timeout = '5s';
alter table pedidos validate constraint pedidos_origem_nn;
alter table pedidos alter column origem set not null;  -- usa o CHECK validado
alter table pedidos drop constraint pedidos_origem_nn;
```

- **Sinal:** `not null` sem `default` num `add column`, ou `set not null` direto em tabela grande (varre tudo com trava exclusiva).
- `not valid` não varre, mas segura a trava exclusiva até o fim da transação; `validate` varre deixando ler e escrever. Por isso arquivos separados. O mesmo vale para `foreign key ... not valid`.

### 3. Expandir e contrair (renomear, trocar tipo, dividir)

Nunca `rename column` nem `alter column ... type` que reescreve numa coluna que o código no ar lê. Em passos, cada um num deploy: **expandir** (coluna nova) → código grava nas duas e lê a antiga → backfill → código lê a nova → **contrair** (remove a antiga, padrão 4).

- **Não vale:** coluna que nenhum código lê ainda; troca que não reescreve (aumentar `varchar(n)`, `varchar` → `text`).

### 4. Remover coluna só depois do código

- O deploy que tira o código vai antes; o `drop` vai num PR depois. No mesmo PR, o código antigo ainda no ar lê uma coluna que sumiu.
- **Sinal:** o PR do `drop` ainda tem código que cita a coluna — procure o nome no repositório, inclusive em `select *` tipado, view, função e política de RLS.
- **Não vale:** coluna criada num PR que ainda não foi para produção; aí basta tirar do próprio PR.

### 5. Backfill em lotes

`update pedidos set origem = 'web'` em milhões de linhas é uma transação só: trava tudo, incha o WAL e, se cair, perde tudo. Tabela pequena: um `update` dentro da migration está certo. Grande: **fora** da migration (script ou job), repetível, sem `commit` dentro de `do $$`:

```sql
with lote as (
  select id from pedidos where origem is null
  limit 5000 for update skip locked
)
update pedidos p set origem = 'web' from lote where p.id = lote.id;
-- repita até afetar 0 linhas
```

Transação curta; `skip locked` não briga com o app; `where origem is null` torna a repetição segura. O passo seguinte (o `validate`, a leitura da coluna nova) só entra depois que o backfill terminou.

### 6. Índice concorrente em arquivo próprio

```sql
-- arquivo só com isto
create index concurrently if not exists pedidos_cliente_idx on pedidos (cliente_id);
```

- **Sinal:** `create index` sem `concurrently` em tabela existente com tráfego — bloqueia toda escrita até terminar.
- `concurrently` não roda em transação: acompanhado no arquivo, falha com `cannot be executed within a pipeline`. Se falhar no meio, fica índice inválido (`\d pedidos` mostra `INVALID`): `drop index concurrently` e crie de novo.

## Antes de mergear

- Cada arquivo sozinho deixa o código no ar funcionando?
- `lock_timeout` onde mexe em tabela com tráfego? `concurrently` sozinho no arquivo? Nenhum `commit` dentro de `do`?
- O `drop` vem depois do deploy que tirou o código?
- Criado por `supabase migration new`, aplicado por `migration up`?
- Rodou num banco descartável com volume parecido com o real? Banco vazio não mostra trava nem `contains null values`.
- O corpo do PR diz a ordem de deploy.

## Erros comuns

| Erro | Conserto |
|---|---|
| `column "x" contains null values` | Padrão 2 |
| `cannot be executed within a pipeline` | O `concurrently` divide o arquivo: arquivo próprio |
| `canceling statement due to lock timeout` | A tabela estava ocupada. Rode fora do pico |
| Meio aplicada, não reaplica | `commit` dentro de `do`. Desfaça com migration nova; o lote vai para fora |
| `migration list` diz que não rodou, mas a tabela existe | Foi por `psql -f`. `supabase migration repair --status applied <versão>` |
| Editou migration mergeada | Volte o arquivo; a correção é migration nova |
