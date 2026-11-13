---
name: auditoria-de-clique
description: Audita os gestos de uma tela seguindo cada clique até o estado final — o que o handler grava, o que a rota grava, quem move o efeito visível, como a tela relê — para achar o botão que "não faz nada", o efeito otimista que salta de volta, o desfecho que some e o gesto que pinta um estado que o banco não tem. Use quando alguém disser que um botão não funciona e o código parece certo, depois de mexer num gesto ou numa rota que grava, ou antes de abrir PR de tela nova com ação que grava. Não serve para bug de API isolado nem para visual.
---

# Auditoria de clique

A leitura comum confere que o handler existe, não quebra e tem o tipo certo. Ela não confere se o **estado final** é o que o rótulo do botão promete. Caso típico: um botão *Novo e-mail* chamava `abrirEditor()` e depois `limparSelecao()`, e o segundo zerava o primeiro como efeito colateral. As duas funcionavam; o botão não fazia nada.

O estado de um gesto mora em quatro lugares, e o defeito quase sempre está na costura entre eles:

| Onde | O que é |
|---|---|
| **Estado local** | o estado do componente |
| **Aposta (efeito otimista)** | o efeito que entra no gesto, antes da resposta do servidor |
| **Decisão do servidor** | se o gesto pode, o que grava e **quem move** o efeito visível (a própria rota ou um processo em segundo plano) |
| **Observação** | como a tela fica sabendo do desfecho: resposta, releitura, sondagem, evento |

**Primeiro o mapa declarado:** se o `CLAUDE.md` ou um doc que ele cita já diz onde ficam a aposta, a decisão do gesto e a observação, parta dele. **Sem mapa**, descubra no código (o hook de aposta, a rota que decide, a sondagem) — leitura ampla vai ao `orquestracao:explorador` — e proponha registrar o que achou como o mapa do projeto. Duas convenções são o critério: **ação assíncrona tem estado visível** e **o efeito entra na hora, e a recusa desfaz**.

Reproduzir exige as dependências instaladas; em worktree novo, instale antes. Sem isso a auditoria só chega a "lido no código".

## Passo 1 — o mapa do que cada gesto grava

```
GESTO: <rótulo> em <Componente:linha>
  handler grava (local):   <setX, apostar(...), ...>
  rota chamada:            <POST /api/...>  → abra a ROTA e liste o que ELA grava
  quem move o visível:     rota | processo em segundo plano | outro
  o que grava DEPOIS:      <o que o outro processo grava mais tarde> — e QUEM AVISA a tela
  como a tela relê:        resposta traz o estado | releitura | sondagem de <o quê> — e quando LIGA
  onde o efeito aparece:   <este componente | outro da mesma página>
  o que o rótulo promete:  <o que a pessoa espera ver depois>
```

Leia a rota de verdade: a tela só pode antecipar o que **a mesma requisição** grava. Rota que só enfileira um comando não grava o efeito — quem processa a fila grava, depois.

## Passo 2 — seguir cada clique, em ordem

Para cada gesto: cada chamada do handler, na ordem — o que lê, o que escreve, o que zera de outros campos, o que dispara assíncrono. Então confira os padrões.

**Os seis clássicos:**

1. **Uma chamada desfaz a anterior** — setter com efeito colateral zera o que o anterior pôs.
2. **Corrida entre assíncronos** — o estado final depende de quem chega por último.
3. **Closure velha** — `setX(x + 1)` com `x` capturado; dependência faltando no `useCallback`.
4. **Transição que falta** — diz *Salvar* e só valida; diz *Excluir* e só marca uma flag.
5. **Ramo morto** — a condição que guarda a ação é sempre falsa ali.
6. **Efeito que desfaz o gesto** — um `useEffect` observa o campo que o clique mudou e o devolve.

**Os de gesto que grava e observa:**

