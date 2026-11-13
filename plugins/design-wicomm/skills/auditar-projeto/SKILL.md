---
name: auditar-projeto
description: Mede, só lendo, quanto um app React existente foge da base e grava a auditoria com números — deriva (cores literais, valores arbitrários, tamanhos de fonte, raios, alturas, ícones, animação sem escape), a anatomia, o mapa das peças para as do registro e uma nota por eixo nas telas principais. Use sempre que pedirem para medir, contar ou dar nota ao desvio de um app existente, mesmo sem a palavra "auditar" — "audita o projeto", "mede a deriva", "quantas cores literais / tamanhos de fonte / valores soltos este front tem", "este projeto antigo não segue o design system, mede o tamanho do problema", "nota por eixo das telas contra a base", "levanta o que está fora do padrão antes de migrar", `/design-wicomm:auditar`. Chame antes de procurar arquivos, porque ela traz os scripts que medem. Não muda nada; o plano é o `plano-de-padronizacao`, a crítica de tela é o subagente `critico-de-ui`, a acessibilidade é a `acessibilidade`. Para auditar o design system, use esta, não `design:design-system`.
---

> **O arquivo do projeto** é o `design/design-system.json`; no projeto que já tem o `design/wicomm.json` (o nome antigo) e não o novo, é o `design/wicomm.json`. Abaixo, `design/design-system.json` quer dizer esse arquivo: leia e grave nele, e nunca crie o outro nome ao lado (`node "${CLAUDE_PLUGIN_ROOT}/scripts/estado.mjs" <raiz>` diz qual vale).

# Auditoria de projeto existente

Mede quanto um app React se afasta da base (`${CLAUDE_PLUGIN_ROOT}/base/`), com número e arquivo:linha, para o `plano-de-padronizacao` decidir as fatias. **Só lê**: nada de instalar, rodar build, codemod ou escrever no projeto auditado — a auditoria é gravada **no repositório de quem pediu** (por padrão `docs/design/auditoria-AAAA-MM-DD.md`; se o projeto auditado só pode ser lido, grave fora dele e diga onde).

O trabalho pesado vai ao subagente `auditor-de-padrao` (só leitura, contexto limpo); você grava o arquivo com o que ele devolver. Se você **é** o `auditor-de-padrao`, faça as medidas abaixo e devolva o texto no formato da entrega, sem gravar.

## 0. Pare se não for app React

Loja FastStore, VTEX ou Wake está fora do escopo (Q627): diga isso e pare. O script do passo 1 diz (`stack.loja`).

