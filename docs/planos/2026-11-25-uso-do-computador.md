# ICH-F48 · Painel mostra quem está pesando no computador

**Pedido:** entre Perguntas e Sessões, o uso de CPU e memória agrupado por responsável, do maior para o menor, sem gastar cota nem pesar a máquina.

**Pronto quando:** a seção existe no Painel; o responsável é a sessão do Claude (código e título) dona da árvore de processos, ou Docker, app ou sistema; cada grupo mostra o tipo (dev server, teste, build) e há quanto tempo roda; a coleta usa `ps`, sem modelo, e só roda com a página visível; o custo é medido e vai no PR; há teste e os docs estão em dia.

## Desenho

- **Quem é o dono.** O app do Claude põe `CLAUDE_CODE_HOST_SESSION_ID=local_…` no ambiente de cada sessão e de cada dev server que sobe por ela (`preview_start`); o filho herda, inclusive o órfão que o `launchd` adotou. A coleta acha a *raiz* de cada árvore (o processo logo abaixo do app do Claude ou do `launchd`) e lê só essa variável do ambiente da raiz (`ps -E`), uma vez por processo (cache por pid + início). O resto do ambiente (há tokens nele) é descartado na hora, nunca guardado nem mostrado.
- **Sem a variável:** Docker (`Docker.app`, `com.docker.*`, e a VM `Virtualization.VirtualMachine`), app (`/Applications/<Nome>.app`; o próprio Claude vira "App Claude"), sistema (`/System`, `/usr`, `/sbin`, `/bin`, `/Library/Apple`), ou o nome do executável.
- **Título:** de `sessoes-do-app.json` (a barra já grava); o código (`ICH-F48`) sai do começo do título.
- **Tipo:** pelo comando, do processo mais de fora para dentro (o `cargo test` que chama `rustc` é teste, não build): dev server, teste, build, docker. "Há quanto tempo" é o processo mais antigo do tipo (`etime`).
- **Números:** CPU somada do grupo ÷ núcleos = % da máquina (o `pcpu` do macOS é média recente); memória = soma do RSS.
- **Custo:** um `ps -A -o pid=,ppid=,pcpu=,rss=,etime=,args=` por amostra (+ `ps -E` só para raiz nova). A página pede `GET /uso` a cada 5 s, só com `document.visibilityState === 'visible'`; o servidor guarda a última amostra por 4 s (duas abas não dobram) e nunca coleta sozinho. O HTML inicial usa a amostra guardada, se fresca, sem rodar `ps`.

## Tarefas

1. `lib/uso.mjs`: `lerTabela` (parse do `ps`), `agrupar` (pura: linhas + ambiente das raízes + sessões → grupos ordenados), `coletar` (roda os `ps`, com cache), `secaoDeUso` (HTML). Teste antes. Risco: não.
2. `pagina.mjs`: seção entre Perguntas e Sessões, rota `GET /uso`, script de 5 s com visibilidade. Teste da posição e da rota. Risco: não.
3. CSS da seção (barra de CPU proporcional, números em mono). Risco: não.
4. Medir o custo (CPU do `ps` + do node por amostra) e pôr no PR.
5. Docs: README da raiz (tabela do Painel), `plugins/orquestracao/README.md`, `docs/contratos.md` (rota `/uso`).

*Assumidas, a confirmar:* só leitura (sem botão de encerrar); amostra a cada 5 s; mostra os 8 maiores grupos e soma o resto numa linha.
