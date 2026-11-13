---
name: acessibilidade
description: Audita, só lendo, a acessibilidade (nível AA) de uma tela, componente ou app React da Wicomm contra a base — contraste medido com os tokens nos dois temas e o alfa composto, teclado e foco visível, nome de cada controle, alvo de clique de 24px, língua, regiões e títulos, o que o leitor de tela anuncia — e devolve os achados com a regra (`ACES-02`, `COR-12`), o critério WCAG, arquivo:linha e a correção feita de peça e token do kit. Use quando pedirem "audita a acessibilidade", "checa a11y", "isto é acessível?", "o contraste passa?", "funciona no teclado?", "leitor de tela", "WCAG". Use esta, não `design:accessibility-review`: esta mede contra os tokens e as regras Wicomm, em PT-BR. Não edita nada.
---

> **O arquivo do projeto** é o `design/design-system.json`; no projeto que já tem o `design/wicomm.json` (o nome antigo) e não o novo, é o `design/wicomm.json`. Abaixo, `design/design-system.json` quer dizer esse arquivo: leia e grave nele, e nunca crie o outro nome ao lado (`node "${CLAUDE_PLUGIN_ROOT}/scripts/estado.mjs" <raiz>` diz qual vale).

# Auditoria de acessibilidade

Mede uma tela, um componente ou um app React da Wicomm contra o nível **AA** e devolve o que bloqueia alguém de usar a tela, com número e arquivo:linha. A régua é a base (`${CLAUDE_PLUGIN_ROOT}/base/`; com `fontes` no `design/design-system.json`, as cópias do projeto vencem; no projeto sem esse arquivo, a base é referência citada, e a norma é a do projeto): o contraste, o foco e o movimento moram na DESIGN; o teclado, o nome, o alvo, a estrutura e o anúncio, na seção 8 das CONVENCOES (`ACES-01` a `ACES-07`).

**Só lê.** Nada de editar, instalar ou rodar build. A correção é instrução, não patch: quem conserta é quem pediu. Loja FastStore, VTEX ou Wake está fora do escopo: diga e pare.

## WCAG → regra da base

Cada achado cita a regra da base e o critério. Critério sem regra aqui não vira achado com peso alto: vai em *Observações*.

| Critério AA | O que pede | Regra Wicomm |
|---|---|---|
| 1.1.1 | imagem que informa tem texto; enfeite se cala | ACES-02 · COR-13 |
| 1.3.1 · 2.4.6 | estrutura no código: regiões, títulos, rótulo ligado ao campo, o elemento certo para cada gesto | ACES-04 · ACES-02 · ACES-06 · TIPO-04 |
| 1.4.1 | nada se diz só com cor | ACES-02 · COR-08 |
| 1.4.3 | texto 4,5:1 (grande 3:1) | COR-12 · CONV-18 |
| 1.4.11 | contorno de controle e ícone que informa 3:1 | COR-11 · COR-13 |
| 2.1.1 · 2.1.2 | tudo pelo teclado, sem armadilha de foco | ACES-01 |
| 2.3.3 (AAA, cobrado pela base) · 2.2.2 | movimento tem escape | MOV-02 |
| 2.4.3 · 2.4.7 | ordem do foco; foco à vista | ACES-01 · SUP-06 |
| 2.5.8 (WCAG 2.2) | alvo de 24×24px, ou folga até o vizinho | ACES-03 |
| 3.1.1 | língua da página | ACES-04 |
| 3.3.1 · 3.3.2 | erro identificado em texto; campo com rótulo; obrigatório declarado | MSG-04 · MSG-09 · CONV-09 · ACES-02 · ACES-07 |
| 4.1.2 | nome, papel e valor de todo controle; ARIA que não contradiz o HTML | ACES-02 · ACES-01 · ACES-06 · ACES-07 |
| 4.1.3 | mensagem de status anunciada | ACES-05 |

O alvo de **44×44px** (critério 2.5.5) é do nível AAA: não é achado, salvo na tela de Entrada (CTRL-02). Dois critérios AA da WCAG 2.2 não têm regra na base e vão em *Observações*: **2.5.7**, o que se arrasta tem alternativa de um clique (o quadro arrasta também pelo teclado, mas o clique simples não foi medido), e **3.3.7**, o dado já dado no mesmo fluxo não se pede de novo.

## Como se mede, na ordem

Rode de dentro da pasta do front (`pasta` do `design/design-system.json`). Toda busca abaixo é ponto de partida: abra cada ocorrência antes de chamá-la de achado — a peça do kit costuma resolver o que a busca acusa.

