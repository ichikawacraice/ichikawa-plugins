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

## Testes (degrau 0 de `orquestracao:testes-enxutos`)

O gate inteiro leva ~20 s (medido em 19/11/2026, mediana de 3 rodadas com carga 12: orquestracao 4 s, design-wicomm 1 s, contas 6 s, barra 5 s). Abaixo de ~1 min não vale seletor: **testes afetados = o gate inteiro**. Suba ao degrau 1 (seleção por plugin) quando passar de ~2 min.

- Um arquivo: `node --test <arquivo>` (no contas, de dentro de `plugins/contas`); o barra só roda inteiro: `claude plugin test plugins/barra`.
- Testes afetados: os quatro comandos do gate acima.
- Typecheck: não há; o barra é TS e o `claude plugin test` não checa tipo.
- Gate do release: os mesmos quatro comandos, antes do push na `main`.
- Ponto cego: nenhum enquanto o afetado for o gate inteiro. Teste lê doc e skill por caminho (`readFileSync`), então quem montar o degrau 1 trata mudança em `docs/` e `skills/` como afetando o plugin dono.
- Servidor de teste pede a porta 0 e lê a que o sistema deu; sorteio de porta colide entre sessões e cai na 5060, que o `fetch` recusa (a guarda está em `plugins/orquestracao/tests/guardas-de-teste.test.mjs`). O teste de disco do contas (`enxugar-disco.serial.mjs`) mede o volume da máquina: toma uma trava em `$TMPDIR` e mede até três vezes.

## Documentação junto com o código

Mudança que o operador vê (botão, tela, rota, arquivo de estado, comando, cor com sentido) atualiza a documentação **no mesmo PR**, não depois (pedido do operador em 15/11/2026: o README ficou dois PRs atrás do Painel):

- `README.md` da raiz: a tabela do Painel, a seção de cada plugin e as legendas das imagens.
- `plugins/<plugin>/README.md` do plugin que mudou.
- `docs/contratos.md` quando muda arquivo em `~/.claude/ichikawa`, rota, atributo do `<html>` ou peça comum das páginas.
- `docs/imagens/` envelhece com a tela: se a mudança é visível nelas, diga no PR que as imagens ficaram velhas.

Antes do commit, `grep` nos READMEs e em `docs/contratos.md` pelo nome do que mudou (rótulo de botão, rota, classe) e conserte o que ficou para trás. O corpo do PR lista os docs tocados, ou diz "docs: nada a mudar" com o motivo.
