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

## Documentação junto com o código

Mudança que o operador vê (botão, tela, rota, arquivo de estado, comando, cor com sentido) atualiza a documentação **no mesmo PR**, não depois (pedido do operador em 15/11/2026: o README ficou dois PRs atrás do Painel):

- `README.md` da raiz: a tabela do Painel, a seção de cada plugin e as legendas das imagens.
- `plugins/<plugin>/README.md` do plugin que mudou.
- `docs/contratos.md` quando muda arquivo em `~/.claude/ichikawa`, rota, atributo do `<html>` ou peça comum das páginas.
- `docs/imagens/` envelhece com a tela: se a mudança é visível nelas, diga no PR que as imagens ficaram velhas.

Antes do commit, `grep` nos READMEs e em `docs/contratos.md` pelo nome do que mudou (rótulo de botão, rota, classe) e conserte o que ficou para trás. O corpo do PR lista os docs tocados, ou diz "docs: nada a mudar" com o motivo.
