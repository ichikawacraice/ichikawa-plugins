---
name: trocar-conta
description: Mostra as contas do app do Claude guardadas no painel de contas e abre o painel para trocar de conta ou ler a cota. Use quando o operador pedir para trocar de conta, ver qual conta tem cota, ou abrir o painel de contas ("troca de conta", "qual conta ainda tem cota", "abre o painel de contas"). Nunca troca de dentro da sessão — a troca fecha o app.
---

# Trocar de conta

**A troca fecha o app do Claude, e esta sessão roda dentro dele.** Por isso a troca nunca sai daqui: quem troca é o operador, no painel ou num terminal.

1. **Listar as contas** (só lê, não fecha nada):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/src/troca/cli.mjs" --json
   ```
   Mostre nome e qual está ativa; nunca imprima token.
2. **Abrir o painel** (cota de cada conta e o botão de troca):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/src/painel/abrir.mjs"
   ```
   Sobe o painel em `127.0.0.1:4791` se não estiver no ar e abre o navegador. É o mesmo que o botão **Contas** da barra.
3. **Para trocar**, diga ao operador: no painel, **Trocar para esta** na conta escolhida; ou, num terminal fora do app, `trocar-conta <conta>`. A troca leva uns 5 s, reabre o app e as conversas do Code continuam.

Não rode `trocar-conta <conta>`, `adicionar`, `sincronizar` nem `enxugar --aplicar` daqui. Nunca use **Sign out** no app para trocar: invalida o login guardado.
