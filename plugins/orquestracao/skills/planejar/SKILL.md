---
name: planejar
description: Escreve o plano de implementação em docs/planos/AAAA-MM-DD-slug.md — arquivos, interfaces, tarefas pequenas com teste primeiro, comandos e saída esperada, risco de cada tarefa — para que o executor faça sem precisar decidir nada. Use depois do desenho aprovado (orquestracao:brainstorming), ou quando já houver spec ou requisito de uma tarefa de vários passos, ANTES de tocar no código. Também quando o operador disser "planeja", "faz o plano", "quebra isso em tarefas".
---

# Planejar

Escreva o plano para um engenheiro que não viu este código nem esta conversa. Ele escreve código idiomático quando sabe a interface exata e o teste exato, e escolhe com bom senso onde o plano deixar aberto. O que ele não tem como saber é **o que você decidiu**: quais arquivos, quais nomes e assinaturas, quais valores da spec, quais testes provam cada tarefa. É isso que vai no plano. DRY, YAGNI, TDD, commits frequentes.

Quem planeja decide: o plano se escreve em Opus. Quem executa é o `orquestracao:executor` (Sonnet), que recebe uma tarefa por vez.

**Onde mora:** `docs/planos/AAAA-MM-DD-slug.md` (data de São Paulo), no mesmo arquivo do desenho (`## Desenho` no topo, quando veio de `orquestracao:brainstorming`). Preferência do projeto vence.

## Antes das tarefas

- **Escopo:** se o desenho cobre subsistemas independentes, proponha um plano por subsistema. Cada plano entrega software que funciona e se testa sozinho.
- **Mapa de arquivos:** quais arquivos nascem ou mudam e a responsabilidade de cada um. Arquivo com uma responsabilidade clara; o que muda junto mora junto; em código existente, siga o padrão da casa (arquivo que já está grande e você vai mexer pode ganhar uma divisão no plano).
- **Comandos do projeto:** leia no `CLAUDE.md` do projeto o comando de **testes afetados** e o de **typecheck**. São eles que o plano usa em cada tarefa. Gate completo não roda durante o trabalho; só no release.
- **Tronco:** a branch nasce de `origin/develop` (sem `develop`, de `origin/main`). Diga o nome da branch no cabeçalho.

**Ordem de construção** (do `code-architect`, ECC, MIT): ordene as tarefas pelo que depende do quê, de baixo para cima — tipos e interfaces; lógica central; camada de integração (rota, query, cliente); interface; docs. Cada tarefa deixa a árvore verde sozinha. Desenhe encaixando no padrão que o código já usa (leia primeiro como ele organiza arquivos, nomes e testes), e não invente abstração que o repositório ainda não tem.

## Tamanho da tarefa

A tarefa é a menor unidade com ciclo de teste próprio e entrega que se testa sozinha. Junte preparo, configuração e doc na tarefa cujo resultado precisa deles; divida só onde faria sentido rejeitar uma e aprovar a vizinha. Cada passo é uma ação com resultado conferível: escrever o teste que falha · rodá-lo e ver falhar · implementar o mínimo · rodar e ver passar · commit.

## Cabeçalho do plano

```markdown
# <Nome> — plano

> Para quem executa: use orquestracao:executar-plano. Passos em checkbox (`- [ ]`).

**Objetivo:** <uma frase>
**Arquitetura:** <2–3 frases>
**Stack:** <tecnologias que importam>
**Branch:** `<tipo>/<slug>` a partir de `origin/develop`
**Verificação por tarefa:** `<testes afetados>` + `<typecheck>` (do CLAUDE.md)

## Restrições globais
<o que vale para o projeto todo — versão mínima, limite de dependência, regra de texto e nome — uma linha cada, valores copiados da spec. Toda tarefa herda esta seção.>

## Foco de revisão
<as até cinco entradas ou falhas que o desenho implica, que nenhum teste exercita e que mais morderiam quem usa — uma linha cada, a entrada e o comportamento que uma pessoa razoável esperaria. Para cada linha, acrescente o teste na tarefa dona do código.>

## Decisões assumidas
<o que você decidiu sozinho por ser baixo risco, *assumida, a confirmar*, com o custo se estiver errado.>
```

