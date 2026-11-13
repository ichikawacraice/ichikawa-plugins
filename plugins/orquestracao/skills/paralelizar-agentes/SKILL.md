---
name: paralelizar-agentes
description: Lança vários subagentes ao mesmo tempo quando há dois ou mais problemas independentes — falhas em subsistemas diferentes, leituras amplas em áreas separadas, tarefas do plano em arquivos disjuntos — com um pedido focado e autossuficiente para cada um, e depois integra e confere. Use diante de várias falhas sem relação entre si, de uma pesquisa que cobre várias partes do código, ou quando o operador disser "faz em paralelo", "manda uns agentes". Não use quando os problemas se ligam ou disputam os mesmos arquivos.
---

# Paralelizar agentes

Subagente trabalha com contexto isolado. Você monta exatamente o que ele precisa, ele não herda a sua conversa, e o seu contexto fica livre para coordenar. Problemas independentes investigados um depois do outro desperdiçam tempo: **um agente por domínio independente, todos lançados de uma vez.**

## Quando

1. Há vários problemas? Não → um agente (ou você).
2. São independentes — entender um não exige o outro, consertar um não conserta o outro? Não → um agente investiga todos juntos.
3. Podem rodar sem disputar estado — arquivos, banco local, porta, servidor? Não → em sequência.
4. Sim aos três → paralelo.

**Não use** quando as falhas se ligam (conserta uma, somem as outras), quando é preciso ver o sistema inteiro, em depuração exploratória (ainda não se sabe o que quebrou), ou quando os agentes editariam os mesmos arquivos.

## Qual agente

| Trabalho | Agente | Por quê |
|---|---|---|
| Ler muito e devolver a conclusão (onde está X, como Y funciona, quem usa Z) | `orquestracao:explorador` (Haiku) | Só lê; barato |
| Código de uma tarefa de plano fechado | `orquestracao:executor` (Sonnet) | Cumpre o que já foi decidido |
| Revisão de item de risco | `orquestracao:revisor` | Ver `orquestracao:revisar` |
| Decidir, desenhar, julgar | você, em Opus | Quem decide não delega a decisão |

Agentes que gravam em paralelo dividem a **mesma pasta** quando os arquivos de cada um são disjuntos e declarados, nenhum commita e nenhum roda typecheck, lint ou formatador do projeto inteiro (é assim que o `orquestracao:executar-plano` roda as ondas). Se dividem arquivo, dependência, lockfile ou arquivo gerado, vão em sequência ou cada um na **árvore própria** (`isolation: "worktree"`). Depois, as branches dos worktrees se juntam na sua, uma por vez, conferindo cada uma.

## Como

1. **Agrupe por domínio:** o que está quebrado em cada área (ex.: abortar ferramenta · conclusão de lote · aprovação concorrente).
2. **Um pedido por agente,** com:
   - **escopo:** um arquivo de teste, um subsistema, uma pergunta;
   - **objetivo:** "faça estes testes passarem", "diga onde e como X é decidido";
   - **contexto colado:** as mensagens de erro, os nomes dos testes, os caminhos — ele não sabe nada além disso;
   - **restrições:** "não mexa em código de produção", "só leitura", "não aumente timeout";
   - **saída:** o que devolver e em quantas linhas (ex.: "causa raiz e o que mudou, até 15 linhas").
3. **Lance todos na mesma mensagem.** Várias chamadas numa resposta = paralelo; uma por resposta = sequência.
4. **Enquanto rodam,** siga com o que não depende deles. Não fique sondando.

```
Conserte os 3 testes falhando em src/agentes/abortar-ferramenta.test.ts:
1. "aborta com captura parcial" — espera 'interrompido em' na mensagem
2. "mistura concluídas e abortadas" — a ferramenta rápida é abortada em vez de concluída
3. "conta pendentes" — espera 3 resultados, recebe 0
Parecem problemas de tempo. Ache a causa: tempo ou defeito real?
Troque espera fixa por espera pelo evento; não só aumente o timeout.
Devolva: a causa e o que mudou, até 15 linhas.
```

## Erros comuns

- **Amplo demais** ("conserte todos os testes") → o agente se perde. Um arquivo, um subsistema.
- **Sem contexto** ("conserte a corrida") → ele não sabe onde. Cole erro e nomes.
- **Sem restrição** → ele refatora tudo. Diga o que não tocar.
- **Saída vaga** ("conserte") → você não sabe o que mudou. Peça o resumo.
- **Modelo implícito** → os agentes acima já têm modelo; agente genérico sem `model` herda o da sessão, o mais caro.

## Quando voltam

1. Leia cada resumo.
2. Algum mexeu no mesmo código que outro? Conflito se resolve antes de seguir.
3. Rode **você** os testes afetados e o typecheck do conjunto (`orquestracao:verificar-antes-de-concluir`) — relato de agente é alegação.
4. Confira por amostra: agentes erram de forma sistemática.
