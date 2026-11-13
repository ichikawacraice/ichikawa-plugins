---
name: verificar-antes-de-concluir
description: Evidência antes da afirmação — nunca dizer que passou, funcionou, está pronto ou corrigido sem ter rodado o comando que prova, lido a saída e colado o trecho dela. Use ANTES de qualquer afirmação de sucesso ou conclusão, antes de commit, push, PR, de marcar tarefa como feita, de passar à próxima tarefa e de aceitar o relato de um subagente.
---

# Verificar antes de concluir

**Princípio:** evidência antes da afirmação, sempre.

```
NENHUMA AFIRMAÇÃO DE CONCLUSÃO SEM EVIDÊNCIA NOVA
```

Se você não rodou o comando de verificação nesta mensagem, não pode dizer que passa.

## O portão

Antes de afirmar qualquer estado ou mostrar satisfação:

1. **Qual comando prova isto?** Identifique.
2. **Rode** o comando inteiro, agora.
3. **Leia** a saída inteira, o código de saída, quantas falhas.
4. **A saída confirma?** Não → diga o estado real, com a evidência. Sim → afirme, com a evidência.
5. **Cole** o trecho que prova: as últimas linhas e o resultado (`14 passed`, `exit 0`, `Found 0 errors`). Resumo seu da saída não vale como saída.

Pulou um passo, não verificou — inventou.

## O que cada afirmação exige

| Afirmação | Exige | Não basta |
|---|---|---|
| Testes passam | saída do comando com 0 falhas | rodada anterior, "deve passar" |
| Typecheck limpo | saída do typecheck com 0 erros | o linter passou |
| Build funciona | build com exit 0 | linter, "os logs parecem ok" |
| Bug corrigido | o sintoma original testado, agora passa | o código mudou |
| Teste de regressão funciona | vermelho-verde visto: tira o conserto, falha; volta, passa | passou uma vez |
| Subagente concluiu | `git log`/`git diff` mostram a mudança, e você rodou os testes | o relato diz "sucesso" |
| Requisitos atendidos | lista linha a linha contra o plano | os testes passam |
| Tela funciona | a tela no ar, o gesto feito, o resultado visto | o teste de componente passou |

## Diga o tamanho exato do que foi verificado

Durante o trabalho roda-se **testes afetados + typecheck**, não o gate completo. Então a frase é "os testes afetados passaram (23/23) e o typecheck está limpo", nunca "a suíte passou". O gate completo é do release; não insinue que rodou o que não rodou. O que não foi verificado vai escrito no relato como não verificado.

Falha que você viu passar na tela e não é sua entra no relato pelo nome. Omitir um vermelho que você viu é falsificar o relato.

## Sinais de alerta — pare

- "deve", "provavelmente", "parece que"
- Satisfação antes de verificar ("Pronto!", "Perfeito!", "Funcionou!")
- Commit, push ou PR sem verificação
- Confiar no relato de um subagente
- Verificação parcial tratada como completa
- "Só desta vez", cansaço, vontade de terminar
- Qualquer frase que implique sucesso sem o comando rodado

| Desculpa | Realidade |
|---|---|
| "Agora deve funcionar" | Rode. |
| "Estou confiante" | Confiança não é evidência. |
| "O linter passou" | Linter não é compilador. |
| "O agente disse que deu certo" | Confira você. |
| "A checagem parcial basta" | Parcial não prova nada além dela mesma — e se for parcial, diga. |

## Quando

Antes de toda afirmação de sucesso, conclusão ou correção, em qualquer redação ou sinônimo; antes de commit, PR, marcar tarefa feita, passar à próxima tarefa ou entregar o trabalho a outro agente. Vale também para o que você relata ao operador numa pergunta: o "caso concreto" é o que você mediu, não o que supõe.
