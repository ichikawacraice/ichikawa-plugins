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

## Em onda (só quando a tarefa sai junto com outras)
Outras executoras trabalham AGORA nesta mesma pasta, em outros arquivos.
- Toque só em: <lista exata dos Arquivos: da tarefa>. Precisa de outro arquivo:
  pare e relate PRECISA_DE_CONTEXTO.
- Rode só os seus testes: `<testes da tarefa>`. Não rode typecheck, lint nem
  formatador do projeto inteiro, nem instale dependência: eles veem o trabalho
  pela metade das outras. Erro em arquivo que não é seu: ignore e cite no relato.

## Como trabalhar
1. Siga os passos na ordem, com TDD: escreva o teste, rode e VEJA FALHAR pelo
   motivo certo, implemente o mínimo, rode e veja passar.
2. Verificação: `<testes afetados>` e `<typecheck>` (em onda, só os seus testes).
   Rode durante o trabalho só o teste do que está mudando; os comandos inteiros
   uma vez no fim. Não rode o gate completo.
3. Não commite: quem te lançou confere e commita.
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
- Vermelho: o comando e a linha da falha antes da implementação, e por que era a falha esperada
- Verde: o comando e o resumo (ex.: "14/14 passando, typecheck 0 erros")
- Arquivos mudados
- Ressalvas, se houver
Se TRAVADO ou PRECISA_DE_CONTEXTO: o que trava, o que tentou, o que precisa.
```
