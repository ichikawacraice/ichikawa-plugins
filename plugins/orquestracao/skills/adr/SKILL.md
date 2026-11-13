---
name: adr
description: Registra uma decisão de arquitetura em docs/adr/AAAA-MM-DD-slug.md — título, Data, Status, Contexto, Decisão, Alternativas consideradas, Consequências — sem número e sem índice escrito à mão; e responde "por que fizemos assim?" lendo os ADRs existentes. Use quando o operador disser "registra essa decisão", "isso merece um ADR", "ADR disso", ao escolher entre frameworks, bancos, bibliotecas centrais ou padrões com trade-off, ao decidir algo que restringe escolhas futuras, ou quando perguntarem por que o código tem tal forma.
---

# ADR

A decisão que mora só na conversa, no comentário de PR ou na memória de alguém se perde. O ADR guarda **o porquê** e **o que foi descartado** ao lado do código — é exatamente o que alguém vai propor de novo daqui a seis meses.

## Merece ADR?

**Sim:** decisão que restringe escolhas futuras ou que alguém razoável questionaria depois — tecnologia (framework, banco, nuvem), padrão de arquitetura, desenho de API e contrato entre sistemas, modelagem de dado, infraestrutura e deploy, estratégia de auth e segredo, estratégia de teste, processo (branches, release).

**Não:** nome de variável, formatação, biblioteca escolhida por conveniência que se troca em uma tarde.

**Sinais:** "vamos de X", "melhor X que Y", "o trade-off vale porque…", comparar duas opções e chegar a uma conclusão, a seção Abordagens de um desenho (`orquestracao:brainstorming`) que escolheu algo estrutural.

## Onde e como

- Arquivo: `docs/adr/AAAA-MM-DD-slug.md` — a data de São Paulo do dia da decisão; slug curto em kebab-case que diz a decisão (`2026-11-13-postgres-em-vez-de-mongo.md`).
- **Sem número, sem reserva, sem índice escrito à mão.** A data ordena; `ls docs/adr` é o índice. Duas decisões no mesmo dia se distinguem pelo slug.
- Pasta não existe? Crie ao escrever o primeiro ADR (o próprio ADR é o pedido; não precisa de README nem de modelo separado).
- Projeto que já tem convenção própria de ADR (numeração, índice gerado, outro modelo) — no `CLAUDE.md` ou num `docs/adr/README.md` — segue a dele.

## O modelo

```markdown
# <Decisão, numa frase>

**Data:** AAAA-MM-DD
**Status:** proposed | accepted | deprecated | superseded por [<título>](AAAA-MM-DD-slug.md)

## Contexto
<2–5 frases: o problema, as restrições e as forças em jogo. Fatos verificáveis — commit,
arquivo, medição, erro real. "Parecia mais limpo" não é contexto. Mais de 10 linhas, cortou pouco.>

## Decisão
<1–3 frases, no presente: "Usamos X para Y.">

## Alternativas consideradas
### <Alternativa 1>
- **Prós:** …
- **Contras:** …
- **Por que não:** <o motivo específico da rejeição>
### <Alternativa 2>
…

## Consequências
- **Melhora:** …
- **Piora:** …
- **Riscos:** <o risco e como se mitiga>
```

"Alternativas consideradas" é obrigatória: um ADR que só afirma a escolha não ajuda ninguém. "Escolhemos e pronto" não é motivo.

## Status

`proposed` → `accepted` → `deprecated` ou `superseded`.

- **proposed:** em discussão, ainda não vale. É o status do ADR que você escreve por iniciativa própria, numa decisão que é do operador.
- **accepted:** vale e se segue. Use quando o operador decidiu, ou quando a decisão já estava no desenho que ele aprovou.
- **deprecated:** deixou de importar (a feature saiu).
- **superseded:** outro ADR o substituiu — sempre com o link para o novo.

**Mergeado, não se reescreve a decisão.** Mudou de ideia? ADR novo que diz qual substitui, e no antigo só a linha de Status muda para `superseded por [...]`. Antes do merge, o ADR ainda é rascunho e se edita à vontade.

## Fluxo

1. Ache a decisão central e o problema que a motivou.
2. Junte as alternativas de verdade (as que foram consideradas, não inventadas para preencher) e o motivo de cada rejeição.
3. Escreva as consequências com honestidade: toda decisão tem custo.
4. Grave o arquivo no PR da mudança que ele explica — ADR e código entram juntos. Decisão registrada depois do fato leva a data original e a nota `Registrado em AAAA-MM-DD.` sob o Status.
5. Cite o ADR no plano ou na spec que o usa, e o ADR cita de volta.

Decisão do operador ainda não tomada (você só propõe): o ADR vai como `proposed`, e a pergunta a ele vem inteira — o caso em palavras de fora, o que acontece se não decidir, a recomendação com motivo.

## "Por que escolhemos X?"

1. `ls docs/adr` e `grep -ril "<termo>" docs/adr`.
2. Achou: leia e responda com o Contexto e a Decisão, citando o arquivo. Se estiver `superseded`, siga o link até o vigente.
3. Não achou: diga que não há ADR sobre isso e ofereça registrar, se a decisão for das que merecem.

## Bom ADR

Específico ("usamos Prisma", não "usamos um ORM"); o porquê acima do quê; curto (lê-se em 2 minutos); no presente; honesto nas consequências; sem citar ADR em texto de interface (rótulo, mensagem de erro) — a rastreabilidade mora no código, no commit e nos docs.
