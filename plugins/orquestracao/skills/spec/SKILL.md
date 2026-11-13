---
name: spec
description: Mantém as specs de um projeto que já trabalha com elas — abrir uma spec nova, mudar o status, atualizar a spec na mesma sessão em que o código muda — com status de vocabulário fechado e a regra de que spec no presente só afirma o que existe. Use SÓ em projeto que já tem pasta de specs (docs/specs ou a que o CLAUDE.md declara), quando for escrever ou mudar uma spec, terminar de implementar algo que tem spec, ou quando o operador disser "abre uma spec", "atualiza a spec". Projeto sem specs não ganha uma por esta skill — o desenho mora no plano.
---

# Spec

Spec é contrato: onde o comportamento de um componente é decidido, antes do código. Esta skill é **opcional** — só vale em projeto que já usa specs. Sem pasta de specs, o desenho mora em `docs/planos/` (`orquestracao:brainstorming`, `orquestracao:planejar`) e a decisão estrutural num ADR (`orquestracao:adr`); não abra um acervo de specs por conta própria.

**A regra que governa tudo:** divergência entre o que a spec diz e o que o código faz é bug, e se corrige **na mesma sessão** — consertando o código ou a spec, nunca deixando os dois discordarem até amanhã.

## Quem manda: o que o projeto declara

Antes de mexer, leia o `CLAUDE.md` e os docs que ele cita (um `docs/specs/README.md`, um `docs/convencoes.md`): onde moram as specs, como se nomeiam, se há índice e se ele é gerado por script, qual teste confere as docs. O que o projeto declara vence os padrões abaixo. Não cite nem rode um conferidor que o repositório não tem.

Padrão, sem declaração: `docs/specs/`, um arquivo por componente ou contrato coeso, nome no estilo dos que já existem (se forem `SPEC-NNN-slug.md`, siga a sequência olhando o maior número existente).

## O cabeçalho

Uma linha só:

```
- **Data:** AAAA-MM-DD · **Revisões:** AAAA-MM-DD (o que mudou) · **Status:** Implementada · **Pendências:** critério 4 pende do primeiro uso real
```

**Status é UMA palavra de um vocabulário fechado:** `Rascunho`, `Em revisão`, `Aprovada`, `Implementada`, `Substituída` (ou o vocabulário que o projeto declara). Nada além disso.

Quando status e nuance dividem o campo, aparecem estados inventados ("Parcialmente implementada", "Fase 1 implementada") e o campo para de responder à única pergunta que importa: *dá para confiar no que está escrito aqui?* A nuance mora em `Pendências:`, livre e opcional (ausente = não falta nada). **Meia implementação é `Aprovada` com pendência, não um estado novo.**

## Escrever e manter

- **Spec no presente só afirma o que existe.** Mecanismo planejado e ainda não implementado vai em `Pendências:`, não no corpo como se existisse.
- **Mudou o código que a spec descreve?** A spec muda no mesmo PR. Ao terminar de implementar o que tinha spec, atualize o status e as pendências antes de entregar a branch.
- **Índice:** se o projeto mantém um (`docs/specs/README.md`), atualize a linha da spec junto do cabeçalho; se o índice é gerado, rode o gerador em vez de editar à mão.
- **Tamanho:** uma spec, um componente ou contrato coeso. Passou de ~300 linhas, provavelmente são duas.
- **Ligações:** a spec cita os ADRs que a sustentam, e o ADR cita a spec de volta. O plano que implementa a spec a cita no cabeçalho, e o executor lê as duas.
- **Spec substituída** não se apaga: status `Substituída` e o link para a que a substitui.

## Spec e plano

A spec diz **o quê** e **por quê**, e vive enquanto o componente viver. O plano diz **como** e **em que ordem**, e envelhece quando a branch entra. Requisito novo nasce na spec (ou no desenho do plano, em projeto sem specs); passo de implementação nasce no plano. Plano que contradiz a spec: a spec manda, e a contradição vira uma `Decisão:` registrada (`orquestracao:executar-plano`).

## Armadilhas

- **Texto de interface não cita spec nem ADR.** Nada de `SPEC-014` ou `ADR de 2026-11-13` em rótulo, tooltip, mensagem de erro ou e-mail — inclusive no que nasce no back-end e chega à tela. Escreva o que a coisa É.
- **Commitado não é mergeado.** "Implementada" vale depois do merge na `develop`, não do commit.
- **Pesquisa envelhece.** Nota de pesquisa citada pela spec (preço, endpoint, versão) se revalida antes de virar decisão nova.