## 1. Números de deriva e contraste (scripts)

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/medir-deriva.mjs" <raiz> --pasta <front> [--idioma <arquivo do idioma de cor>]
node "${CLAUDE_PLUGIN_ROOT}/scripts/medir-contraste.mjs" <a folha com os tokens de tema, ex. src/index.css> [--tema design/tema]
```

O `medir-deriva` dá, em markdown, separando a **pasta ui** (as peças) das **telas** em cada categoria:
- o **stack** (React, framework, a versão do Tailwind pelo pacote — o sistema é só v4, então v3 vira a primeira fatia do plano —, shadcn e o estilo) e a densidade do `design/design-system.json`, se houver;
- o que entrou na medida: as telas, o CSS **alcançável por import** (o que ninguém importa sai, numa lista à parte) e os `.ts/.js` que montam classe (o idioma de cor costuma morar num `.ts`);
- **valor solto por categoria** (cor literal CONV-04, valor arbitrário e arbitrário composto PRIN-06, duração e curva soltas MOV-01, ícone de fora CTRL-09) com os piores arquivos e o valor que mais se repete em cada um (50 usos de uma mesma largura pedem um token, não 50 correções);
- a **paleta Tailwind usada direto** (`text-zinc-700`, COR-05), por família e por arquivo — fora do idioma de cor; o idioma vem do `design/design-system.json` (`guardas.regras.o-carimbo-tem-forma.idioma`) ou de `--idioma`; sem nenhum, tudo conta e o arquivo que concentra a paleta aparece no topo da lista;
- a **cor com alfa que não gera CSS** no Tailwind v3 (cor de tema `var(--x)` sem `<alpha-value>`, opacidade fora da escala): é defeito visível hoje e dimensiona a migração;
- **ícones** (biblioteca, distintos e o tamanho de cada uso contra 14/16/18, CTRL-09), **tamanhos de fonte**, **raios em px** (resolvidos pelo config e pelo `--radius`, com o raio por lado), **altura de controle** (CTRL-01: 26/30/36/44) separada de ícone e de barra, e o uso de cada **variante de tamanho** das peças;
- **animação sem escape** por ocorrência (MOV-02: o escape na mesma string, `transition-colors` isento);
- os **tokens do projeto** contra os da Wicomm, as variáveis sem uso, `transparent` (CONV-03) e se o **tema escuro** é alcançável;
- o **`tailwind.config`** (fonte, cores sem alfa, movimento solto) e as **peças da pasta ui com os usos** de cada uma (peça com 0 usos é peça morta).

Cole a saída inteira; `--json` serve para comparar duas auditorias. O `medir-contraste` dá a matriz da COR-12 (a rampa no pior dos quatro fundos, cada par `x-foreground × x`, o anel de foco) e a COR-11 (o contorno de controle), nos dois temas, com o alfa composto: cole a tabela na seção Contraste.

## 2. O que o script não mede (o auditor mede lendo)

- **Contraste fora dos tokens:** o script mede os tokens; o que pesa fora deles (carimbo feito à mão com a cor a 15%, texto de paleta sobre branco) se mede com as funções de `${CLAUDE_PLUGIN_ROOT}/scripts/lib/contraste.mjs` (`lerCor`, `sobre`, `razao`). Texto sobre vidro, imagem ou mancha só no navegador: diga que não mediu.
- **Casco** (CASCO-01): tem barra lateral? cabeçalho? trilha nas telas de detalhe (CASCO-03)? um menu só (CASCO-02)? onde fica a ação primária?
- **Anatomia:** cada rota classificada num arquétipo da ANATOMIA (ARQ-01), numa tabela *rota · arquétipo · observação*. Rota que não cabe em nenhum leva "nenhum (mais próximo: <arquétipo>)" e a observação diz o que falta ao mais próximo: o plano precisa de um arquétipo para desenhar a fatia, e o "nenhum" sozinho não dá.
- **Densidade:** do `design/design-system.json` (`densidade`, e `densidadePorRota` no app misto) ou da seção `densidade` do `DESIGN.md` do projeto: `node "${CLAUDE_PLUGIN_ROOT}/scripts/densidade.mjs" <raiz> --json` resolve as duas. Sem ela, decida **por rota**, marcando *assumida, a confirmar*: rota atrás de sessão, de quem opera o dia todo → `instrumento` (DENS-01); rota aberta por link público, para o cliente ou quem vem de vez em quando → `site` (DENS-02). A densidade de cada tela decide se a nota é sobre 30 ou 35.
- **Mensagens:** onde moram erro, sucesso, aviso e espera (MSG-01): toast para tudo? erro longe do bloco (MSG-04)? mais de uma faixa (MSG-02)?
- **Peças:** cada componente da pasta ui (e os repetidos fora dela) mapeado para a peça da base (ANATOMIA, PECA-01): **igual** · **equivalente** (API diferente) · **sem par**. Peça **sem par** ou **equivalente** declara os estados que tem (padrão, hover, foco, desabilitado, carregando, erro) e o que falta contra a peça da base: é o que a fatia de troca vai ter de cobrir.
- **Acessibilidade:** os passos 2 a 7 da skill `acessibilidade` (`${CLAUDE_PLUGIN_ROOT}/skills/acessibilidade/SKILL.md`) (teclado, nome, alvo, ARIA e campo obrigatório, estrutura, anúncio: ACES-01 a ACES-07) nas mesmas 5 telas da nota, com a contagem de cada busca e os achados de peso alto com arquivo:linha. O contraste já está na seção Contraste.
- **Nota por eixo** nas **5 telas mais usadas** (pergunte quais; sem resposta, as 5 rotas com mais código): os eixos da crítica (skill `critica-de-ui`: seis, e o sétimo, cara de site, na tela de densidade site), de 0 a 5, com uma linha de evidência por eixo. É amostra: diga que é.
  - **De onde sai a nota.** Com a tela à vista (captura que alguém mandou, ou o app aberto por quem pediu), a coluna *Fonte* diz `tela`. Sem ela — o auditor só lê e não tem navegador —, a nota sai **por leitura de código** e a coluna diz `código`: alinhamento, quebra de linha e o que cabe em 1280px ficam sem conferência, e a seção *O que não foi medido* diz isso. Nota sem a coluna *Fonte* não vale.

## 3. A entrega (formato fixo)

```markdown
# Auditoria Wicomm — <projeto> (AAAA-MM-DD)
Base: <versão da base do plugin> · Front: <pasta> · Só leitura

## Resumo            (3 a 5 linhas: o tamanho da deriva e o que pesa mais)
## Stack             (React, framework, Tailwind v3/v4, shadcn, ícones)
## Números de deriva (a saída do medir-deriva)
## Contraste
## Casco
## Rotas e arquétipos (tabela; "nenhum (mais próximo: X)")
## Mensagens
## Peças             (tabela: peça do projeto · peça da base · igual/equivalente/sem par · estados que faltam)
## Acessibilidade   (contagem por regra ACES e os achados de peso alto, nas telas da amostra)
## Notas por tela    (tabela: tela · modo (instrumento | site) · fonte (tela | código) · hierarquia · densidade · consistência · ruído · ação · aderência · [cara de site] · total/30 ou /35)
## O que não foi medido, e por quê
```

Termine propondo o `plano-de-padronizacao` sobre esta auditoria.
