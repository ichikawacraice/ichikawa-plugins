# stack

Conhecimento da stack da empresa em um plugin só: React/TypeScript, Next.js, Node, Supabase/Postgres e Google Cloud. Skills de consulta, agentes revisores e o Context7 para ler a documentação atual em vez da memória. Sem gate e sem cobertura mínima: é material de consulta.

## O que traz

### Skills

| Skill | Para quê |
|---|---|
| `stack:google-cloud` | Google Cloud: service account, ADC/WIF, Secret Manager, gatilhos, logs, Cloud SQL, custo |
| `stack:react` | Hooks, componentes, Server/Client Components, render |
| `stack:typescript` | Tipos, async, erros, validação na borda |
| `stack:nextjs` | App Router, dados, cache, metadata, rotas |
| `stack:vite` | Configuração, build, plugins e armadilhas do Vite |
| `stack:animacao` | Movimento na interface sem custo de desempenho |
| `stack:tailwind` | Tailwind e sistema de design |
| `stack:api` | Rotas Next/Node: status, envelope de erro, paginação, N+1, transação, cache |
| `stack:postgres` | Índices, RLS, tipos, consultas, diagnóstico (migration é de `orquestracao:migrations-seguras`; Supabase é do plugin `supabase@claude-plugins-official`) |
| `stack:deploy` | GitHub Actions, Dockerfile Node, compose com Postgres, health check, Cloud Run, rollback |
| `stack:seguranca` | Checklist ao escrever código: segredos, entrada, authn/authz, RLS, pagamento, OWASP 2025 |
| `stack:desempenho` | Medir antes de otimizar; metas de Web Vitals, latência e bundle |
| `stack:seo-tecnico` | Indexação, canonical, sitemap, JSON-LD de produto, metadata |
| `stack:codigo-morto` | Achar e apagar o que não é usado, em passos com teste |
| `stack:docs-atuais` | Consultar a doc atual pelo Context7; fallback para a web |

### Agentes

| Agente | Papel |
|---|---|
| `stack:google-cloud` | Google Cloud: service account, ADC/WIF, Secret Manager, gatilhos, logs, Cloud SQL, custo |
| `stack:revisor-react-ts` | Revisa React e TypeScript no diff |
| `stack:revisor-banco` | Revisa SQL, schema, índice, RLS e migration |
| `stack:seguranca` | Caça vulnerabilidade no diff ou no projeto |
| `stack:desempenho` | Acha gargalo em código lento, com medida |
| `stack:seo` | Audita SEO técnico de uma página ou do site |
| `stack:docs` | Responde dúvida de biblioteca com a doc atual (Context7) |

### MCP

`.mcp.json` registra o servidor `context7` (`npx -y @upstash/context7-mcp`). Na primeira vez o Claude Code pede aprovação do servidor. A chave de API do Context7 é opcional (só dá limite de uso maior); não a coloque no `.mcp.json`.

## O que precisa

- Node 20.18.1 ou mais novo e `npx` (o pacote `@upstash/context7-mcp` exige `node >= 20.18.1`) e acesso à internet para o Context7.
- Para `stack:deploy` nos exemplos de Google Cloud: `gcloud` instalado e autenticado. Nada roda sozinho; os comandos são para você ou a sessão executarem com o ok do operador.
- Os plugins `orquestracao@ichikawa-plugins` e `supabase@claude-plugins-official` completam o que as skills apontam, mas não são exigidos.

## Fontes e licenças

Adaptações em PT-BR, reescritas e cortadas para esta stack. Cada arquivo diz de onde veio na última linha.

| Origem | Licença | Onde |
|---|---|---|
| `stack:google-cloud` | Google Cloud: service account, ADC/WIF, Secret Manager, gatilhos, logs, Cloud SQL, custo |
| [ECC](https://github.com/affaan-m/ECC) (affaan-m) | MIT | base de quase todas as skills e agentes |
| [claude-code-owasp](https://github.com/agamm/claude-code-owasp) (agamm) | MIT | `stack:seguranca` — licença em [`licencas/LICENSE-agamm`](licencas/LICENSE-agamm) |
| Vercel Labs `react-best-practices` (via ECC `react-performance`) | MIT | `stack:desempenho` e, nas regras de React, `stack:react` |
| Supabase Agent Skills (via ECC `postgres-patterns`) | MIT | `stack:postgres` |
| [Context7](https://github.com/upstash/context7) (Upstash) | MIT | servidor MCP usado pelo `.mcp.json`; não é redistribuído aqui |

O restante é MIT, como o resto do marketplace (ver [`docs/terceiros.md`](../../docs/terceiros.md)).
