# Deploy

> Modelo do `/design-wicomm:novo`. Troque `<app>`, `<pasta>` e `<time>` e o que o projeto tiver além do front; apague o que não se aplica.

## O deploy de produção é o da Vercel

O projeto `<app>` na Vercel está ligado a este repositório, com a raiz em `<pasta>`: cada push na `main` monta e publica a produção, e cada PR ganha uma prévia. O `install` baixa `@wicomm/tokens` e `@wicomm/guardas` do npm público, sem token.

- `vercel.json` e as variáveis de ambiente da Vercel **não** levam `NPM_RC`, `NPM_TOKEN` nem `NODE_AUTH_TOKEN`: nenhum pacote do projeto pede token.
- Terminar o merge publica; confira que subiu antes de dar o release por feito.

## Como conferir que subiu

```bash
vercel list <app> --scope <time>
```

O deploy mais recente deve aparecer como `● Ready` / `Production`. `UNKNOWN` com duração `?` é deployment **bloqueado** antes de buildar (conta ou projeto), não erro de código.

## Rollback

Promover o deploy anterior no painel da Vercel (ou `vercel promote <url-do-deploy-anterior> --scope <time>`).
