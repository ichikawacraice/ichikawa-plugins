---
name: revisar
description: Decide se uma mudança precisa de revisão por subagente e conduz a revisão — o orquestracao:revisor com o plano e o git diff origin/develop...HEAD só para item de risco (auth/permissão/segredo, dinheiro, migration ou dado que não volta, diff acima de ~400 linhas de código), e o roteiro curto de autorrevisão para todo o resto. Use ao terminar uma tarefa de risco do plano, ao terminar a branch antes do PR, quando o operador pedir "revisa", "revisa antes do PR", "dá uma olhada no diff", ou quando estiver travado e quiser olhos novos.
---

# Revisar

Revisão por subagente custa um contexto novo inteiro e tempo. Ela se paga onde o erro custa caro; fora disso, a autorrevisão com roteiro e os testes bastam.

## Quando chamar o revisor

Chame o `orquestracao:revisor` se **qualquer** destes vale para o diff:

- **Auth, permissão ou segredo:** login, sessão, papel, RLS, política de acesso, token, chave, variável de ambiente sensível.
- **Dinheiro:** preço, cobrança, pagamento, estorno, saldo, nota fiscal.
- **Migration ou dado que não volta:** schema, backfill, `delete`/`update` em massa, envio de e-mail/mensagem, chamada a sistema externo que grava.
- **Diff grande:** mais de ~400 linhas de código (sem contar lockfile, gerado, snapshot e teste) — `git diff --shortstat origin/develop...HEAD -- . ':!*.lock' ':!*lock.json'`.

Opcionais: travado e querendo olhos novos; o operador pediu.

Nenhum vale → autorrevisão (abaixo). Não chame revisor "por garantia".

## Como lançar o revisor

1. `git fetch origin` e salve o diff num arquivo, para não passar pelo seu contexto:
   ```bash
   BASE=origin/develop   # sem develop: origin/main; numa tarefa só: o BASE anotado antes dela
   git log --oneline $BASE..HEAD > "$SCRATCH/revisao.diff"
   git diff --stat $BASE...HEAD >> "$SCRATCH/revisao.diff"
   git diff -U10 $BASE...HEAD >> "$SCRATCH/revisao.diff"
   ```
   (`$SCRATCH` = a pasta temporária da sessão.)
2. Lance, sem colar o histórico da sessão:
   ```
   Agent(subagent_type: "orquestracao:revisor", description: "Revisar <tema>")

   Revise a mudança descrita abaixo. Só leitura: não mude a árvore, o índice nem a branch.
   - O que foi feito: <2–3 linhas>
   - Plano/desenho: <docs/planos/AAAA-MM-DD-slug.md> (tarefa N, se for uma tarefa só)
   - Diff: <caminho do arquivo> — commits, stat e diff com contexto
   - Por que é risco: <qual dos critérios>
   - Foco de revisão do plano: <cole a seção, se houver>
   - Decisões que tomei: <as linhas `Decisão:` do andamento>
   Confira: aderência ao plano; correção (bordas, erro, concorrência); o risco
   nomeado acima com atenção dobrada; testes que afirmam comportamento real.
   Para o que o plano não diz, julgue pelo que uma pessoa razoável usando o
   software esperaria. Liste também o que você considerou e deixou de fora, com o motivo.
   Devolva: achados com arquivo:linha, severidade (Crítico | Importante | Menor),
   o que quebra e o conserto; e o veredito (pode seguir | corrigir antes).
   ```
3. Não prejulgue: nunca escreva "não aponte X" ou "isso é no máximo Menor". Se achar que um achado será falso, deixe vir e pese depois.

## Agir sobre os achados

Use `orquestracao:receber-revisao`. Em resumo: reavalie a severidade pelo efeito em quem usa (não pelo silêncio do plano); **Crítico e Importante** numa só rodada de correção, cada um com teste que falha antes e passa depois; **Menor** vai ao relato como adiado. Achado que você decide não corrigir vira `Decisão:` no andamento, com o custo se errado. Sem segunda revisão para conferir correções: o teste vermelho→verde e os afetados verdes já respondem.

## Autorrevisão (todo o resto)

Leia o seu próprio `git diff origin/develop...HEAD` com este roteiro, de uma vez:

1. **Faz o que o plano pede?** Cada requisito tem código e teste. Nada a mais (YAGNI).
2. **Borda e erro:** entrada vazia, nula, repetida, enorme; falha de rede; resposta fora de ordem. Erro tratado com mensagem útil, nunca engolido em silêncio.
3. **Testes:** cada um foi visto falhar? Afirma comportamento, não mock?
4. **Segredo e entrada:** nada de chave, token ou senha no código ou no log; entrada externa validada na fronteira.
5. **Sobras:** `console.log`, código comentado, TODO sem dono, import morto, arquivo de rascunho.
6. **Convenções do `CLAUDE.md` do projeto:** nomes, pastas, texto de UI, padrão da casa.
7. **Escapou para o risco?** A mudança acabou tocando auth, dinheiro, migration ou passou de ~400 linhas? Então chame o revisor.

Achou algo, conserte e rode afetados + typecheck. Registre no andamento: `Autorrevisão: <n> ajustes` ou `Autorrevisão: limpa`.
