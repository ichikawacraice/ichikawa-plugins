---
name: executar-plano
description: Executa um plano de docs/planos/ tarefa por tarefa — a sessão coordena em Opus e manda o código de cada tarefa ao subagente orquestracao:executor (Sonnet), confere testes afetados e typecheck, registra o andamento no próprio plano e só chama revisor nas tarefas de risco. Use quando houver um plano pronto para implementar, quando o operador disser "executa o plano", "pode fazer", "segue o plano", ou ao retomar um plano pela metade depois de compactar ou limpar o contexto.
---

# Executar o plano

A sessão principal **coordena**; o código de cada tarefa vai ao `orquestracao:executor`, um subagente novo por tarefa, com contexto limpo. Você fica com o plano, as decisões e a conferência — não com o diff inteiro de cada tarefa na memória.

**Princípio:** o plano já pensou. Execute-o à risca, prove cada tarefa com teste que você viu falhar e depois passar, e deixe registro que sobreviva ao seu próprio esquecimento.

**Execução contínua:** não pare entre tarefas para perguntar "posso seguir?". Narre no máximo uma linha curta entre chamadas.

**Decida, não trave.** Conflito, ambiguidade, defeito do plano: decida. O desenho/spec manda, o plano argumenta, e o seu julgamento resolve o que nenhum dos dois responde. Registre como `Decisão: <o que decidiu> — <por quê> — <custo se errado>` e siga.

**Só quatro coisas param você:** operação irreversível ou destrutiva; ação sensível de segurança; efeito fora da branch que se pergunta antes (merge na `main`, publicar, gastar); plano tão quebrado que todo caminho é chute. Aí pergunte inteiro: o caso em palavras de fora, o que acontece se ninguém decidir, a sua recomendação com o motivo. Enquanto espera, siga com as tarefas que não dependem da resposta.

## Preparo

1. **Branch a partir do tronco:** `git fetch origin && git switch -c <branch do plano> origin/develop` (sem `develop`, `origin/main`). Nunca implemente direto na `develop` nem na `main`. Worktree só se outra sessão usa a mesma pasta.
2. **Leia o plano uma vez** (e o `## Desenho`/spec que ele cita): restrições globais, foco de revisão, decisões assumidas. Uma tarefa na lista de tarefas da sessão por tarefa do plano.
3. **Retomada:** no fim do plano existe `## Andamento`? Tarefa com linha `Tarefa N: feita` está FEITA — os commits existem no `git log` mesmo que você não lembre. Confie no andamento e no `git log`, não na memória. Comece na primeira sem linha.
4. **Conflitos entre tarefas:** para cada tarefa que consome o que outra produz (blocos Interfaces), confira se batem. Não bate: decida pela spec, registre a `Decisão:`. Nada compartilhado: `Pré-voo: sem interfaces compartilhadas`.

O `## Andamento` é o seu diário de bordo, **no próprio plano**: uma linha por tarefa e uma por decisão, escrita na mesma rodada do commit, nunca numa chamada só para isso.

## Por tarefa

### 1. Mandar ao executor

Anote `BASE=$(git rev-parse HEAD)`. Lance `orquestracao:executor` com o molde de [executor-prompt.md](executor-prompt.md): onde a tarefa se encaixa (uma linha), o caminho do plano e **qual tarefa** (o executor lê só a dela), as interfaces e decisões de tarefas anteriores que o texto dela não conhece, a sua resolução de qualquer ambiguidade que notou, e os comandos de verificação.

- Não cole histórico de tarefas anteriores. Tarefa, interfaces que toca, restrições globais. Mais nada.
- **Nunca dois executores em paralelo na mesma árvore.** Tarefas independentes em arquivos disjuntos podem ir em paralelo só em worktrees separados (`orquestracao:paralelizar-agentes`).
- Tarefa de uma linha mecânica, ou correção pequena depois de uma revisão: pode fazer você mesmo — mandar custa mais que fazer.

### 2. Tratar o relato

O executor devolve um de quatro estados:

- **FEITO:** vá à conferência.
- **FEITO_COM_RESSALVAS:** leia a ressalva. Dúvida de correção ou escopo, resolva antes de conferir; observação ("arquivo ficou grande"), anote e siga.
- **PRECISA_DE_CONTEXTO:** dê o que falta e relance.
- **TRAVADO:** contexto falta → dê e relance; tarefa exige raciocínio → relance com modelo mais forte; tarefa grande demais → divida; plano errado → decida e registre, ou pare se cair nos quatro casos acima. Nunca relance igual esperando outro resultado.

### 3. Conferir (sempre, por você)

O relato do executor é alegação, não evidência (`orquestracao:verificar-antes-de-concluir`):

- `git log --oneline $BASE..HEAD` e `git diff --stat $BASE..HEAD`: os commits e arquivos são os que a tarefa previa?
- Rode **você** os testes afetados e o typecheck do plano. Leia a saída.
- O relato traz o vermelho visto antes do verde? Sem ele, o teste não provou nada (`orquestracao:tdd`).

### 4. Revisão — só se a tarefa tem risco

`Risco: sim` no plano (auth/permissão/segredo, dinheiro, migration ou dado que não volta, diff > ~400 linhas) → `orquestracao:revisar` com o intervalo `$BASE..HEAD` da tarefa. Achado Crítico ou Importante: mande o executor corrigir (com os achados, não a sua interpretação), confira de novo. Use `orquestracao:receber-revisao` para pesar cada achado.

Sem risco: a conferência do passo 3 basta. Não lance revisor "por garantia".

### 5. Registrar

Na mesma rodada, marque os checkboxes da tarefa e acrescente ao `## Andamento`:

`Tarefa N: feita (commits <base7>..<head7>, <comando> → <resultado>[, revisada])`

## Fim do plano

1. **Rode a verificação da branch:** testes afetados pela branch inteira (contra `origin/develop`) + typecheck. Cole a saída. Gate completo fica para o release.
2. **Revisão final, uma só:** a branch tem alguma tarefa de risco, ou o diff total passa de ~400 linhas de código → `orquestracao:revisar` no `git diff origin/develop...HEAD` com o plano. Senão, o roteiro de autorrevisão da mesma skill.
3. **Achados:** Crítico e Importante numa só rodada de correção, cada um com teste que falha antes e passa depois. Menor vai ao `## Andamento` como `Menor (adiado): …` e ao relato final — não corrija sem o operador pedir.
4. **Relato ao operador:** o que foi feito; todas as linhas `Decisão:`, em ordem, com o custo se errado; os menores adiados; o que não foi verificado.
5. `orquestracao:entregar-branch`.

## Racionalizações

| Desculpa | Realidade |
|---|---|
| "Lembro o que a Tarefa N diz" | Lembra um resumo. O plano tem os valores exatos. |
| "O executor disse que passou" | Rode você. Relato não é evidência. |
| "Vou revisar tudo, por garantia" | Revisão é para risco. Fora dele, conferência + autorrevisão. |
| "O plano está errado aqui, faço o certo e pronto" | Faça o certo **e registre a decisão**. Desvio sem registro é decisão escondida. |
| "Escrevo o andamento depois de umas tarefas" | Compactação não espera. Uma linha por tarefa, junto do commit. |
| "Corrijo os menores já que estou aqui" | Cada menor é teste, código e rodada que ninguém pediu. Registre; o operador decide. |
