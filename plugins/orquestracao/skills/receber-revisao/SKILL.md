---
name: receber-revisao
description: Como receber achados de revisão — do orquestracao:revisor, de comentário de PR ou do operador — com rigor técnico em vez de concordância encenada ou implementação cega: entender, conferir contra o código, avaliar, responder com fato ou contestar com motivo, implementar um por vez. Use ao receber qualquer revisão de código, sobretudo quando um achado parece confuso, errado para este projeto, ou pede "fazer direito" algo que talvez nem seja usado.
---

# Receber revisão

Revisão pede avaliação técnica, não encenação. **Confira antes de implementar. Pergunte antes de supor. Correção técnica acima de conforto social.**

## O padrão

1. **Ler** tudo, sem reagir.
2. **Entender:** reescreva o requisito com suas palavras — ou pergunte.
3. **Conferir** contra o código real.
4. **Avaliar:** está certo para ESTE projeto?
5. **Responder:** reconhecimento técnico, ou contestação com motivo.
6. **Implementar** um item por vez, testando cada um.

## Nada de encenação

Nunca: "Você tem toda razão!", "Ótimo ponto!", "Obrigado por pegar isso!", "Vou implementar agora" (antes de conferir). Em vez disso: diga o requisito técnico, pergunte o que falta, conteste com motivo — ou simplesmente conserte e mostre.

Achado correto: "Corrigido: <o que mudou> em <arquivo>." O código mostra que você ouviu.

Contestou e estava errado: "Conferi <X> e ele faz <Y>; você estava certo. Corrigindo." Sem desculpas longas, sem defender por que contestou.

## Item confuso: pare tudo

Se qualquer item não ficou claro, não implemente nenhum ainda — os itens podem estar ligados, e entendimento parcial vira implementação errada. "Entendi 1, 2, 3 e 6. Preciso de esclarecimento no 4 e no 5 antes de seguir."

## Pela origem

- **Do operador:** confiável — implemente depois de entender. Escopo incerto, pergunte. Sem concordância encenada.
- **Do `orquestracao:revisor` ou de revisor externo:** cético, mas conferindo com cuidado. Antes de implementar: está certo para este código? Quebra algo que existe? Há motivo para o jeito atual? Vale em todas as versões/plataformas do projeto? O revisor tem o contexto todo? Não dá para conferir? Diga: "Não consigo verificar isto sem <X>." e decida pelo risco.
- **Achado que contraria uma decisão do operador** (no desenho, no plano, num ADR): não implemente; leve a ele, inteiro — o achado, o que acontece se nada mudar, a sua recomendação.

## "Fazer direito" algo que talvez nem seja usado

Revisor sugere "implementar como se deve" (métricas com banco, filtros, exportação…)? Procure o uso real (`git grep`). Ninguém chama: "Nada chama este endpoint. Removo (YAGNI)?" Usado: aí sim, faça direito.

## Ordem de implementação

1. Esclareça o que não ficou claro.
2. Bloqueante (quebra, segurança) → simples (nome, import) → complexo (lógica, refatoração).
3. Cada correção com o seu teste (que falha antes e passa depois, `orquestracao:tdd`), rodando afetados + typecheck.
4. Confira que nada regrediu.

Severidade do revisor é conselho; o portão é seu. Crítico e Importante entram na correção. Menor vai ao relato como adiado e o operador decide — não corrija o que ninguém pediu.

## Quando contestar

Quando a sugestão quebra algo que funciona, o revisor não tem o contexto, viola YAGNI, está errada para esta stack, existe motivo de compatibilidade, ou contraria decisão de arquitetura do operador. Conteste com motivo técnico, perguntas específicas e o teste ou código que prova — nunca na defensiva. Desconforto de contestar não é motivo para não contestar: diga o problema que viu.

Achado que você decide não corrigir é uma decisão: registre `Decisão: <achado> — <por que o código fica> — <custo se errado>` no andamento do plano e no relato final.

## Comentário de PR no GitHub

Responda na thread do comentário (`gh api repos/{dono}/{repo}/pulls/{pr}/comments/{id}/replies`), não como comentário solto no PR.