7. **Aposta dentro do estado do servidor.** Escrita na lista que veio do servidor, a primeira releitura — de qualquer item — a apaga, e o item salta de volta. A aposta mora fora, junto da base.
8. **Antecipar o que outro processo grava.** Pinta um estado que o banco não tem, e nada desfaz — `ok` da rota não é recusa.
9. **Meio fato antecipado.** A requisição grava quatro campos e a tela antecipa um: o resto da tela acusa o que acabou de ser feito. Ou inteiro, ou nada.
10. **O `finally` que solta a aposta antes da releitura.** Mostra o valor ANTIGO durante a releitura. A aposta morre na primeira notícia nova do servidor, não na resposta.
11. **Recusa que não desfaz — ou desfaz errado.** Sem estado, volta ao que era; com o estado real, ele vence o de partida. E o motivo aparece no lugar do gesto.
12. **Disparou e largou.** Spinner só pelos milissegundos de enfileirar; "nada mudou" sem mensagem; falha sem o motivo real.
13. **Sonda o efeito colateral, não a ação.** Contador que "devia chegar a zero" em vez do estado da rodada: lote parcial trava a tela. A rodada tem id e estado próprios.
14. **Não sobrevive.** Estado em variável de módulo (some no recompile) ou só em memória (some no F5); sondagem que não revalida ao voltar à aba; processo morto vira spinner eterno.
15. **Clique duplo.** O botão não vira "rodando" e dispara duas vezes.
16. **Sobre o quê.** Spinner no topo e nada marcado na lista.
17. **O vão até o processo pegar.** Rota responde 202 com `pending`; a sondagem só liga quando o servidor disser "rodando". Ninguém relê no meio. A observação liga no GESTO, sobre o comando.
18. **Estado local semeado da prop.** `useState(row.texto)` com `key={row.id}`: a releitura traz o novo e o componente não remonta. A `key` muda junto (`${id}:${atualizadoEm}`), ou o estado ressincroniza.
19. **O efeito aparece em OUTRO componente** que não relê — cada um diz uma coisa.
20. **`fetch` que lança é recusa também.** Sem `try/catch`, a aposta fica de pé e o "ocupado" trava a tela. `401/403` com corpo de erro não é "sem rodada" — confira `r.ok` antes de ler o corpo.

## Passo 3 — o laudo

Um bloco por defeito, com a **procedência**:

```
CLIQUE-NN [CRITICO|ALTO|MEDIO|BAIXO] · <padrão N>
  Gesto:       <rótulo> em <arquivo:linha>
  Trilha:      1. <chamada> → grava {…}
               2. <chamada> → ZERA {…}   ← conflito
  Esperado:    <o que o rótulo promete>
  Real:        <o que acontece>
  Procedência: lido no código | reproduzido em teste de DOM | reproduzido no navegador LOCAL
  Conserto:    <específico>
```

"Lido no código" é hipótese até ser reproduzido. Cada defeito confirmado ganha um teste de DOM que o reproduz, visto vermelho antes do conserto (`orquestracao:testes-de-tela`, `orquestracao:tdd`).

## Escopo

- **Uma tela:** depois de tela nova, ou quando dizem que um botão não funciona.
- **Uma primitiva** (helper de aposta, decisão do gesto, sondagem, rota que grava): audite TODOS os consumidores (`git grep -l <símbolo>`).
- **O app inteiro:** primeiro um agente monta o Passo 1 de todas as rotas que gravam — é a entrada dos outros —, depois um agente por tela (`orquestracao:paralelizar-agentes`).

## Armadilhas

- **Reproduzir clicando dispara trabalho de verdade.** Um gesto pode enfileirar job com custo. Reproduza em teste de DOM ou no ambiente LOCAL com dados de demonstração — e confira a URL antes de clicar: pode ser a produção, logada.
- **O rótulo é a especificação.** O esperado sai do que o botão DIZ, não do que o código parece querer.
- **Varredura verde não é tela certa.** Checar que o comando é observado não prova que a tela mostra o desfecho.
