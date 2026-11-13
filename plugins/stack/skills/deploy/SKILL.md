---
name: deploy
description: Pipeline e entrega — GitHub Actions (lint, typecheck, teste, build), health check, rollback, Dockerfile multi-stage para Node, docker compose de dev com Postgres, variáveis de ambiente validadas na subida, Cloud Run no Google Cloud (revisão, tráfego, secrets) e checklist de produção. Use ao montar ou mexer em workflow de CI/CD, containerizar um app Node/Next, subir banco local, planejar rollback ou conferir se algo está pronto para ir à produção.
---

# Deploy

O fluxo de branches e o release (`develop` → `main`) são de `orquestracao:release`. Aqui: como o app é empacotado, verificado e desfeito.

## Estratégia

| Estratégia | Quando | Preço |
|---|---|---|
| Rolling (padrão) | mudança retrocompatível | duas versões convivem durante a troca |
| Blue-green | serviço crítico, volta instantânea | infra dobrada durante a troca |
| Canário (% do tráfego) | mudança arriscada, tráfego alto | precisa dividir tráfego e olhar métrica |

Em qualquer uma, **duas versões do código convivem**: migration e contrato de API têm de funcionar para a antiga e a nova (`orquestracao:migrations-seguras`).

## GitHub Actions (CI)

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [develop, main]

jobs:
  checar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- Versões de `actions/*` mudam: confira a atual na documentação (`stack:docs-atuais`) ou no repositório da action antes de copiar.
- `npm ci` (usa o lockfile), nunca `npm install`, no CI. Cache do gerenciador de pacotes pelo `setup-node`.
- Segredo só em `secrets.*` / `environment`; nunca em `run:` nem em log. Job de deploy usa `environment: production` para ter aprovação e segredos próprios.
- `concurrency` com `cancel-in-progress` evita pipelines empilhados no mesmo branch.

## Dockerfile multi-stage (Node)

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S app && adduser -S app -u 1001 -G app
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/package.json ./
USER app
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

- Tag de imagem fixa (`node:22-alpine`, não `latest`); usuário não-root; dependência primeiro (cache de camada); só dependência de produção na imagem final.
- Next.js: com `output: 'standalone'` a imagem final copia `.next/standalone`, `.next/static` e `public`; veja o exemplo da versão do projeto em `stack:docs-atuais`.
- `.dockerignore`: `node_modules`, `.git`, `.env*`, `dist`, `.next`, `coverage`, `*.log`. Sem ele, o `.env` entra na imagem.
- Segredo nunca em `ENV`/`ARG`/camada da imagem: injete em tempo de execução.

## Compose de dev com Postgres

```yaml
services:
  db:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres     # só para dev local
      POSTGRES_DB: app_dev
    volumes: [pgdata:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 3s
      retries: 5
volumes:
  pgdata:
```

- Projeto com Supabase: prefira `supabase start` (traz Auth, Storage e a mesma versão do Postgres) em vez de montar à mão.
- Rodar o app em container na dev é opcional; muitas vezes basta o banco no compose e `npm run dev` no host (mais rápido, HMR nativo).
- `depends_on` com `condition: service_healthy` para o app esperar o banco. Compose de dev não vai para produção.

## Health check

```typescript
// GET /health — barato, sem tocar em dependência: serve para "o processo está vivo"
export const GET = () => Response.json({ status: 'ok' });
```

Se quiser um `/ready` que testa o banco (`select 1`), devolva `503` quando falhar e **não** o use como probe de liveness: banco fora não é motivo para reiniciar o app. Sem PII na resposta.

## Variáveis de ambiente

Valide na subida e falhe cedo:

```typescript
import { z } from 'zod';
export const env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().default(8080),
}).parse(process.env);
```
No Next, só `NEXT_PUBLIC_*` vai para o navegador, e é embutida **no build**: trocar o valor exige novo build. Nada secreto com esse prefixo.

## Cloud Run (Google Cloud)

Comandos conferidos no `gcloud` local (`gcloud run … --help`); região e projeto por `--region` / `gcloud config`.

```bash
# deploy a partir do código (Cloud Build monta a imagem) ou de uma imagem do Artifact Registry
gcloud run deploy meu-servico --source . --region southamerica-east1
gcloud run deploy meu-servico --image REGIAO-docker.pkg.dev/PROJETO/REPO/IMG:TAG --region REGIAO

# revisão nova sem tráfego, com URL de teste por tag; depois liga
gcloud run deploy meu-servico --image … --no-traffic --tag candidata
gcloud run services update-traffic meu-servico --to-tags=candidata=100        # ou --to-revisions=REV=10,REV_ANTIGA=90 para canário

# rollback: mande o tráfego de volta para uma revisão anterior
gcloud run revisions list --service meu-servico
gcloud run services update-traffic meu-servico --to-revisions=REVISAO_BOA=100

# segredo do Secret Manager como variável
gcloud run deploy meu-servico --set-secrets=DATABASE_URL=nome-do-segredo:latest
```

- O contêiner **escuta a porta da variável `PORT`** (o padrão do Cloud Run é 8080); não fixe outra.
- Cada deploy cria uma revisão imutável: rollback é redirecionar tráfego, não rebuild. Por isso guarde as revisões antigas.
- `--min-instances` acima de 0 evita partida a frio, ao custo de pagar instância parada; decida com a latência medida.
- Deploy em produção, mudança de tráfego e segredo novo são do operador (`orquestracao:release`): o agente prepara o comando e espera o ok.

## Rollback

- [ ] A versão anterior continua disponível (revisão do Cloud Run, imagem com tag do commit)
- [ ] A migration que foi junto é retrocompatível: o código antigo roda com o banco novo
- [ ] Feature flag consegue desligar a novidade sem deploy
- [ ] Alerta de taxa de erro configurado
- [ ] O rollback foi ensaiado fora da produção

## Antes de ir à produção

- Testes e build verdes no CI; sem segredo no código nem na imagem
- Variáveis documentadas e validadas na subida; `/health` responde
- Log estruturado (JSON), sem PII; erro vai para onde alguém vê
- Limites de CPU/memória e de instâncias definidos; HTTPS em tudo; CORS só para as origens necessárias
- Migration testada com volume parecido com o real; plano de rollback escrito

Fonte: adaptado de affaan-m/ECC (MIT) — `deployment-patterns` e `docker-patterns`.
