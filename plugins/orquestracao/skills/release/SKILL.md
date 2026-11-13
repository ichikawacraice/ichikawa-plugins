---
name: release
description: Solta o release — leva a develop à main por avanço rápido depois do gate completo na máquina; o push na main dispara o deploy. Use quando o operador disser "faz o release", "sobe para produção", "manda para a main", ou quando a orquestradora sugerir o release e o operador disser sim.
---

# Release

`main` é produção. Ela só recebe avanço rápido da `develop`, e o push dispara o deploy. **Empurrar a `main` exige o ok explícito do operador nesta sessão** — nem o "ok" de outra sessão, nem um ok antigo valem.

Se o projeto tem script próprio de release (ex.: `scripts/o-release.mjs` no Izanagi), use-o: ele já faz os passos abaixo. Senão:

1. **A árvore que sobe é a que passa.**
   ```bash
   git fetch origin
   git switch develop && git pull --ff-only
   git status --porcelain              # tem de vir vazio
   git merge-base --is-ancestor origin/main origin/develop || echo "main não é ancestral: pare"
   SHA=$(git rev-parse origin/develop)
   ```
2. **O que sobe:** `git log --oneline origin/main..origin/develop`. Escreva a lista em palavras do produto: um item por PR, com o que muda para quem usa. Migração, mudança de variável de ambiente ou passo manual de deploy vão em destaque.
3. **O gate completo**, na máquina: build, typecheck, a suíte inteira e o que mais o `CLAUDE.md` pedir. Saída num `.log`. Vermelho: pare e conserte por uma branch normal (não na `main`).
4. **A `develop` não andou:** `git fetch origin && test "$(git rev-parse origin/develop)" = "$SHA"`. Se andou, volte ao passo 2.
5. **Pergunte ao operador**, inteiro: o que entra em produção (a lista do passo 2); o que acontece se não soltar agora (nada muda no ar, as entregas esperam); a sua recomendação e o motivo.
6. **Com o sim:** `git push origin "$SHA:refs/heads/main"`. O servidor recusa o que não for avanço rápido; nunca `--force`.
7. **Acompanhe o deploy:** `gh run list --branch main --limit 3`, e `gh run watch <id>` em segundo plano. Falhou: diga ao operador o passo e o erro, e se o que está no ar mudou.
   **Conferência pós-deploy** (do `canary-watch`, ECC, MIT; uma passada só, sem laço de monitoramento): com o deploy verde, abra a URL de produção e confira, com a saída à vista:
   - a página principal responde 200, e o `h1`, a navegação e o botão da ação principal estão lá;
   - o console do navegador não traz erro novo (compare com a página de antes, se tiver como);
   - as chamadas de API que a página faz voltam 2xx (nenhuma 5xx), e a rota de saúde, se houver, responde;
   - JS, CSS, imagens e fontes voltam 2xx/3xx com o tipo de conteúdo certo;
   - LCP aproximado (Lighthouse ou DevTools) sem piora clara frente ao valor de antes.
   Qualquer item vermelho: diga ao operador o que quebrou e proponha reverter ou corrigir à frente; não fique repetindo a checagem.
8. **Notas:** se o projeto tem `docs/releases/`, o texto do passo 2 vira `docs/releases/AAAA-MM-DD.md` por PR normal na `develop`.

Hotfix (produção quebrada): branch de `origin/main`, PR para a `main` com o ok do operador, e depois `git switch develop && git merge origin/main` para a `develop` não perder o conserto.