## Estrutura da tarefa

````markdown
### Tarefa N: <componente>

**Risco:** não | sim — <auth/permissão/segredo · dinheiro · migration ou dado que não volta · diff grande>
**Arquivos:**
- Criar: `caminho/exato/arquivo.ts`
- Mudar: `caminho/exato/existente.ts:123-145`
- Teste: `caminho/exato/arquivo.test.ts`

**Interfaces:**
- Consome: <o que usa de tarefas anteriores — assinaturas exatas>
- Produz: <o que as próximas usam — nomes, parâmetros e retornos exatos>

- [ ] **Passo 1: teste que falha** — `deve recusar e-mail vazio`: `expect(resultado.erro).toBe('E-mail obrigatório')`
- [ ] **Passo 2: ver falhar** — `npm run test:afetados -- caminho/arquivo.test.ts` → esperado: FAIL, "validarEmail is not defined"
- [ ] **Passo 3: implementar `validarEmail(email: string): Resultado` em `caminho/arquivo.ts`** — uma linha sobre a abordagem, se a assinatura e o teste deixarem escolha
- [ ] **Passo 4: ver passar** — mesmo comando + typecheck → esperado: PASS, 0 erros
- [ ] **Passo 5: commit** — `feat: valida e-mail no cadastro`
````

**Risco** decide a revisão: só tarefa marcada "sim" ganha o `orquestracao:revisor` (ver `orquestracao:revisar`). Marque pelo critério, não por cautela: auth, permissão ou segredo; dinheiro; migration ou dado que não volta; diff previsto acima de ~400 linhas de código.

## O que um passo contém

Um passo está pronto quando o executor só consegue escrever **uma** coisa razoável a partir dele. Sem ambiguidade, não completo:

- **Passo de teste:** nome do teste e as afirmações, com os valores exatos da spec.
- **Passo de código:** assinatura exata, arquivo, valores que a spec fixa. O corpo, quem escreve é o executor. Corpo no plano só para algoritmo que assinatura e teste não determinam, ou texto exato que a spec fixa.
- **Passo de verificação:** o comando e a saída que significa passou.
- **Referência a outra tarefa:** pelo bloco Interfaces; não repita o código dela.

Plano mais longo que o código que descreve escreveu o código. Linha que não decide nada ("TBD", "tratar casos de borda", "validar direito", "testes para o acima", tipo que nenhuma tarefa define) é a falha oposta.

Migration: siga `orquestracao:migrations-seguras` (cada arquivo num passo, deploys separados quando quebra o código no ar). Tela: `orquestracao:testes-de-tela` diz onde cada teste mora.

## Autorrevisão do plano

Releia o desenho/spec com olhos novos e confira, você mesmo (não é subagente):

1. **Cobertura:** cada requisito tem uma tarefa? Falta, acrescente.
2. **Passos:** algum deixa duas leituras? Algum transcreve corpo que o teste já determina? Conserte os dois.
3. **Tipos:** nomes e assinaturas batem entre tarefas? `limparCamadas()` na 3 e `limparTodasCamadas()` na 7 é bug.
4. **Foco de revisão:** cada linha tem teste numa tarefa? Seção vazia = você conferiu e não achou, não que pulou.
5. **Proporção:** o plano é várias vezes maior que a spec? Troque corpos por assinaturas e afirmações.
6. **Risco:** cada tarefa tem a linha `Risco:` pelo critério?

Achou, conserte no texto e siga; não precisa re-revisar.

## Entrega do plano

Grave o arquivo e diga ao operador em poucas linhas: o caminho, quantas tarefas, quais têm risco (e por quê), as decisões assumidas. Se o desenho já foi aprovado e o plano não inventou nada fora dele, siga para `orquestracao:executar-plano` sem esperar — a revisão do plano pelo operador acontece em paralelo, e ele corrige o rumo se quiser. Pare e pergunte só se o plano trouxe decisão nova que é irreversível, destrutiva, mexe em produção ou gasta.
