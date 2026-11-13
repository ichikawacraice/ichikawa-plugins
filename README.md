# ichikawa-plugins

Marketplace de plugins do Claude Code. Os plugins não se importam entre si: se encontram só pelos arquivos e comandos de [`docs/contratos.md`](docs/contratos.md).

| Plugin | O que faz | Onde ligar |
|---|---|---|
| `orquestracao` | Orquestradora e donas, página de perguntas e entregas, skills de processo, agentes `executor` / `explorador` / `revisor` / `conserta-build`, release `develop` → `main` | todo projeto |
| `barra` | Mod acima do prompt: cache, ausente e os botões dos plugins ligados | conta |
| `design-wicomm` | Design system e tema Wicomm | só projetos internos |
| `contas` | Painel de contas (repositório `claude-account-switcher`) | conta |

## Instalar

```bash
claude plugin marketplace add ichikawacraice/ichikawa-plugins
claude plugin install orquestracao@ichikawa-plugins
claude plugin install barra@ichikawa-plugins
claude plugin install contas@ichikawa-plugins
```

O `design-wicomm` vai no `.claude/settings.json` do projeto interno (`"enabledPlugins": { "design-wicomm@ichikawa-plugins": true }`).

## Desenvolver

- `develop` é o tronco; PR por squash. `main` é o que as contas instalam.
- Sem `version` no `plugin.json`: a versão é o commit.
- Testes: `node --test 'plugins/orquestracao/tests/*.test.mjs'`, `node --test plugins/design-wicomm` e `claude plugin test plugins/barra`.
- Validar: `claude plugin validate plugins/<nome>`.

Licença MIT ([LICENSE](LICENSE)); material de terceiros em [`docs/terceiros.md`](docs/terceiros.md) e em `plugins/design-wicomm/TERCEIROS.md`. A marca Wicomm não é licenciada.
