---
name: aplicar-tema
description: Liga um projeto React ao tema Wicomm do design system — copia o tema (cores da marca, fonte Archivo, nome, logotipo, prefixo do registro @wicomm) para design/tema/, onde as medidas do plugin o leem, e confere que o components.json, o CSS e o layout usam o registro, os tokens e a fonte do tema. Use no fim do novo-projeto ou ao trazer um projeto da Wicomm para o sistema ("aplica o tema Wicomm", "liga o tema", `/design-wicomm:aplicar-tema`). Não muda cor nem fonte: o tema é dado, e mudá-lo é mudar o tema no repositório do sistema (`design-system/temas/wicomm/` do `kit-de-orquestracao`) e a cópia em `tema/` deste plugin.
---

# Aplicar o tema Wicomm num projeto

O tema é dado: a marca, a fonte, o nome e o prefixo do registro. Aplicar é deixar o projeto apontando para ele. Nada aqui gera token nem muda cor.

## 1. Copiar o tema

```bash
mkdir -p design/tema && cp "${CLAUDE_PLUGIN_ROOT}/tema/tema.json" "${CLAUDE_PLUGIN_ROOT}/tema/tema.tokens.json" design/tema/
```

É a cópia que o `medir-contraste` do plugin lê (`--tema design/tema`): a marca e a razão aceita sobre ela (MARCA-01). Se o projeto já tem `design/tema/` com outro `id`, pare e leve à pessoa: um projeto tem um tema só.

## 2. Conferir o que o projeto usa (só lendo; o que falta vira passo para a pessoa)

- **Registro:** o `components.json` declara o prefixo do tema (`registro.prefixo` do `tema.json`, hoje `@wicomm`) em `registries`, com a URL do registro do sistema.
- **Tokens:** a folha de estilo importa `@wicomm/tokens/tailwind-v4.css` (o CSS já sai com o tema Wicomm).
- **Fonte:** o layout raiz carrega a família do tema (`fonte.familia`, Archivo) com o eixo de largura e declara a variável do tema (`fonte.variavel`, `--font-archivo`) no `<html>` (no Next, `next/font` com `variable: "--font-archivo"`). Sem ela o texto cai na fonte do sistema e o `t-rotulo` não estreita.
- **Arquivo do projeto:** grave `"tema": "wicomm"` no `design/design-system.json` (ou no `design/wicomm.json`, se for o que o projeto tem).

## 3. Pronto

`design/tema/` igual ao do plugin, o projeto declarando o tema, e os três itens da conferência certos ou listados para a pessoa com o arquivo e a linha.
