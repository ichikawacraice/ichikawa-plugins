---
name: novo-projeto
description: Começa um app React novo da Wicomm já dentro do sistema de design — detecta o tipo de projeto, faz a entrevista curta que vira o PRODUCT e define a densidade, estampa a base (DESIGN, ANATOMIA, CONVENCOES) em design/, escreve o design/design-system.json, liga o plugin e o registro no projeto e leva a primeira tela pelo designer e pelo crítico. Use quando a pessoa for criar ou iniciar um app, painel ou sistema React novo da Wicomm ("projeto novo", "começar um app do zero", "bootstrap", "monta a base de um sistema novo", `/design-wicomm:novo`). Não serve para projeto que já existe (esse é o `auditar-projeto`) nem para loja FastStore ou Wake.
---

# Projeto novo no sistema Wicomm

O projeto nasce com a base copiada e estampada, com o processo ligado e com a primeira tela decidida pelo designer e julgada pelo crítico. O que vale aqui é a base do plugin: `${CLAUDE_PLUGIN_ROOT}/base/` (DESIGN = como parece, ANATOMIA = o que vai onde, CONVENCOES = como o código sustenta as duas).

## 1. Detectar o tipo (pare se não for app React)

Leia o `package.json` da raiz (e o do front, num monorepo). Rode `node "${CLAUDE_PLUGIN_ROOT}/scripts/medir-deriva.mjs" <raiz> --pasta <front> --json` e olhe o `stack`.
- **App React (Next ou Vite)** → segue.
- **Loja** (`stack.loja: true`: FastStore, VTEX, Wake) → pare e diga que está fora do escopo: loja leva a marca do cliente e outro kit de componentes (Q627).
- **Projeto que já tem telas** (mais que um punhado de arquivos de tela, ou `components/ui` cheio) → não é projeto novo: proponha o `auditar-projeto`.
- **Tailwind v3** (`stack.tailwindV3`) → o sistema é só Tailwind v4: migre antes (`npx @tailwindcss/upgrade@<versão fixada>`, com o ok da pessoa) e só depois instale tokens e peças.
- **Pasta vazia** (ou só com `.git` e `.claude`) → crie o app antes, com o ok da pessoa para o comando. Next, na versão que o registro prova (`num-next-vazio`): `npx -y create-next-app@16.4.3 . --ts --tailwind --app --no-eslint --no-src-dir --import-alias "@/*" --use-npm --turbopack --yes`. Vite: `npm create vite@<versão fixada> -- --template react-ts` mais o Tailwind v4. O sistema é só Tailwind v4.

## 2. Entrevista curta (vira `design/PRODUCT.md`)

Três perguntas, uma mensagem só, cada uma com a sua recomendação:
1. **Quem usa** (papéis) e **para quê** (a tarefa principal de cada papel).
2. **Em que tela e largura** (notebook de escritório? celular em campo?) e **com que frequência** (o dia todo × de vez em quando).
3. **A primeira tela** a construir e o arquétipo dela (ANATOMIA, ARQ-01).

A frequência define a **densidade** (DESIGN): quem opera o dia todo → `instrumento` (DENS-01); quem usa de vez em quando, inclusive o cliente final → `site` (DENS-02). A marca é a Wicomm, que vem com este plugin (`tema/`): não pergunte cor nem fonte. Escreva `design/PRODUCT.md` com as respostas (papéis, cenas de uso, largura de referência, densidade e o porquê).

