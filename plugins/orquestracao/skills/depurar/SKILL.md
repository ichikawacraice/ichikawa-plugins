---
name: depurar
description: Depuração sistemática — achar a causa raiz antes de propor qualquer conserto, em quatro fases (investigar, comparar com o que funciona, hipótese testada uma por vez, conserto com teste que reproduz). Use diante de QUALQUER bug, teste falhando, build quebrado, comportamento inesperado, lentidão ou erro de integração, ANTES de mexer no código — sobretudo com pressa, quando "o conserto é óbvio", ou quando um conserto já falhou.
---

# Depurar

Conserto de sintoma é fracasso. Achar a causa raiz é mais rápido que tentar e errar, inclusive em bug "simples" e inclusive com pressa.

```
NENHUM CONSERTO SEM INVESTIGAR A CAUSA RAIZ ANTES
```

Sem a Fase 1 completa, você não propõe conserto.

## Fase 1 — Investigar a causa

1. **Leia o erro inteiro.** Stack trace completo, linha, arquivo, código de erro. Aviso também. O erro muitas vezes já diz a resposta.
2. **Reproduza.** Dá para provocar sempre? Quais os passos exatos? Não reproduz → junte mais dado, não chute.
3. **O que mudou?** `git log`, `git diff origin/develop...HEAD`, dependência nova, config, ambiente.
4. **Sistema de várias camadas** (CI → build → assinatura; API → serviço → banco): antes de propor conserto, instrumente cada fronteira — o que entra, o que sai, se a config/variável chegou — e rode uma vez para ver **onde** quebra. Só então investigue aquela camada.
5. **Rastreie para trás.** O erro aparece fundo na pilha? Pergunte: quem chamou isto com esse valor? E quem chamou esse? Suba até achar a origem do valor ruim e conserte **lá**, não onde explodiu. Sem como subir a pilha lendo, ponha um log com `new Error().stack` logo antes da operação que falha.

## Fase 2 — Comparar com o que funciona

- Ache código parecido no mesmo projeto que funciona.
- Seguindo um padrão ou referência? Leia a referência **inteira**, não por cima.
- Liste toda diferença entre o que funciona e o que quebra, por menor que seja. Não assuma "isso não pode importar".
- Quais dependências, configs e premissas o trecho tem?

## Fase 3 — Hipótese e teste

1. **Uma hipótese, escrita:** "acho que X é a causa porque Y". Específica.
2. **Teste com a menor mudança possível,** uma variável por vez.
3. Funcionou → Fase 4. Não funcionou → hipótese **nova**, sem empilhar outro conserto em cima.
4. **Não sabe?** Diga "não entendo X". Não finja. Pesquise mais ou pergunte.

## Fase 4 — Consertar

1. **Teste que reproduz, antes do conserto:** o menor caso possível, automatizado se der (`orquestracao:tdd`). Veja falhar pelo motivo do defeito.
2. **Um conserto, na causa.** Sem "já que estou aqui", sem refatoração junto.
3. **Confira:** o teste passa, os afetados e o typecheck continuam verdes, o sintoma original sumiu (`orquestracao:verificar-antes-de-concluir`).
4. **Depois da causa, defesa em profundidade** quando o valor ruim atravessa camadas: validar na entrada, na regra de negócio e na guarda do ambiente torna o bug estruturalmente impossível, não só corrigido.

### Três consertos falharam? Pare.

Conte as tentativas. Menos de três: volte à Fase 1 com o que aprendeu. **Três ou mais:** o problema é de arquitetura, não de hipótese. Sinais: cada conserto revela estado compartilhado ou acoplamento em outro lugar; o conserto pede refatoração grande; cada conserto cria sintoma novo. Pare e leve ao operador, inteiro: o que foi tentado, o que cada tentativa revelou, o que acontece se seguir remendando, e a sua recomendação (manter o padrão e o custo disso, ou refazer a parte e o tamanho disso).

## Esperar por condição, não por relógio

Teste instável com `sleep`/`setTimeout` de palpite é a causa clássica. Espere pela condição que você quer de fato (`waitFor(() => evento chegou)`, `findBy…`, sondagem com prazo e mensagem clara no estouro). Tempo fixo só quando o que se testa é o tempo (debounce, intervalo), e aí documente por quê.

## Teste que polui o estado

Um arquivo ou pasta aparece e você não sabe qual teste o cria: rode os testes um a um e confira o artefato depois de cada (bisseção), em vez de ler todos.

## Sinais de que está errando — volte à Fase 1

- "Conserto rápido agora, investigo depois"
- "Vou mudar X e ver se resolve"
- "Mudo várias coisas e rodo os testes"
- "Pulo o teste, confiro na mão"
- "Deve ser X, vou consertar"
- "Não entendi direito, mas isso talvez funcione"
- Lista de consertos sem investigação
- "Mais uma tentativa" depois de duas
- O operador pergunta "isso não está acontecendo?", "vai mostrar…?", "para de chutar", "estamos travados?" — você assumiu sem verificar

## Quando não há causa raiz

Se a investigação mostrar que é mesmo do ambiente, de tempo ou externo: documente o que investigou, trate de forma adequada (nova tentativa com limite, prazo, mensagem de erro clara) e acrescente log para a próxima vez. Mas 95% dos "não tem causa" são investigação incompleta.
