---
name: google-cloud
description: Google Cloud para apps Node/TS — service account dedicada e menor privilégio, ADC local e Workload Identity Federation no GitHub Actions (sem chave JSON), Secret Manager no Cloud Run (--set-secrets x --update-secrets, versão fixa), Artifact Registry, Cloud Run jobs e functions, quem pode invocar (allUsers x run.invoker, política da organização), Cloud Scheduler e Pub/Sub com OIDC, logs estruturados, Cloud SQL e custo (min-instances, orçamento que só avisa). Use ao configurar projeto, permissão, segredo, autenticação, gatilho agendado ou fila no GCP, ao investigar 403/permissão negada, log que não aparece ou conta alta. Para o deploy em si (revisão, tráfego, rollback) use a skill deploy.
---

# Google Cloud

Complementa a skill `deploy` (que cobre `gcloud run deploy`, tráfego por tag/revisão e rollback): aqui ficam **identidade, segredo, gatilhos, logs e custo**. Flags mudam; antes de fixar um comando, confira `gcloud <comando> --help` ou a doc em `docs.cloud.google.com`. Nada aqui roda sozinho: comando que cria, muda permissão ou gasta passa pelo ok do operador.

## Projeto e região

- `gcloud config set project ID` e uma região padrão; para loja no Brasil, `southamerica-east1` (São Paulo, faixa de preço Tier 2 no Cloud Run). Confira se o produto que você vai usar existe na região antes de escolher.
- Um projeto por ambiente (`-dev`, `-prod`) separa permissão, cota e conta.

## Identidade: quem o serviço é

- Sem `--service-account`, o Cloud Run roda como a conta padrão do Compute (`NÚMERO-compute@developer.gserviceaccount.com`). Dependendo da política da organização, ela pode ter **Editor** no projeto inteiro.
- Faça **uma service account por serviço**, com só os papéis de que ele precisa, e passe `--service-account` no deploy:

```bash
gcloud iam service-accounts create api-loja --display-name="API da loja"
gcloud projects add-iam-policy-binding PROJETO \
  --member="serviceAccount:api-loja@PROJETO.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

- Papel no **recurso** (um segredo, um bucket) é melhor que no projeto quando o comando permite.
- 403 / `PERMISSION_DENIED`: descubra **qual identidade** fez a chamada (a do serviço, a do Scheduler, a sua) antes de dar papel; não resolva com Editor/Owner.

## Autenticação sem chave

- **Local:** `gcloud auth application-default login` cria as *Application Default Credentials*; as bibliotecas `@google-cloud/*` as acham sozinhas. No Cloud Run, as mesmas bibliotecas usam a service account do serviço, sem código a mais.
- **Chave JSON de service account: evite.** Vaza em repositório, log e máquina antiga, e não expira.
- **GitHub Actions:** Workload Identity Federation com `google-github-actions/auth` (`workload_identity_provider` + `service_account`) e `permissions: id-token: write` no job. Sem segredo de longa duração no GitHub.

## Segredos (Secret Manager)

- A service account de runtime precisa de `roles/secretmanager.secretAccessor` (no segredo); sem ele, o deploy falha.
- Como variável: `--set-secrets=DATABASE_URL=db-url:3`. **`--set-secrets` substitui todos os segredos já configurados**; para acrescentar um sem apagar os outros, `--update-secrets`.
- Variável é lida **na subida da instância**: a doc recomenda **versão fixa** (`:3`) em vez de `:latest`, para saber o que está rodando e trocar com novo deploy. Como arquivo (volume), sempre a versão mais nova: `--update-secrets=/segredos/chave=nome-do-segredo:latest`.
- Segredo nunca em `--set-env-vars`, Dockerfile, `cloudbuild.yaml` ou log.

## Imagens

- **Artifact Registry**: `REGIAO-docker.pkg.dev/PROJETO/REPOSITORIO/IMAGEM:TAG`. O Container Registry (`gcr.io`) não aceita escrita desde 18/03/2025; endereços `gcr.io` antigos são servidos pelo Artifact Registry. Pipeline novo já nasce no `pkg.dev`.
- Tag com o SHA do commit, não só `latest` (rollback precisa saber qual imagem voltar).

## Quem pode chamar o serviço

- Público (vitrine, webhook): `--allow-unauthenticated`, que dá `roles/run.invoker` a `allUsers`. Organização com *Domain Restricted Sharing* (`iam.allowedPolicyMemberDomains`) **bloqueia `allUsers`**: o deploy passa mas o acesso público falha. Saída: `--no-invoker-iam-check`, se a política `run.managed.requireInvokerIam` permitir — decisão de segurança, confirme com o operador.
- Interno (job, backend chamado por outro serviço): sem acesso público, e `roles/run.invoker` só para a service account que chama.
- Serviço público ainda autentica o **usuário** na aplicação; IAM do Cloud Run não substitui login nem a conferência de assinatura do webhook.

## Tarefa agendada e fila

- **Cloud Run jobs** para trabalho que roda e termina (importação, conciliação): `gcloud run jobs deploy JOB --image …`. Serviço HTTP com timeout longo não é o lugar (padrão 300 s, máximo 3600 s por requisição).
- **Cloud Scheduler → Cloud Run**: alvo HTTP com token **OIDC** (`--oidc-service-account-email`, `--oidc-token-audience` = URL do serviço) de uma service account com `roles/run.invoker`.
- **Pub/Sub push → Cloud Run**: assinatura com `--push-auth-service-account` (com `run.invoker`). Entrega é *pelo menos uma vez*: o handler é idempotente e responde 2xx só depois de processar.
- **Cloud Run functions** é o nome atual do Cloud Functions 2ª geração; para código novo, serviço Cloud Run normal costuma bastar.

## Logs

- Uma linha de **JSON por evento em stdout** vira log estruturado: `severity` (`INFO`, `WARNING`, `ERROR`), `message` e, para ligar ao trace da requisição, `logging.googleapis.com/trace` = `projects/PROJETO/traces/TRACE_ID` (o ID vem do cabeçalho de trace da requisição; confira o nome na página de logging do Cloud Run).
- Texto solto em `console.log` vira `DEFAULT` sem campos: busca e alerta ficam ruins. Nada de dado pessoal, token ou corpo de pagamento no log.

## Cloud SQL a partir do Cloud Run

- `--add-cloudsql-instances=PROJETO:REGIAO:INSTANCIA` e `roles/cloudsql.client` na service account; em Node, o conector `@google-cloud/cloud-sql-connector`.
- Pool pequeno por instância (`max` × número de instâncias ≤ conexões do banco). `--max-instances` é também limite de conexão.

## Custo

- `--min-instances` > 0 **cobra com o serviço parado** (tira o cold start, mas custa 24 h/dia). Use só no que tem tráfego e pede latência.
- `--no-cpu-throttling` (CPU sempre alocada) muda o modelo de cobrança; só para quem processa fora da requisição.
- **Orçamento só avisa, não corta gasto**: `gcloud billing budgets create --billing-account=… --display-name=… --budget-amount=… --threshold-rule=percent=0.5` (e 0.9, 1.0). Crie no primeiro dia do projeto.
- Antes de subir `--max-instances`, `--concurrency` ou instância de banco, estime o custo e pergunte: é gasto.

Fonte: texto próprio, fatos conferidos em docs.cloud.google.com (Cloud Run, IAM, Secret Manager, Artifact Registry, Billing) em 13/11/2026.