## 3. Estampar a base e escrever a configuração

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/base-do-projeto.mjs" estampar <raiz> --densidade <instrumento|site> --pasta <front>
```

Isso copia DESIGN, ANATOMIA e CONVENCOES para `design/` (e a cópia intocada para `design/.base/`, o ancestral das atualizações) e escreve o `design/design-system.json` com `versao`, `densidade`, `pasta` e os hashes. Se ele disser que **manteve** um documento que já existia, pare e pergunte à pessoa (recomendação: mover o antigo para `design/legado/` e estampar de novo). Complete o `design/design-system.json` com:
- `fontes`: `["design/PRODUCT.md", "design/ANATOMIA.md", "design/DESIGN.md", "design/CONVENCOES.md"]`
- `kit`: a pasta das peças (ex.: `<front>/src/components/ui`)
- `revisoes`: `docs/design/revisoes`
- `largura`: a largura de referência da entrevista (padrão 1280)
- `pecas`: `{}` (o `peca-do-kit` anota cada peça instalada)

E no projeto:
- **`.claude/settings.json`**: `extraKnownMarketplaces` com o marketplace `ichikawa-plugins` e `enabledPlugins: { "design-wicomm@ichikawa-plugins": true }` — o plugin só se liga no projeto interno da Wicomm, por este arquivo, nunca na conta. Quem abrir o projeto no Claude Code recebe o convite para instalar. Depois, a skill `design-wicomm:aplicar-tema` liga o projeto ao tema.
- **`CLAUDE.md`**: um bloco curto "Design system Wicomm" dizendo que toda tela nova passa pelo `designer` e pelo `critico-de-ui` (no ajuste de tela que já existe, a crítica é opcional), que a norma está em `design/`, e que a nota de 24/30 (28/35 em site) é a porta do PR (CONV-19, CONV-20).
- **`docs/deploy.md`**: copie `${CLAUDE_PLUGIN_ROOT}/skills/novo-projeto/modelos/deploy.md` e troque `<app>`, `<pasta>` e `<time>` pelos do projeto. Diz que o deploy de produção é o da Vercel a cada push na `main` (os pacotes `@wicomm` vêm do npm público, sem token) e como conferir e voltar atrás.
- **`components.json`** com o registro `@wicomm` em `registries`, quando o registro estiver publicado (veja o passo 4).

## 4. Tokens, peças, casco e guardas — o que já existe

Confira antes de prometer: o pacote `@wicomm/tokens`, o registro shadcn `@wicomm` e o pacote `@wicomm/guardas` são fatias próprias do sistema e podem ainda não estar publicados.
- **Publicado:** instale os tokens e as guardas do npm público, pelo nome (`npm install @wicomm/tokens @wicomm/guardas`, sem `.npmrc` nem token; detalhe em `design-system/docs/instalar-pacotes.md` do repositório do kit) — os tokens são o CSS para Tailwind v4 —, traga o estilo Wicomm do registro (passo 1), traga as primitivas e o **casco** (barra lateral, cabeçalho, trilha, título — ANATOMIA, CASCO-01) com o `peca-do-kit`, ligue as guardas no teste com base zero e crie a rota `/atelie` (CONV-23). Na ordem que o piloto provou:
  0. **O registro.** O registro publicado é `https://wicomm-atelie.vercel.app/r/v0.1.0/{name}.json` e é **público**: o `shadcn` baixa sem senha, cabeçalho nem variável de ambiente (desde 13/11/2026; só a vitrine do ateliê pede senha). Confira antes de seguir: `curl -s -o /dev/null -w "%{http_code}" https://wicomm-atelie.vercel.app/r/v0.1.0/registry.json` tem de dar `200`.
  1. **O estilo.** Escreva antes o `components.json` (o do `shadcn init`, com `"style": "new-york"`, `"tailwind": { "css": "app/globals.css", "cssVariables": true, … }` e os `aliases` do `@/`) já com o registro: `"registries": { "@wicomm": "<url do registro>/{name}.json" }`. Depois, `npx -y shadcn@4.21.5 add @wicomm/estilo --yes`: dá o mesmo `globals.css` que o `init` (conferido no F319). O `init @wicomm/estilo` pergunta se sobrescreve o `components.json` e, aceito, perde o `registries`. Projeto antigo com `"headers": { "x-vercel-protection-bypass": … }` no `registries` segue funcionando; o cabeçalho pode sair.
  2. Num `add` só, todas as peças (`registry:ui` e `registry:lib` do `registry.json` do registro), o `casco` e o bloco do arquétipo da primeira tela: `npx -y shadcn@4.21.5 add @wicomm/button @wicomm/card … @wicomm/casco @wicomm/lista --yes`. Cada nome leva o `@wicomm/`: `toast` sem prefixo é o do shadcn, que o CLI recusa. O `casco` instala também o cabeçalho (`cabecalho-do-app.tsx`) e a troca de contexto (`menu-do-contexto.tsx`): o `casco-no-next.tsx` os monta. O app que não tem o que pôr ali (uma equipe só, nada a trocar) tira o `cabecalho` do `casco-no-next.tsx` e **então** apaga os dois arquivos (apagar antes quebra o build pelo import; tirar sem apagar deixa a `componente-que-ninguem-monta` em erro); eles voltam pelo `add` quando o app precisar.
  2b. **A página do `create-next-app`** (`app/page.tsx`) é a vitrine do Next, com cor literal, paleta direto e vidro: sozinha reprova quatro guardas. Troque por um `redirect` para a primeira tela.
  3. **O layout raiz** (`app/layout.tsx`): a fonte Archivo com o eixo de largura por `next/font` (`variable: "--font-archivo"`, TIPO-01), `<ScriptsAntesDoDesenho />` de `@/lib/antes-do-desenho` no `<head>`, `lang="pt-BR"` e `suppressHydrationWarning` no `<html>`. Sem isso o texto cai na fonte do sistema e o tema pisca.
  4. **As guardas:** `"test": "wicomm-guardas"` no `package.json` e um workflow de CI que roda `npm ci && npm test` (os pacotes são públicos: o job não precisa de token). A chave `guardas` do `design/design-system.json` precisa de: o `glossario` do `o-vocabulario-da-tela` (palavra do código → palavra da tela; o bloco do registro fala a palavra do exemplo, como "pedido"); `ignorar: ["<app>/atelie/"]` (o ateliê é catálogo, não tela do produto); e, desligadas com o motivo, as guardas cujo assunto o app ainda não tem (`a-tela-de-entrada-tem-o-botao-grande` sem tela de Entrada, `o-erro-de-submissao-alcanca-os-olhos` sem formulário), que voltam com ele. Guarda que não achou o que examinar é erro (CONV-14), não verde.
  5. **O `/atelie`:** o registro ainda não tem o item do ateliê. Até ter, a rota mostra cada peça instalada viva, com `data-vitrine="<nome>"`, num palco por tema (um iframe para o claro e outro para o escuro: o `.dark` no `<html>` não se desfaz num contêiner).
  6. Anote cada peça no `pecas` do `design/design-system.json` (`peca-do-kit`, seção 3).
