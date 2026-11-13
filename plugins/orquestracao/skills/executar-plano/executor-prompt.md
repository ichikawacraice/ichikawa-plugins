# Molde do pedido ao executor

Use ao lançar `orquestracao:executor` para uma tarefa do plano. Troque o que está entre `<>`. Não passe `model`: o agente já roda em Sonnet; troque só ao relançar uma tarefa que travou por falta de raciocínio.

```
Agent(subagent_type: "orquestracao:executor", description: "Tarefa N: <nome>")

Você implementa a Tarefa N do plano `<docs/planos/AAAA-MM-DD-slug.md>`.

## A tarefa
Leia SÓ a seção "### Tarefa N" do plano, mais "Restrições globais" e
"Decisões assumidas". Ela é o seu requisito; os valores exatos estão lá.
Não leia as outras tarefas.

## Onde se encaixa
<uma linha: o que vem antes, o que depende disto>

## Do que veio antes
<interfaces e decisões de tarefas anteriores que o texto da tarefa não sabe;
"nada" se não houver>

## Ambiguidade resolvida
<sua decisão sobre qualquer ponto ambíguo que você notou; "nenhuma" se não houver>

## Pasta e branch
Trabalhe em `<caminho absoluto>`, branch `<branch>`. Não troque de branch,
não faça push, não faça rebase.

## Como trabalhar
1. Siga os passos na ordem, com TDD: escreva o teste, rode e VEJA FALHAR pelo
   motivo certo, implemente o mínimo, rode e veja passar.
2. Verificação: `<testes afetados>` e `<typecheck>`. Rode durante o trabalho só
   o teste do que está mudando; os dois comandos inteiros uma vez antes do commit.
   Não rode o gate completo.
3. Commit como o plano diz (conventional commits, assunto em PT-BR).
4. Releia o seu diff antes de relatar: fez tudo o que a tarefa pede? Só o que
   ela pede (YAGNI)? Seguiu o padrão da casa? Os testes afirmam comportamento,
   não o mock? Saída limpa, sem aviso? Achou algo, conserte antes de relatar.

## Não faça
- Não lance subagentes — nem ajudante, nem revisor. A revisão, quando houver,
  vem da sessão que te chamou.
- Não reestruture fora da tarefa. Arquivo crescendo além do que o plano prevê:
  pare e relate como FEITO_COM_RESSALVAS.
- Não adivinhe. Decisão de arquitetura com mais de um caminho válido, código
  que você não consegue entender lendo, ou incerteza sobre a abordagem: pare
  e relate TRAVADO ou PRECISA_DE_CONTEXTO. Trabalho ruim é pior que nenhum.

## Relato (até 15 linhas)
- **Estado:** FEITO | FEITO_COM_RESSALVAS | TRAVADO | PRECISA_DE_CONTEXTO
- Commits (hash curto + assunto)
- Vermelho: o comando e a linha da falha antes da implementação, e por que era a falha esperada
- Verde: o comando e o resumo (ex.: "14/14 passando, typecheck 0 erros")
- Arquivos mudados
- Ressalvas, se houver
Se TRAVADO ou PRECISA_DE_CONTEXTO: o que trava, o que tentou, o que precisa.
```
