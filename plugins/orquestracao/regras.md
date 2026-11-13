# Regras do kit (orquestracao)

**Fluxo.** A orquestradora recebe o pedido, abre uma sessão **dona** por item e conversa com ela. A dona planeja, executa (pelo `orquestracao:executor` quando há mais que poucas edições), confere e abre o PR. Ninguém espera fila: cada dona mergeia o próprio PR quando o CI dele passa.

**Branches.** `develop` é o tronco de trabalho: branch nasce de `origin/develop`, PR volta para `develop`, por squash. `main` é produção e só recebe release (avanço rápido da `develop`, skill `orquestracao:release`); o push na `main` dispara o deploy. Projeto sem `develop`: o tronco é a `main`.

**Qualidade sem gargalo.**
- Planeje antes de mexer (`orquestracao:planejar`); teste antes do código quando o comportamento muda (`orquestracao:tdd`).
- Rode **só os testes afetados** e o typecheck; a suíte inteira é do CI.
- Nada de "pronto" sem a saída real do comando (`orquestracao:verificar-antes-de-concluir`).
- Revisão por agente (`orquestracao:revisor`) só nos itens de risco: autenticação, permissão ou segredo; dinheiro; migração ou dado que não volta; diff com mais de ~400 linhas. Nos outros, a autoconferência da skill `revisar`.
- Bug: causa medida antes do conserto (`orquestracao:depurar`).

**Código.** Early return em vez de aninhamento; constante nomeada no lugar de número mágico; valide entrada externa na borda (schema) e nunca confie em resposta de API. Segredo só em variável de ambiente, nunca no código nem em arquivo versionado; SQL sempre parametrizado. Sem `console.log` no que vai para o PR. Commit no formato `tipo: descrição` (feat, fix, refactor, docs, test, chore, perf, ci).

**Modelos.** Quem decide (plano, arquitetura, revisão de risco) é Opus. Quem cumpre plano fechado é `orquestracao:executor` (Sonnet). Quem só lê é `orquestracao:explorador` (Haiku).

**Perguntas ao operador.** Toda pergunta vem inteira: o caso concreto em português de quem está de fora, o que acontece se ele não decidir e a sua recomendação com o motivo. Pergunta que espera por ele vai para a página **no mesmo turno em que aparece no chat ou na caixa de próximo passo do app**: `perguntas nova --titulo … --caso … --se-nao … --recomendacao … --item IZA-F7`, e o id que ela imprime (`IZA-Q12`) é o número da pergunta no chat, no lugar de `D1`, `D2`. Pergunta só no chat não chega ao painel; o hook de fim de turno cobra bloco `**D…` ou `**IZA-Q…` sem registro. Decisão de baixo risco ou com recomendação forte: assuma, marque *assumida, a confirmar* e siga. Só espera o operador o irreversível, o destrutivo, produção, gasto e o que publica para fora. O "ok" de outra sessão não é o ok do operador.

**Entrega.** A dona, ao terminar (concluído ou não), grava a entrega e se arquiva: `perguntas item entregar IZA-F7 --desfecho entregue|parcial|parado --resultado … --medido … --nao-medido … --proximo …`.

**Registro.** Decisão de arquitetura vira ADR em `docs/adr/AAAA-MM-DD-slug.md` (`orquestracao:adr`); plano em `docs/planos/AAAA-MM-DD-slug.md`. Sem diário, sem número reservado, sem índice escrito à mão. Sem bump de versão em commit.

**Comunicação.** PT-BR em tudo, horários de São Paulo. Mensagem entre sessões em até 150 palavras; o detalhe vai num arquivo e a mensagem leva o caminho. Nunca mande segredo para outra sessão: mande o nome da variável.