- **Ainda não publicado:** não copie peça à mão nem invente token. Escreva o que ficou de fora numa lista "Falta do sistema" no `design/PRODUCT.md` (qual pacote, qual passo) e siga: a base e o processo já valem sem eles.

## 5. A primeira tela pelo processo

1. Subagente `designer`: revisão de arquitetura da primeira tela (skill `revisao-de-arquitetura-de-ui`), gravada em `docs/design/revisoes/`.
2. Subagente `critico-de-ui` sobre a revisão. Abaixo do teto ou com ressalva alta: volta ao designer (no máximo 2 recríticas).
3. Código da tela **como a revisão aprovou** (CONV-21), com peças do kit e tokens.
4. Subagente `critico-de-ui` sobre o código.

Cada crítica, você grava ao fim do arquivo da revisão (skill `critica-de-ui`, *Quem grava a crítica*): sem isso o `/design-wicomm:estado` não tem nota.

## 6. Pronto quando

- O app sobe (`npm run dev` sem erro) e o build passa.
- `design/` tem os quatro documentos e o `design/design-system.json` tem a versão; `node "${CLAUDE_PLUGIN_ROOT}/scripts/estado.mjs" <raiz>` mostra a versão e "igual à base".
- A primeira tela tem crítica no teto ou acima (24/30; 28/35 em site), gravada no arquivo da revisão (o `estado` mostra a nota).
- `docs/deploy.md` existe e descreve o deploy, a conferência e a volta atrás.
- O que dependia de pacote não publicado está na lista "Falta do sistema".

Diga à pessoa, no fim: o que foi criado, a nota da primeira tela, e o que ficou na lista "Falta do sistema".