1. **Contraste (COR-11, COR-12, COR-13).** `node "${CLAUDE_PLUGIN_ROOT}/scripts/medir-contraste.mjs" <a folha com os tokens, ex. src/index.css>` dá a matriz nos dois temas, com o alfa composto. Projeto com tema aplicado (`design/tema/`): acrescente `--tema design/tema`, senão a marca e a razão aceita sobre ela são as do tema padrão. Fora dos tokens (texto de paleta sobre cartão, carimbo feito à mão a 15%), meça com `lerCor`, `sobre` e `razao` de `${CLAUDE_PLUGIN_ROOT}/scripts/lib/contraste.mjs`. Texto sobre imagem ou vidro só no navegador: diga que não mediu.
2. **Teclado e foco (ACES-01, SUP-06).** `rg -nU '<(div|span|li|td)\b[^>]*?onClick' -g '*.tsx'` (gesto fora de `button`/`a`; o `-U` pega a tag quebrada em várias linhas); `grep -rn 'tabIndex={[1-9]' --include='*.tsx'`; `outline-none`/`outline-hidden` sem `focus-visible:ring`, `focus-visible:after:ring`, `focus:bg-` nem `data-[highlighted]:bg-` na mesma classe (o foco só por programa, `tabIndex={-1}`, é isento); diálogo, menu ou gaveta escrito à mão em vez da peça do kit (a peça prende e devolve o foco).
3. **Nome e cor (ACES-02).** `<img` sem `alt`; botão cujo único filho é ícone `lucide-react` sem `aria-label`; `<input`/`<textarea`/`<select` sem `<label htmlFor>` nem `aria-label` (placeholder não conta); estado que só muda a cor (borda vermelha sem frase, ponto sem nome); `alt` que começa com "Imagem de" ou "Foto de" (o leitor já diz que é imagem).
4. **Alvo (ACES-03).** Ícone com `onClick` fora do botão `icon` do kit; botão de ícone com `className` que encolhe a caixa abaixo de `size-6`; alvos pequenos lado a lado (o círculo de 24px centrado no alvo pequeno não pode tocar outro alvo, nem o círculo de outro alvo pequeno). Texto corrido é isento.
5. **ARIA e obrigatório (ACES-06, ACES-07).** `rg -n 'aria-hidden' -g '*.tsx'` e abra cada uma: em `button`, `a`, `input` ou no pai deles é achado; `rg -nU '<(div|span)\b[^>]*?aria-label' -g '*.tsx'` sem `role` na mesma tag; `rg -n 'role="button"' -g '*.tsx'` (troque pelo `button`); `onClick` que só navega (`navigate(`, `router.push(`, `location.href`) em vez de `a href`; gatilho de abrir e fechar à mão sem `aria-expanded`. Campo obrigatório (mensagem de "obrigatório" na validação, asterisco no rótulo) sem `aria-required`; `required` em campo de `<form>` sem `noValidate`; asterisco sem `aria-hidden`.
6. **Estrutura (ACES-04).** `lang=` no `<html>` (layout raiz); `<main`, `<nav`, `<header` no casco; um `h1` por tela e títulos sem pular nível.
7. **Anúncio (ACES-05).** As peças de desfecho (texto do bloco, toast, resumo de erros, fim de espera) têm `role="status"`, `role="alert"` ou `aria-live`; a região `status` já está montada antes do texto, e o `alert` pode nascer com ele.
8. **Movimento (MOV-02).** A saída do `node "${CLAUDE_PLUGIN_ROOT}/scripts/medir-deriva.mjs" <raiz> --pasta <front>` traz a animação sem escape por ocorrência; use só essa linha.
9. **O que só a tela mostra.** Com o app ou o ateliê aberto: percorra a tela só com Tab, Enter, Espaço e Esc (aonde vai o foco ao fechar cada coisa?); leia a árvore de acessibilidade (nome e papel de cada controle); se der, uma passada com VoiceOver. O **zoom de 200%** se confere e se relata em *Observações*, sem peso: a base é desktop primeiro (LAY-04) e ainda não tem regra de refluxo. Sem tela à vista, os itens deste passo vão para *O que não foi medido*.

## O peso

- **Alta:** alguém não consegue fazer a tarefa — gesto fora do teclado, controle sem nome, texto abaixo de 4,5:1, foco que some, erro que só a cor diz.
- **Média:** consegue, com custo — ordem do foco trocada, alvo abaixo de 24px com vizinho colado, desfecho não anunciado, título que pula nível.
- **Baixa:** o resto que fere a regra sem atrapalhar a tarefa hoje.

## A entrega (formato fixo)

```markdown
# Acessibilidade — <tela, componente ou app> (AAAA-MM-DD)
Nível: AA · Base: <versão> · Fonte: tela | código · Só leitura

## Resumo
Achados: <N> (alta <a> · média <m> · baixa <b>). <Uma frase: o que bloqueia mais gente.>

## Achados
| # | Peso | Regra · critério | Onde | O que se vê | Correção |
|---|---|---|---|---|---|
| 1 | alta | ACES-01 · 2.1.1 | `web/app/pedidos/linha.tsx:42` | `div` com `onClick` abre o pedido; o Tab passa direto | trocar pelo `Button variant="ghost"` do kit, com o nome do pedido no rótulo |

## Contraste
(a matriz do medir-contraste, nos dois temas, e as medidas fora dos tokens)

## Teclado
| Elemento | Chega no Tab? | Enter/Espaço | Esc | O foco volta para |
|---|---|---|---|---|

## Leitor de tela
| Elemento | Anunciado como | Problema |
|---|---|---|

## Observações
(zoom de 200%, critério sem regra na base, o que a peça do kit já resolve)

## O que não foi medido, e por quê
```

Termine com as três correções que destravam mais gente, na ordem. Ao chamar este trabalho a partir de uma crítica, o `critico-de-ui` usa as mesmas regras no eixo *aderência*; esta skill é a auditoria completa.

---
Adaptada de `accessibility-review`, do plugin `design` de [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) (Apache-2.0): reescrita em PT-BR, presa à base, com o alvo corrigido para o critério AA (2.5.8) e a medida de contraste pelos tokens. As buscas de ARIA e de campo obrigatório (ACES-06, ACES-07) vêm da `frontend-a11y` de [affaan-m/ECC](https://github.com/affaan-m/ECC) (MIT), reescritas contra as peças do kit. Atribuição em [`TERCEIROS.md`](../../TERCEIROS.md).
