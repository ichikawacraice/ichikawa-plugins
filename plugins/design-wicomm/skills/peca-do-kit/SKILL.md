---
name: peca-do-kit
description: Acha e instala a peça certa do kit Wicomm para uma função da tela — consulta a tabela da peça por função da ANATOMIA, procura no registro shadcn @wicomm (pelo MCP do shadcn ou pelo CLI), instala com `npx shadcn add @wicomm/<peça>` e anota versão e hash no design/design-system.json; quando a peça não existe, propõe a peça nova para o registro em vez de montar um arranjo na tela. Use quando precisar de um componente de UI num app React da Wicomm ("preciso de um botão/diálogo/tabela/toast", "qual componente uso para…", "instala a peça", "falta um componente", "adiciona do registro"). Não desenha a tela (isso é o `designer`).
---

> **O arquivo do projeto** é o `design/design-system.json`; no projeto que já tem o `design/wicomm.json` (o nome antigo) e não o novo, é o `design/wicomm.json`. Abaixo, `design/design-system.json` quer dizer esse arquivo: leia e grave nele, e nunca crie o outro nome ao lado (`node "${CLAUDE_PLUGIN_ROOT}/scripts/estado.mjs" <raiz>` diz qual vale).

# A peça do kit

Toda região da tela é montada com peças do kit (PRIN-05); a peça certa para cada função está na ANATOMIA (PECA-01). Esta skill acha a peça, instala do registro e anota — ou, se ela não existe, propõe a peça nova **para o registro** (PECA-02), nunca um arranjo à mão na tela.

## 1. Qual peça

Leia a tabela **a peça de cada função** (ANATOMIA, PECA-01: `design/ANATOMIA.md` do projeto, ou `${CLAUDE_PLUGIN_ROOT}/base/ANATOMIA.md`). Ache a função pedida (confirmar ação irreversível, ajuda de um campo, estado de uma linha, troca de vista…) e a peça que a base indica — e a que **não** usar.

## 2. Já está no projeto?

Procure na pasta `kit` do `design/design-system.json` (e em `pecas`). Já instalada: use; se o arquivo foi editado no projeto (`node "${CLAUDE_PLUGIN_ROOT}/scripts/estado.mjs" <raiz>` mostra "editada no projeto"), avise — a mudança devia voltar ao registro.

## 3. No registro

O registro Wicomm é um registro shadcn próprio, declarado no `components.json` do projeto (`"registries": { "@wicomm": "<url>/r/v{versao}/{name}.json" }`; a versão vai no caminho da URL, porque o item do registro não tem campo de versão).
- **Com o MCP do shadcn** (o plugin traz o `.mcp.json`): busque e veja a peça pelo MCP, nos registros do `components.json`.
- **Sem MCP:** `npx shadcn@<versão fixada> search @wicomm -q <termo>` e `npx shadcn@<versão fixada> view @wicomm/<peça>`.
- **Instalar:** `npx shadcn@<versão fixada> add @wicomm/<peça>`. Depois, anote no `design/design-system.json`, em `pecas`, `{ "<peça>": { "arquivo": "<caminho instalado>", "versao": "<versão da URL>", "hash": "<sha256 do arquivo>" } }` (o hash: `shasum -a 256 <arquivo>`). É a anotação que deixa o `/design-wicomm:estado` e o `/design-wicomm:atualizar` verem a deriva.
- **Registro não declarado no `components.json`, ou ainda não publicado:** diga isso e pare aqui. Não copie peça de outro projeto nem do shadcn padrão "por enquanto": é exatamente a deriva que o sistema existe para evitar.

## 4. A peça não existe

Proponha a peça nova **para o registro**, no formato:

```markdown
## Peça nova para o registro: <nome em PT>
- **Função:** a linha que entraria na tabela PECA-01
- **Por que nenhuma peça serve:** a peça mais próxima e o que falta nela
- **Partes:** …   **Variantes:** …   **Estados:** (os da ANATOMIA, EST-01)
- **Tokens:** (só da escala da DESIGN)
- **Onde aparece primeiro:** tela e região
```

A proposta vai ao repositório do sistema (a pasta `design-system/` do repositório `ichikawacraice/kit-de-orquestracao`), não ao projeto. Até ela entrar, a tela usa a peça mais próxima do kit e a revisão registra a lacuna.
