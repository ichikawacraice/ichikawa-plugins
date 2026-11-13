# ichikawa-plugins

O kit de plugins (orquestracao, stack, barra, design-wicomm, contas). A `develop` é o tronco; a `main` é o que as máquinas instalam.

## Release a cada PR

Neste repositório o release sai **logo depois de cada PR mergeado na `develop`** (pedido do operador em 13/11/2026: o conserto não pode ficar parado na `develop` enquanto as sessões rodam a versão antiga). Esse pedido é o ok permanente do operador para o push na `main` daqui; nos outros projetos, o release segue pedindo o ok a cada vez.

Siga a skill `orquestracao:release`. O gate completo (não há CI neste repositório), com a saída à vista:

```bash
node --test plugins/orquestracao/tests/*.test.mjs
node --test plugins/design-wicomm/hooks/tests/*.test.mjs plugins/design-wicomm/scripts/tests/*.test.mjs
(cd plugins/contas && npm test)
claude plugin test plugins/barra
```

Verde: `git push origin <sha da develop>:refs/heads/main`, depois `claude plugin marketplace update ichikawa-plugins` e `claude plugin update <plugin>@ichikawa-plugins` de cada plugin que mudou. Sessão aberta antes do release só pega a versão nova ao reiniciar.
