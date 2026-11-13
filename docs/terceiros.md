# Código e texto de terceiros

As skills de processo do plugin `orquestracao` são adaptações em PT-BR de projetos abertos sob a licença MIT, mais o kit antigo do próprio operador. A adaptação reescreve, corta e muda o fluxo (tronco `develop`, PR por squash, revisão só em item de risco, testes afetados durante o trabalho); a origem de cada uma fica registrada aqui, como pede a licença MIT.

## Origens

| Projeto | Licença | Autor |
|---|---|---|
| [Superpowers](https://github.com/obra/superpowers) 7.0.2 | MIT | © 2025 Jesse Vincent |
| [ECC](https://github.com/affaan-m/ECC) | MIT | © affaan-m |
| [ponytail](https://github.com/DietrichGebert/ponytail) | MIT | © Dietrich Gebert |
| [ruflo](https://github.com/ruvnet/ruflo) (commit 264b34647) | MIT | © 2024-2026 ruvnet |
| `kit-de-orquestracao` | próprio | o operador |

## Skills de `plugins/orquestracao/skills/`

| Skill | Vem de |
|---|---|
| `brainstorming` | Superpowers — `brainstorming` |
| `planejar` | Superpowers — `writing-plans` |
| `executar-plano` (e `executor-prompt.md`) | Superpowers — `executing-plans` + `subagent-driven-development` (e `implementer-prompt.md`) |
| `depurar` | Superpowers — `systematic-debugging` (com `root-cause-tracing`, `defense-in-depth` e `condition-based-waiting` resumidos) |
| `tdd` | Superpowers — `test-driven-development` (com `writing-good-tests` resumido) |
| `verificar-antes-de-concluir` | Superpowers — `verification-before-completion` |
| `receber-revisao` | Superpowers — `receiving-code-review` |
| `revisar` | Superpowers — `requesting-code-review` (e `code-reviewer.md`); roteiro de autorrevisão a partir das regras comuns do ECC (`code-review`, `security`) |
| `paralelizar-agentes` | Superpowers — `dispatching-parallel-agents` |
| `adr` | ECC — `architecture-decision-records` |
| `entregar-branch` | Superpowers — `finishing-a-development-branch` (e a limpeza de worktree de `using-git-worktrees`) |
| `migrations-seguras` | kit-de-orquestracao — `processos/migrations-seguras` |
| `testes-de-tela` | kit-de-orquestracao — `processos/testes-de-tela` |
| `auditoria-de-clique` | kit-de-orquestracao — `processos/auditoria-de-clique` |
| `spec` | kit-de-orquestracao — `processos/spec-driven` |

## Agentes e hooks de `plugins/orquestracao/`

| Arquivo | Vem de |
|---|---|
| `agents/revisor.md` | kit-de-orquestracao — `validador`; roteiro "além do diff" do ponytail; níveis Crítico/Importante/Menor do Superpowers (`code-reviewer.md`); listas de segurança e banco do ECC (`security-reviewer`, `database-reviewer`) |
| `agents/executor.md`, `agents/explorador.md` | kit-de-orquestracao |
| `agents/conserta-build.md` | ECC — `build-error-resolver` |
| `hooks/config-protegida.mjs` | ECC — `scripts/hooks/config-protection.js` (aqui pergunta em vez de bloquear) |
| `hooks/varredura-entre-sessoes.mjs` | ruflo — `ruflo-loop-workers/hooks/screen.ts`, via kit-de-orquestracao |

## Texto da licença MIT

Vale para o material derivado do Superpowers, do ECC, do ponytail e do ruflo:

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Absorvido do ECC e de outros na remoção do ECC (13/11/2026)

| Onde | Vem de | Licença |
|---|---|---|
| `plugins/orquestracao/hooks/{sem-no-verify,segredo-em-arquivo,aviso-console-log,formatar-editado}.mjs` | ideias dos hooks do ECC (`block-no-verify`, `governance-capture`, `check-console-log`, `stop-format-typecheck`), reescritas | MIT, affaan-m/ECC |
| trechos em `revisor`, `conserta-build`, `spec`, `release`, `testes-de-tela`, `planejar`, `entregar-branch`, `regras.md` e `design-wicomm/critica-de-ui` | ECC: `silent-failure-hunter`, `react-build-resolver`, `spec-miner`, `contract-first`, `canary-watch`, `e2e-runner`, `code-architect`, `commit-reviewer`, `rules/`, `make-interfaces-feel-better` | MIT, affaan-m/ECC |
| `plugins/orquestracao/skills/{conhecer-projeto,revisar-chamado}` | ECC: `codebase-onboarding`, `issue-review` | MIT, affaan-m/ECC |
| `plugins/orquestracao/skills/entrevistar` | [mattpocock/skills](https://github.com/mattpocock/skills) — `grilling` | MIT © 2026 Matt Pocock (`plugins/orquestracao/licencas/`) |
| `plugins/stack/agents/*` | ECC: `react-reviewer`, `typescript-reviewer`, `database-reviewer`, `security-reviewer`, `performance-optimizer`, `seo-specialist`, `docs-lookup` | MIT, affaan-m/ECC |
| `plugins/stack/skills/*` | ECC: skills de React, TS, Next, Vite, motion, API, backend, Postgres, deploy, docker, segurança, benchmark, SEO, refactor-clean, documentation-lookup | MIT, affaan-m/ECC |
| `plugins/stack/skills/react` (composição) | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) — `composition-patterns` | MIT (declarada no frontmatter da skill de origem) © Vercel |
| `plugins/stack/skills/tailwind` | [wshobson/agents](https://github.com/wshobson/agents) — `tailwind-design-system` | MIT © 2024 Seth Hobson (`plugins/stack/licencas/`) |
| `plugins/orquestracao/skills/dona` (seção "Escrita enxuta") e a linha correspondente em `plugins/orquestracao/regras.md` | [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) — regras do `skills/caveman/SKILL.md` (resposta primeiro, sem cerimônia, negação e conteúdo técnico literais, exceções em texto completo), reescritas em PT-BR sem trecho traduzido; o modo "homem das cavernas" (cortar artigos, fragmentos) não foi trazido. "Caveman" é marca de Julius Brussee e não é usada no nome de nada aqui | Apache-2.0 © Julius Brussee — só a ideia, sem texto copiado, por isso sem NOTICE |
| `plugins/stack/skills/seguranca` | [agamm/claude-code-owasp](https://github.com/agamm/claude-code-owasp) | MIT (`plugins/stack/licencas/LICENSE-agamm`) |
