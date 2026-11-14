---
name: atualizar-sistema
description: Sobe um projeto para a versão corrente do sistema Wicomm — compara a versão estampada no design/design-system.json com a do plugin, faz o merge de três vias da base (DESIGN, ANATOMIA, CONVENCOES) preservando o que o projeto acrescentou, lê a nota de migração, atualiza os tokens e mostra o diff de cada peça instalada contra o registro. Use quando o `/design-wicomm:estado` disser que o projeto está atrasado, quando a base ou o registro ganharem versão nova ("atualiza o design system", "sobe para a versão nova da base", "o projeto está na versão velha", `/design-wicomm:atualizar`). Não é para instalar o sistema pela primeira vez (isso é o `novo-projeto`).
---

> **O arquivo do projeto** é o `design/design-system.json`; no projeto que já tem o `design/wicomm.json` (o nome antigo) e não o novo, é o `design/wicomm.json`. Abaixo, `design/design-system.json` quer dizer esse arquivo: leia e grave nele, e nunca crie o outro nome ao lado (`node "${CLAUDE_PLUGIN_ROOT}/scripts/estado.mjs" <raiz>` diz qual vale).

# Atualizar o sistema no projeto

Uma versão só amarra base, tokens, registro e guardas (semver: MAJOR quebra tela, MINOR acrescenta peça ou regra com catraca, PATCH conserta). Atualizar é trazer as quatro camadas para a versão corrente sem perder o que o projeto acrescentou.

## 1. Onde estamos

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/estado.mjs" <raiz>
```

Mostra a versão do projeto × a do plugin, a base editada no projeto e as peças com deriva. Projeto sem `design/design-system.json` não se atualiza: é o `novo-projeto` (projeto novo) ou o `auditar-projeto` (existente).

## 2. A base — merge de três vias

Antes, a árvore de trabalho limpa (`git status`): o merge escreve em `design/`.

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/base-do-projeto.mjs" atualizar <raiz>
```

Para cada documento, mescla a cópia do projeto, o ancestral (`design/.base/`, a base que o projeto recebeu) e a base nova do plugin.
- **Sem conflito:** grava, troca o ancestral e sobe a `versao` no `design/design-system.json`.
- **Com conflito** (sai 1): o arquivo fica com os marcadores `<<<<<<< projeto` / `>>>>>>> base nova` e a versão **não** sobe. Mostre cada conflito à pessoa com a recomendação (em regra, a base nova vence; o acréscimo do projeto que contradiz a base vira *Decisão ao operador*), resolva os marcadores e rode `node "${CLAUDE_PLUGIN_ROOT}/scripts/base-do-projeto.mjs" atualizar <raiz> --resolvido` — ele confere que não sobrou marcador, aceita o arquivo como mesclado (inclusive o lado do projeto) e sobe a versão.

## 3. A nota de migração

Leia as notas de release do sistema entre a versão antiga e a nova (o `CHANGELOG.md` do repositório `ichikawacraice/wicomm-atelie`: uma entrada por versão da base, com *O que muda* e *Migração*). MAJOR traz passos de migração de tela: liste-os como trabalho, não os aplique calado.

## 4. Tokens e guardas

Se o projeto usa `@wicomm/tokens` e `@wicomm/guardas`, suba os dois para a versão nova, do npm público (`npm install @wicomm/tokens@<versão> @wicomm/guardas@<versão>`) e rode as guardas: regra nova entra com catraca, então a contagem atual vira a linha de base e só o que é novo reprova. Pacote não publicado: diga e siga.

**Projeto instalado pelo GitHub Packages** (`package.json` com `npm:@wicomm-projects/…` ou `.npmrc` com `@wicomm-projects:registry`): os pacotes saíram dali para o npm público, e o registro antigo não recebe versão nova. Troque pelo nome, no mesmo `npm install` acima, sempre com a versão (`@<versão>` ou `@latest`: sem ela, o npm reaproveita o alias do `package.json`); tire do `.npmrc` as duas linhas do `npm.pkg.github.com` (o arquivo vazio sai); tire o `NODE_AUTH_TOKEN` e o `packages: read` do CI do projeto, se só serviam aos pacotes. Se o `docs/deploy.md` manda fazer o build na máquina (`vercel build --prebuilt`), diga à pessoa que o motivo acabou (a regra que o pedia foi revogada) e que o deploy pode voltar ao da Vercel: recomende, sem trocar calado, porque mexe no release dela.

## 5. As peças instaladas

Para cada peça em `pecas` do `design/design-system.json`:
- **Como instalada** (hash igual): `npx shadcn@<versão fixada> add @wicomm/<peça> --overwrite` na versão nova, e anote o hash novo.
- **Editada no projeto:** **não sobrescreva.** Mostre o diff (`npx shadcn@<versão fixada> add @wicomm/<peça> --diff`) e recomende: a edição volta ao registro como proposta (skill `peca-do-kit`, passo 4) ou é descartada.

## 6. Pronto quando

`/design-wicomm:estado` mostra a versão corrente, nenhum conflito pendente em `design/`, build e guardas verdes. Diga à pessoa o que mudou (versão de → para, documentos mesclados, peças atualizadas, peças com deriva e a recomendação para cada uma).
