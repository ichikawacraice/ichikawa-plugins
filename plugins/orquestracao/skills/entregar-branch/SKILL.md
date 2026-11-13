---
name: entregar-branch
description: Fecha uma branch de trabalho no fluxo develop — verifica testes afetados e typecheck, atualiza com origin/develop, faz push, abre o PR para develop e o integra por squash quando autorizado; sem develop, o tronco é a main e o merge vira release, que só sai com o ok do operador. Use quando a implementação terminou e está verificada, quando o operador disser "abre o PR", "entrega", "pode subir", "finaliza a branch", ou ao fim de orquestracao:executar-plano.
---

# Entregar a branch

**Caminho:** verificar → atualizar com o tronco → push → PR para o tronco → squash → limpar.

Tronco é `develop`: toda branch nasceu dela e todo PR de trabalho volta para ela por **squash**. A `main` é produção e só recebe release (avanço rápido da `develop`, que dispara o deploy) — release não é desta skill. Projeto sem `develop`: o tronco é a `main`, e cada merge é release.

```bash
git ls-remote --exit-code --heads origin develop >/dev/null && TRONCO=develop || TRONCO=main
```

## 1. Verificar

Rode os **testes afetados** pela branch e o **typecheck** (os comandos do `CLAUDE.md` do projeto) e cole a saída (`orquestracao:verificar-antes-de-concluir`). O gate completo é do release, não daqui. Falhou: pare, mostre as falhas, conserte (`orquestracao:depurar`) — o PR vem depois do verde.

Árvore suja (`git status --porcelain`)? Commite o que é do trabalho; rascunho e arquivo solto não entram.

## 2. Atualizar com o tronco

```bash
git fetch origin
git rebase origin/$TRONCO
```

Conflito: resolva entendendo os dois lados, não escolhendo um por atacado. Depois do rebase, rode de novo afetados + typecheck — verde antes do rebase não prova a árvore depois dele.

Branch com commits de outra pessoa ou já em revisão por alguém: em vez de rebase, `git merge origin/$TRONCO` (não reescreve o que os outros já viram).

## 3. Push e PR

```bash
git push -u origin HEAD          # depois de rebase em branch já enviada: --force-with-lease, nunca --force
gh pr create --base $TRONCO --title "<tipo>: <assunto em PT-BR>" --body-file <arquivo>
```

O corpo do PR, em PT-BR, segue o modelo do repositório se houver; senão:

- **O que muda** e **por quê** (2–4 linhas, palavras do produto).
- **Plano:** `docs/planos/AAAA-MM-DD-slug.md` e ADRs, se houver.
- **Verificação:** os comandos rodados e o resultado (afetados + typecheck); o que **não** foi verificado.
- **Risco:** qual (auth, dinheiro, migration, diff grande) e se passou pelo `orquestracao:revisor`; ou "sem risco, autorrevisão".
- **Decisões assumidas** e **menores adiados**, se houver.
- Migration: a ordem de deploy (`orquestracao:migrations-seguras`).

O título vira a mensagem do squash: conventional commit, assunto em português.

Push recusado: o remoto andou. Busque e integre; force-push só com `--force-with-lease` na sua própria branch, e nunca no tronco.

## 4. Integrar por squash

- **Tronco `develop`:** integre quando o `CLAUDE.md` do projeto ou o operador autoriza a sessão a fazer merge na `develop` — `gh pr merge --squash --delete-branch` (com `--auto` se o projeto exige CI verde antes). Sem essa autorização, deixe o PR aberto e diga ao operador o link e o que falta.
- **Tronco `main` (projeto sem `develop`):** o merge dispara o deploy. **Só com o ok explícito do operador nesta sessão.** Leve a pergunta inteira: o que entra em produção, em palavras de fora; o que acontece se não integrar agora (o PR fica aberto, nada muda no ar); a sua recomendação e o motivo (ex.: "integrar agora: verde, sem migration, sem risco").
- Nunca squash local seguido de push direto no tronco.

## 5. Limpar

- Depois do merge: `git switch $TRONCO && git pull --ff-only`, e `git branch -D <branch>` se o `--delete-branch` não apagou a local (o squash faz o `-d` recusar).
- **Worktree** criado para este trabalho (em `.worktrees/` ou `worktrees/`): `git worktree remove <caminho>` a partir de fora dele. Removeu com recusa ("contains modified or untracked files")? Esses arquivos só existem ali: mostre a lista ao operador e pergunte — nunca `--force` por conta própria. Worktree que não foi você quem criou é do ambiente: deixe.
- PR aberto esperando revisão ou CI: **mantenha** a branch e o worktree — o retorno do PR se corrige ali.

## Descartar o trabalho

Só se o operador pedir com essas palavras. Mostre o que some (branch, commits, worktree) e espere a confirmação explícita dele antes de `git branch -D`. Nunca ofereça descartar por conta própria.

## Racionalizações

| Desculpa | Realidade |
|---|---|
| "Os testes passaram mais cedo" | Rode na árvore que vai entregar, depois do rebase. |
| "É óbvio que ele quer na main" | Merge na `main` é deploy. Só com o ok dele. |
| "O tronco é a main, claro" | Confira se existe `develop`. Errar o tronco custa caro de desfazer. |
| "Push recusado, force resolve" | O remoto andou. Integre; `--force-with-lease` só na sua branch. |
| "O PR subiu, o worktree é bagunça" | O retorno do PR se corrige nele. Fica até integrar. |
| "Rodo o gate completo para garantir" | O gate é do release. Aqui, afetados + typecheck. |
