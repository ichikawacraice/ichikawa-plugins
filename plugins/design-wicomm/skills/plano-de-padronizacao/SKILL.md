---
name: plano-de-padronizacao
description: Transforma a auditoria de um app React existente no plano de padronização para a base — fatias em ordem fixa (entrada no sistema, Tailwind v4 quando o projeto está em v3, tokens com ponte e catraca, primitivas, casco e navegação, tela a tela por arquétipo, remover a ponte), cada uma um PR que não muda a lógica do produto, com critério de pronto medido. Use depois do `auditar-projeto` ("monta o plano de padronização", "como trazer este app para o padrão Wicomm", "padroniza o projeto", `/design-wicomm:padronizar`). Escreve só o plano; cada fatia é executada depois, uma por vez.
---

> **O arquivo do projeto** é o `design/design-system.json`; no projeto que já tem o `design/wicomm.json` (o nome antigo) e não o novo, é o `design/wicomm.json`. Abaixo, `design/design-system.json` quer dizer esse arquivo: leia e grave nele, e nunca crie o outro nome ao lado (`node "${CLAUDE_PLUGIN_ROOT}/scripts/estado.mjs" <raiz>` diz qual vale).

# Plano de padronização

Da auditoria às fatias. **Pré-requisito:** uma auditoria gravada pelo `auditar-projeto`: o caminho que a pessoa der (argumento do `/design-wicomm:padronizar`, ou dito no pedido — a auditoria pode morar em outra pasta, como `docs/padronizacao-wicomm/auditoria.md`); sem caminho, a mais recente em `docs/design/auditoria-*.md`; sem nenhuma, rode a auditoria antes — não planeje de memória. O plano vai para a pasta da auditoria: `plano.md` com a ordem e a situação, e **uma fatia por arquivo** em `fatias/` (`fatias/E-entrada.md`, `fatias/0-tailwind-v4.md`…), cada uma com o que entra, o critério de pronto e o que fica de fora — é o arquivo que a sessão que executar a fatia lê. Sem pasta própria, `docs/design/plano-de-padronizacao-AAAA-MM-DD.md` com as fatias como seções.

## As regras do plano

- **Cada fatia é um PR**, e **nenhuma muda a lógica do produto**: o que muda é a aparência, a anatomia e o código de tela.
- **A ordem é fixa** (abaixo, de E a 5); fatia pulada diz por quê (ex.: o projeto já está em Tailwind v4, e a fatia 0 não existe).
- **Toda fatia tem critério de pronto medido** (número da auditoria que cai, crítica no teto, build verde) e a captura **antes/depois** das telas mais usadas: mudança visual que não estava pretendida é defeito.
- **Nada de reescrever tela sem revisão:** a partir da fatia 4, cada tela passa por `designer` → `critico-de-ui` → código → `critico-de-ui`.
- **Dependência do sistema:** tokens, registro e guardas são pacotes do sistema Wicomm. Fatia que depende de pacote ainda não publicado fica marcada *bloqueada: <pacote>* e o plano segue com as que não dependem.

## As fatias, nesta ordem

