---
name: brainstorming
description: Desenha o que vai ser construído antes do plano — descobre o que o operador quer e por quê, lê o projeto antes de perguntar, põe na mesa duas ou três abordagens com a recomendada e grava o desenho aprovado no topo do plano. Use ANTES de qualquer trabalho criativo — feature nova, componente, mudança de comportamento, "quero que…", "e se a gente…", "pensa comigo", "como você faria" — e sempre que o pedido deixar em aberto algo que mudaria o que se constrói. Não use quando tudo o que importa já está no pedido (aí faça e diga o que fez).
---

# Brainstorming

Você constrói bem. Constrói o que acha que o operador quer, e essa crença costuma ser mais fina do que parece. Esta skill existe para descobrir o que ele quer de fato, e por quê, antes de construir. Quem entende o porquê toma as cem decisões que ninguém mencionou do jeito que ele tomaria.

## Primeiro: o que você já sabe?

- **Tudo o que importa está no pedido** ("deixa o ícone azul-centáurea"): faça, e diga o que fez. Esta skill termina aqui.
- **Falta algo que muda o que se constrói:** comece a conversa.

O pedido do operador é ponto de partida, não premissa: confira contra o código, o banco e os docs, e diga onde ele errou ou onde existe caminho melhor que o pedido.

## Leia antes de perguntar

Em projeto existente, ou com contexto dado (spec, plano, arquivos apontados, conversa anterior), leia antes da primeira mensagem — o que foi citado e o código que ele toca — até saber explicar como as partes funcionam hoje e o que a mudança mexe. Leitura ampla (muitas pastas, convenções de nome) vai ao `orquestracao:explorador`; você fica com a conclusão. Nunca pergunte o que o projeto já responde nem reabra o que o operador já decidiu.

## A primeira mensagem

- **Ele já disse o que quer** (spec, plano, pedido detalhado): ~200 palavras. Devolva o pedido com suas palavras (o quê, para quem, por quê, até onde ele disse), o que achou no projeto que pesa nisso e, se houver, a restrição, o conflito ou o caminho mais barato que ele talvez não viu. Termine com uma linha convidando correção e:
  - se ele não disse **por que** quer: uma pergunta aberta, nos termos dele, sem opções;
  - se disse, e algo em aberto mudaria o que se constrói: a pergunta sobre o que mais muda, com cada opção esboçada, o que ela troca e qual você escolheria;
  - se nada está em aberto: o desenho curto (a abordagem, uma linha sobre por que as outras não servem, o desenho em poucas linhas) e o pedido de aprovação.
- **Ele não disse:** uma pergunta aberta sobre o que mais está indefinido, dizendo o que a resposta muda. Ex.: "Se o site é para quem decide se passa na padaria, eu abriria com horário e o que tem na vitrine hoje; encomenda é outro site. O que você quer que a pessoa faça ao chegar nele?"

## A conversa

- **Pergunte só o que muda o que se constrói** e que nem o pedido nem o projeto respondem. O resto é proposta sua, com o motivo, que ele pode corrigir. Passo de processo (onde gravar, o que ler, como mostrar) é decisão sua: faça e diga.
- **Uma pergunta por vez**, inteira: o caso concreto em palavras de quem está de fora, o que acontece se ele não decidir, e a sua recomendação com o motivo.
- **Baixo risco ou recomendação forte se assume**, marcada *assumida, a confirmar*, e a conversa anda. Espera por ele só o irreversível, o destrutivo, produção, gasto e o que publica para fora.
- **Faça-o descrever** antes de oferecer menu: até saber o porquê, perguntas abertas, sem exemplos de resposta. Opções direcionam.
- **Como se faz** (plataforma, linguagem, biblioteca): quem fala de resultado está entregando o como a você — decida e diga em uma linha. Em projeto existente, use o que ele já usa.
- **Território a cobrir** (não é roteiro, nunca leia como perguntas): o que é e o que tem de especial; por que agora e o que é sucesso; objetivos, não-objetivos e anti-objetivos (o que faria disto um fracasso mesmo funcionando); o que ele já viu, amou ou odiou; o estado atual.
- **Pergunta específica**, construída sobre a resposta anterior ou sobre algo que você achou, como faria um colega afiado: "A votação fecha antes da reunião e dois sócios entraram este mês. Quem entra no meio da rodada vota?"
- **Mostre em vez de descrever:** tela, layout ou fluxo ganham um esboço em texto ao lado.
- **Protótipo descartável** é muitas vezes o jeito mais barato de aprender. Ofereça quando ajudar; ele não tem plano nem revisão, e aproveitá-lo depois é pedido novo, que volta por aqui.

