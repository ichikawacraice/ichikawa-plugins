# ICH-F17 · Sessões ativas na página web

Pedido: as sessões ativas voltam para a página (porta 4747), como a vista Sessões do kit antigo, e sai o pane lateral da
barra (F8).

Pronto quando: a página mostra as sessões no visual da F13; o botão `▦ Sessões` e o pane saem; testes afetados verdes;
prints antes/depois no PR; PR mergeado na `develop`.

## De onde vem o status ao vivo

Só o app enxerga `list_sessions`. A barra (mod, fora da conversa: zero contexto) grava
`~/.claude/ichikawa/sessoes-do-app.json` a cada 60 s; a página só lê o arquivo.

- Várias sessões com a barra: quem acha o arquivo com menos de 50 s não regrava.
- Gravação atômica (`.tmp` + `mv`). Falha da leitura do app não apaga o arquivo: a página mostra a idade da leitura.
- *Assumida, a confirmar:* a leitura roda sempre que há sessão aberta com a barra (antes só com o pane aberto). É uma
  chamada do mod por minuto, sem custo de contexto.

## O que entra (da vista Sessões do kit antigo)

- "Sessões" substitui "Em andamento": uma lista só, um grupo por projeto, o projeto mais urgente em cima.
- Estado por urgência: esperando você › parada › no PR › em revisão › trabalhando.
  - esperando: pergunta aberta do item ou da sessão;
  - parada: com leitura do app fresca (≤ 3 min), a dona não está aberta no app, ou está parada há mais de 30 min;
  - no PR / em revisão / trabalhando: pela etapa do item.
- Marcador que gira com a sessão rodando (parado com "reduzir movimento").
- Esteira planejamento → execução → revisão → PR → entregue.
- PR (número e estado do app), última atividade, perguntas abertas com link para o cartão, "Abrir no app" (`claude://`).
- Sessões abertas sem item (a orquestradora) numa linha compacta, só nos projetos que o kit conhece.

Fica de fora (o kit novo não tem o dado): fatias, fila de merge, fases e tempos, "depende de", nota "agora", entregues do
dia (já estão em Entregues).

## Tarefas

1. `lib/sessoes.mjs` (puro): ler o arquivo, juntar itens, perguntas e sessões do app, estado, ordem. Testes. Risco: não.
2. `pagina.mjs`: seção Sessões no lugar de Em andamento; CSS da esteira e do marcador. Testes. Risco: não.
3. Barra: sai o pane, o botão e o atom; entra a gravação do arquivo a cada 60 s. Testes. Risco: não.
4. `docs/contratos.md` e READMEs. Risco: não.
5. Prints antes/depois. Risco: não.
