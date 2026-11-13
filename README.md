# ichikawa-plugins

Marketplace de plugins do Claude Code. Os plugins não se importam entre si: se encontram só pelos arquivos e comandos de [`docs/contratos.md`](docs/contratos.md).

| Plugin | O que faz | Onde ligar |
|---|---|---|
| `orquestracao` | Orquestradora e donas, página de perguntas e entregas, skills de processo, agentes `executor` / `explorador` / `revisor` / `conserta-build`, release `develop` → `main` | todo projeto |
| `stack` | Padrões e revisores da stack: React 19, TypeScript, Next, Vite, Tailwind v4, animação, API, Postgres, deploy, segurança, desempenho, SEO; agentes `revisor-react-ts`, `revisor-banco`, `seguranca`, `desempenho`, `seo`, `docs` (com a MCP Context7) | conta |
| `barra` | Mod acima do prompt: cache, ausente e os botões dos plugins ligados | conta |
| `design-wicomm` | Design system e tema Wicomm | só projetos internos |
| `contas` | Painel de contas e troca de conta no Mac (`src/troca` é port Apache-2.0 do Claude Account Switcher) | conta |

## Instalar

```bash
claude plugin marketplace add ichikawacraice/ichikawa-plugins
claude plugin install orquestracao@ichikawa-plugins
claude plugin install stack@ichikawa-plugins
claude plugin install barra@ichikawa-plugins
claude plugin install contas@ichikawa-plugins
```

O `design-wicomm` vai no `.claude/settings.json` do projeto interno (`"enabledPlugins": { "design-wicomm@ichikawa-plugins": true }`).

## Plugins de fora recomendados

Não são copiados para cá: instale do marketplace de origem.

```bash
# claude-plugins-official (já vem configurado)
claude plugin install supabase@claude-plugins-official
claude plugin install frontend-design@claude-plugins-official
claude plugin install skill-creator@claude-plugins-official
claude plugin install claude-security@claude-plugins-official
claude plugin install hookify@claude-plugins-official

# Auditoria de segurança (Trail of Bits, CC BY-SA 4.0: por isso ficam de fora do kit e entram como dependência)
claude plugin marketplace add trailofbits/skills
for p in audit-context-building differential-review fp-check sharp-edges static-analysis supply-chain-risk-auditor variant-analysis; do
  claude plugin install "$p@trailofbits"
done
```

## Desenvolver

- `develop` é o tronco; PR por squash. `main` é o que as contas instalam.
- Sem `version` no `plugin.json`: a versão é o commit.
- Testes: `node --test 'plugins/orquestracao/tests/*.test.mjs'`, `node --test plugins/design-wicomm` `claude plugin test plugins/barra` e `npm test` em `plugins/contas`.
- Validar: `claude plugin validate plugins/<nome>`.

Licença MIT ([LICENSE](LICENSE)); material de terceiros em [`docs/terceiros.md`](docs/terceiros.md) em `plugins/design-wicomm/TERCEIROS.md` e em `plugins/contas/NOTICE` (Apache-2.0). A marca Wicomm não é licenciada.
