---
name: entrevistar
description: Entrevista o operador sem pressa até o plano ou o desenho ficar sem ponto cego — percorre a árvore de decisões, rodada por rodada, cada pergunta no formato do kit (caso concreto, o que acontece se não decidir, recomendação, número D#). Use quando o operador disser "me entrevista", "me questiona", "testa esse plano", "grill me", ou quando uma ideia grande ainda tem muitas decisões soltas. Para perguntas pontuais no meio do trabalho não precisa; para desenhar antes de planejar, orquestracao:brainstorming.
---

# Entrevistar

Método de entrevista de `grilling`, de Matt Pocock ([mattpocock/skills](https://github.com/mattpocock/skills), MIT, licença conferida no repositório), adaptado ao formato de pergunta do kit.

## O método

**A árvore de decisões.** Toda decisão abre outras que dependem dela. A **fronteira** é o conjunto de decisões cujos pré-requisitos já estão resolvidos: o que se pode perguntar agora sem adivinhar o que ainda não foi respondido.

1. Antes de perguntar, **procure o que o código, os docs e o histórico já respondem** (use o `orquestracao:explorador` se for muita leitura). Fato do ambiente é trabalho seu; o operador só decide o que é decisão. Não bloqueie a rodada por isso: pergunte o resto da fronteira e deixe a dependente do fato para a rodada seguinte.
2. **Uma rodada = a fronteira inteira**, numerada. Cada pergunta, completa:
   - `D1 · <título>`
   - **O caso:** a situação concreta que gerou a pergunta, em português de quem está de fora, termo técnico traduzido;
   - **Se não decidir:** o que acontece (nada muda, atrasa, assume o padrão);
   - **Recomendo:** a resposta que você escolheria e o motivo. Redija a pergunta de modo que um "sim" aceite a sua recomendação.
3. **Espere as respostas.** Cada resposta empurra a fronteira: recalcule, derrube o que ficou irrelevante, abra o que destravou. Pergunta que depende de outra ainda aberta fica para a rodada seguinte.
4. Os números `D#` seguem na conversa inteira; pergunta reenviada mantém o número.
5. Pergunta de baixo risco, com recomendação forte, **não vira pergunta**: assuma, marque *assumida, a confirmar* e siga. Só pergunte o que muda o trabalho: o irreversível, o destrutivo, produção, gasto e o que publica para fora.

## O fim

A entrevista acaba quando a fronteira está vazia: todo ramo visitado, nada decidido em silêncio. Então devolva o resumo:
- **Decidido** (D#, resposta);
- **Assumido, a confirmar** (com o motivo);
- **Em aberto** que depende de fato ainda desconhecido.

**Não aja sobre o plano** antes de o operador confirmar que o entendimento é comum. Confirmado, o desenho segue para `orquestracao:brainstorming` ou `orquestracao:planejar`. Se o operador estiver ausente, registre as perguntas abertas pela página (`perguntas nova`) em vez de esperar no chat.