E. **Entrada no sistema** (sempre a primeira; não muda nada visível). Faz as três perguntas do passo 2 do `novo-projeto` (quem usa, em que tela e largura, com que frequência), escreve o `design/PRODUCT.md` e decide a **densidade** com elas (DENS-01, DENS-02: ela muda o teto da crítica). App misto (instrumento por dentro, site no link público para o cliente) decide por rota e grava `densidadePorRota` no `design/design-system.json` (`{ "/p/*": "site" }`), com `densidade` valendo para o resto. Depois estampa a base e escreve a configuração: `node "${CLAUDE_PLUGIN_ROOT}/scripts/base-do-projeto.mjs" estampar <raiz> --densidade <a decidida> --pasta <front>`, completa o `design/design-system.json` (`fontes`, `kit`, `revisoes`, `largura`) e liga o plugin no `.claude/settings.json` do projeto (o mesmo passo 3 do `novo-projeto`). Se o `estampar` disser que **manteve** um documento (o projeto já tinha um `design/DESIGN.md` próprio, por exemplo), pare e leve à pessoa como decisão, com a recomendação de renomear o antigo (`design/legado/`) e estampar de novo: senão o designer lê o documento antigo no lugar da base. A partir daqui a guarda cobra a crítica de toda tela que mudar, e o `/design-wicomm:estado` mede o projeto. *Pronto:* `estado` mostra a versão e a densidade; nenhum arquivo de tela mudou.
0. **Tailwind v4** (só se a auditoria diz `tailwindV3`; vem logo depois da E e antes de qualquer token ou peça). O sistema Wicomm é só Tailwind v4: não há preset v3 dos tokens, e as peças do registro usam classes de v4 (`shadow-xs`, `outline-hidden`, `bg-(--x)`) que em v3 falham caladas. Codemod oficial (`npx @tailwindcss/upgrade@<versão fixada>`), revisão do diff e captura antes/depois das telas mais usadas. Nada de tokens nem peças antes dela. *Pronto:* build verde, zero diferença visual não pretendida.
1. **Tokens com ponte.** Instala `@wicomm/tokens` e `@wicomm/guardas` do npm público, pelo nome (`npm install @wicomm/tokens @wicomm/guardas`, sem `.npmrc` nem token; detalhe em `design-system/docs/instalar-pacotes.md` do repositório do kit); os tokens são o CSS de tema para Tailwind v4, e mapeia as variáveis antigas do projeto para as novas por *alias* (nada quebra no dia); liga as guardas de `@wicomm/guardas` **com catraca** (a linha de base da auditoria: violação nova reprova, contagem que desce exige a base regravada). *Pronto:* build verde, captura antes/depois sem diferença não pretendida, CI com a catraca ligada.
2. **Primitivas.** Troca botão, campo, select, diálogo, menu, toast (e as peças marcadas *igual* ou *equivalente* na auditoria) pelas do registro, com o `peca-do-kit`: codemod onde a API bate, à mão onde não bate. *Pronto:* a pasta ui só tem peças do registro (ou *sem par* justificadas), contagem de valor solto das primitivas zerada.
3. **Casco e navegação.** Barra lateral, cabeçalho, trilha e título de página da base (CASCO-01 a CASCO-03, TIPO-04). É aqui que o cliente sente que é a mesma empresa. *Pronto:* crítica do casco no teto, nos dois temas.
4. **Tela a tela, por arquétipo**, as mais usadas primeiro (a tabela de rotas da auditoria). Uma fatia por tela ou por grupo pequeno do mesmo arquétipo, cada uma com revisão e crítica. *Pronto:* crítica no teto em cada tela; a contagem da catraca daquela tela, zerada.
5. **Remover a ponte.** Apaga os *aliases* da fatia 1 e zera o que restou na catraca (ou justifica cada resto). *Pronto:* nenhuma variável antiga, catraca zerada, `design/design-system.json` na versão corrente (`/design-wicomm:estado`).

## A entrega

```markdown
# Plano de padronização — <projeto> (AAAA-MM-DD)
Auditoria: <caminho> · Base: <versão>

## Onde estamos   (os números da auditoria que o plano vai derrubar)
## Fatias         (tabela: # · fatia · arquivo em fatias/ · o que entra · critério de pronto · depende de · situação)
## Telas da fatia 4 (tabela: tela · arquétipo · nota hoje · ordem)
## Riscos         (o que pode quebrar e como a captura antes/depois pega)
## Decisões ao operador (cada uma: o caso · se não decidir · recomendação)
```

O plano **pronto** é o critério da padronização inteira: catraca zerada (ou com o resto justificado), todas as telas com crítica no teto, `design/design-system.json` na versão corrente.
