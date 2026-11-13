# F2 · Skills de VTEX FastStore, Wake e Google Cloud no plugin `stack`

**Pronto quando:** três skills novas em `plugins/stack/skills/` (`faststore`, `wake`, `google-cloud`), cada uma com `SKILL.md` enxuto no padrão das vizinhas (frontmatter `name` + `description` com gatilho "Use ao…", corpo em PT-BR, até ~120 linhas), conteúdo conferido na doc atual (agente `stack:docs` / Context7 / site oficial); `claude plugin validate plugins/stack` verde; PR para `develop` mergeado.

**Fora:** release para a `main`, mudar outras skills, bump de versão.

## Decisões

- Escritas do zero, com a doc oficial como fonte de fato (não de texto). A última linha de cada skill diz "Fonte: texto próprio, conferido em <docs> em 13/11/2026". Nada entra em `docs/terceiros.md` porque não há material derivado.
- `google-cloud` não repete o que `stack:deploy` já cobre (deploy no Cloud Run, tráfego, rollback): aponta para ela e foca em projeto/IAM, autenticação (ADC, Workload Identity Federation), Secret Manager, gatilhos (Scheduler, Pub/Sub, Tasks), logs, Cloud SQL e custo.
- Fato que a doc não confirmou entra como "confira" ou fica de fora; nada da memória sem ressalva.
- README do `stack` ganha três linhas na tabela de skills (não é outra skill; *assumida, a confirmar*).

## Tarefas

| # | Tarefa | Risco |
|---|---|---|
| 1 | Conferir fatos na doc atual (três agentes `stack:docs` em paralelo) | não |
| 2 | Escrever `faststore/SKILL.md` | não |
| 3 | Escrever `wake/SKILL.md` | não |
| 4 | Escrever `google-cloud/SKILL.md` | não |
| 5 | Tabela do README do `stack` | não |
| 6 | `claude plugin validate plugins/stack` e autorrevisão | não |
| 7 | PR para `develop`, merge por squash | não |

Nenhuma tarefa de risco (só texto de consulta): autorrevisão, sem agente revisor.
