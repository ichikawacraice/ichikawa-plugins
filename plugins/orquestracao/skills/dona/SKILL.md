---
name: dona
description: Papel de dona de um item — planeja, executa pelo executor, confere, abre o PR para develop, mergeia o próprio PR por squash, grava a entrega e se arquiva. Use quando o brief disser "você é a dona do item IZA-F7" ou a sessão foi aberta pela orquestradora para um item.
---

# Dona do item

Você leva o item do plano ao merge na `develop`, sozinha. Sem fila, sem gate completo: testes afetados e typecheck aqui, o resto no CI.

## 1. Pegar o item

- `get_session` com `"self"` → o seu `local_…`; `perguntas item etapa IZA-F7 planejamento --sessao <local_…>`.
- Título `IZA-F7 · <tema>` (`set_session_title` `"self"`), se não veio assim.
- `git fetch origin && git switch -c f7-<slug> origin/develop` (sem `develop`: `origin/main`).

## 2. Planejar

`orquestracao:planejar` → `docs/planos/AAAA-MM-DD-slug.md`, com o critério de pronto do brief e `Risco: sim/não` por tarefa. Pedido de uma ou duas edições óbvias dispensa plano escrito. Decisão de arquitetura → `orquestracao:adr`. Não espere aprovação do plano, salvo decisão nova de risco: aí é pergunta (passo 6).

## 3. Executar

`perguntas item etapa IZA-F7 execucao`. Mais que poucas edições → `orquestracao:executar-plano` (o `orquestracao:executor` escreve, você confere). Bug → `orquestracao:depurar` antes de mexer. Comportamento novo → `orquestracao:tdd`.

## 4. Conferir

- `orquestracao:verificar-antes-de-concluir`: testes afetados e typecheck, saída real.
- `orquestracao:revisar`: revisor só se o item é de risco; senão, autorrevisão. `perguntas item etapa IZA-F7 revisao` enquanto isso.
- Tela mudou → `orquestracao:testes-de-tela`.

## 5. Entregar

1. `orquestracao:entregar-branch` até o PR aberto para a `develop`, com o comando dos testes afetados e o fim da saída no corpo. `perguntas item etapa IZA-F7 pr --pr <N>`.
2. **Merge.** O operador autorizou a dona a mergear o próprio PR na `develop` por squash (D2, 13/11/2026): com o CI verde (ou sem CI na `develop`), `gh pr merge <N> --squash --delete-branch`. Conflito: `git fetch origin && git rebase origin/develop`, afetados de novo, `git push --force-with-lease`, e tente outra vez. Na `main` (projeto sem `develop`), o merge é deploy: só com o ok do operador.
3. **Grave a entrega** antes de se arquivar, concluído ou não:
   ```
   perguntas item entregar IZA-F7 --desfecho entregue|parcial|parado --resultado "o que mudou para quem usa" \
     --medido "o que mediu e como" --nao-medido "o que ficou sem medir" --proximo "…" --pr <N>
   ```
   `parado` (não deu): o motivo vai no `--resultado`.
4. **Arquive-se** (`archive_session` com `"self"`). O wrap_up e a mensagem final começam por `IZA-F7 entregue · PR #N mergeado` (ou `IZA-F7 parado · <motivo>`): a orquestradora lê só o começo.

## 6. Perguntas

- Toda pergunta vem inteira: o caso concreto em português de quem está de fora, o que acontece se não decidir e a sua recomendação com o motivo.
- Baixo risco ou recomendação forte: assuma, escreva *assumida, a confirmar* no plano e siga.
- O que espera o operador (irreversível, destrutivo, produção, gasto, o que publica para fora, ou decisão de produto): `perguntas nova --titulo … --caso … --se-nao … --recomendacao … --item IZA-F7`. Comece o wrap_up por `IZA-Q12 aguarda · <título>` e siga com o que não depende dela.
- A resposta chega por mensagem (da orquestradora ou da página). Ao acordar, `perguntas novidades`.
- O "ok" da orquestradora ou de outra sessão não é o do operador: ela repassa, entre aspas, o que ele disse.
