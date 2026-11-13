---
name: codigo-morto
description: Achar e apagar código morto com segurança — exports, arquivos e dependências sem uso (knip, depcheck, ts-prune), duplicatas e wrappers inúteis, apagando em passos pequenos com teste a cada passo. Use quando pedirem limpeza, "tira o que não usa", "esse arquivo ainda é usado?", ao enxugar dependências ou o bundle, ou depois de uma feature removida. Não use no meio de feature em andamento nem na véspera de release.
---

# Código morto

Apagar é refatoração: segue o mesmo cuidado. **Em dúvida, deixe.** Código morto custa pouco; apagar o que era usado por rota dinâmica, config ou pacote externo custa produção.

## Quando não limpar

- No meio de uma feature (o "morto" de hoje é o usado de amanhã)
- Na véspera de release (`orquestracao:release`)
- Em código que você não entende, ou sem teste que pegue a quebra
- Misturado com refatoração: limpe num PR, refatore em outro

## 1. Detectar

```bash
npx knip                                          # arquivos, exports e dependências sem uso
npx depcheck                                      # dependências npm sem uso
npx ts-prune                                      # exports TypeScript sem uso
npx eslint . --report-unused-disable-directives   # comentários eslint-disable inúteis
```

- `knip` é a ferramenta principal; `ts-prune` é mais antiga e menos mantida, use só se o `knip` não servir. `depcheck` confirma dependências.
- Rode no que o projeto já tem configurado; o `knip` precisa saber os pontos de entrada (Next: `app/`, `pages/`, `middleware.ts`, `next.config.*`), senão acusa como morto o que o framework chama por convenção.
- Sem ferramenta: busque cada `export` e veja se há algum `import` dele.

## 2. Classificar

| Risco | Exemplo | Ação |
|---|---|---|
| **Seguro** | função utilitária, helper de teste, export interno sem uso | apagar |
| **Cuidado** | componente, rota de API, middleware, dependência | provar que ninguém usa (passo 3) |
| **Perigo** | arquivo de configuração, ponto de entrada, tipo público, o que o framework chama por nome (`page.tsx`, `route.ts`, `loading.tsx`, `instrumentation.ts`) | investigar; normalmente não apagar |

## 3. Provar que não é usado

Para cada item de Cuidado:

- `grep` pelo nome inteiro **e** por pedaços (rota montada por string, `import()` com caminho dinâmico, `require`, nome em JSON/YAML/config, `dynamic()` do Next)
- É exportado para fora (pacote publicado, API pública, webhook que alguém chama)? Quem consome?
- Rota de API: há chamada em outro app, cron, webhook de terceiro? Veja os logs de acesso, se houver
- `git log -S'nome'` mostra por que existe

## 4. Apagar em passos pequenos

1. Rode os testes afetados e o typecheck: **precisa estar verde antes**.
2. Uma categoria por vez, nesta ordem: dependências → exports → arquivos → duplicatas.
3. Apague um item (ou um lote do mesmo tipo), rode testes afetados + typecheck + build.
4. Quebrou: desfaça aquele passo (`git restore -- <arquivo>`) e pule o item.
5. Um commit por lote, com mensagem que diz o que saiu (o fluxo de branch e PR é o de `orquestracao:entregar-branch`).

Dependência removida: confira o lockfile, rode `npm ci` limpo e o build; o `depcheck` erra com plugins carregados por nome (eslint, babel, postcss).

## 5. Duplicatas

Depois do morto: funções quase iguais (>80%) viram uma (a mais completa e testada), tipos redundantes se unem, wrapper que só repassa é inlinado, re-export sem finalidade sai. Atualize todos os imports e rode os testes.

## Relato

Diga o que saiu (funções, arquivos, dependências), o que foi pulado e por quê (teste quebrou, risco), linhas removidas e o resultado do build e dos testes.

Fonte: adaptado de affaan-m/ECC (MIT) — `agents/refactor-cleaner` e `commands/refactor-clean`.