## Devolva por partes

Assim que entender uma parte (para que serve, como um pedaço se comporta), descreva-a de volta em 200–300 palavras e siga para a próxima. Só o que ele disse entra como dele; o que você preencheu entra como proposta sua, com o motivo. Feche cada parte perguntando o que está errado ou faltando.

## As abordagens

Entendido o que ele quer, e antes de escrever o desenho, mande uma mensagem só com as abordagens: pense em várias, descarte as fracas (as que contrariam o porquê dele e as que o projeto já exclui) e esboce as duas ou três que sobram, ancoradas no que o projeto faz, com o que cada uma troca. Recomende uma, com o motivo. Se ele entregou o como, diga que segue com a sua. Se só há um caminho sensato, diga isso e por que os outros não servem.

Decisão de arquitetura que restringe escolhas futuras (banco, biblioteca central, contrato entre sistemas) merece ADR: ver `orquestracao:adr`.

## O desenho

Diga o tamanho do trabalho em palavras simples; ele pode discordar.

| Tamanho | O desenho |
|---|---|
| Mudança pequena | curto: o que já foi conversado, por escrito, uma ou duas linhas por ponto |
| Projeto | completo: o suficiente para alguém competente planejar sem voltar ao operador |

Os dois cobrem: a intenção e o porquê; objetivos, não-objetivos, anti-objetivos; restrições; **Abordagens** (as consideradas, o que cada uma troca, a escolhida e por quê); o que ele decidiu, como decidiu; o que fica a critério de quem constrói; e as *assumidas, a confirmar*.

**Onde mora:** na seção `## Desenho` no topo do plano, `docs/planos/AAAA-MM-DD-slug.md` (a data é a de São Paulo). Um arquivo por trabalho: o desenho e o plano andam juntos e o executor lê os dois. Preferência do projeto ou do operador vence.

**Conferência de quem constrói** (só para projeto): antes de entregar, releia o desenho como alguém que vai planejar sem poder perguntar nada (ou mande um subagente de contexto limpo fazer isso). Separe o que surgir em: **já respondido** (ponha a resposta no texto), **menor** (decida, marque como decisão sua) e **dele** (só ele responde e muda o que se constrói). Leve as "dele" numa mensagem só, a mais importante primeiro.

## O portão

Nada se constrói antes de o operador aprovar o desenho — o curto ou o completo. Construir inclui código de produto, scaffold, instalar dependência e chamar skill de execução. Ler e explorar pode.

Exceções: ele disse para pular as perguntas (aí a skill acaba e o portão vai junto, e você diz em uma linha as escolhas de como-se-faz); ou um protótipo descartável que ele aceitou.

Aprovado o desenho, o próximo passo é `orquestracao:planejar`, e nenhuma outra skill.

## Sinais de que está errando

| Pensamento | Realidade |
|---|---|
| "Ofereço um menu do que ele pode querer" | Opção direciona. Faça-o descrever primeiro. |
| "Preencho com padrões sensatos" | Bom — diga-os em voz alta. Padrão que ele não ouviu ele não pôde recusar. |
| "Respondi as dúvidas, escrevo o desenho" | As abordagens vêm antes, numa mensagem só delas. |
| "Ele disse 'parece bom' para a ideia" | A aprovação cobre o que você mostrou. Desenho não escrito não está aprovado. |
| "O protótipo funciona, sigo construindo nele" | Aproveitar é pedido novo. Volta pelo portão. |
