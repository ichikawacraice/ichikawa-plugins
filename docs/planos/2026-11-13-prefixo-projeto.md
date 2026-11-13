# F4 · Prefixo por projeto

Pedido: itens de projetos diferentes têm o mesmo `F3` e confundem. Cada projeto ganha uma sigla de 3 letras (`IZA-F3`); a página separa "Em andamento" por projeto e põe o nome do projeto em destaque nos cartões de Perguntas e Entregues; a limpeza da orquestradora passa a 150 mil; a orquestradora confere a dona antes de mandar mensagem.

Pronto quando: testes em `plugins/orquestracao/tests/` para 1–4, conferido na tela, PR para `develop` mergeado.

## Decisões

- **Sigla derivada**: as 3 primeiras letras ou dígitos do nome, em maiúsculas (`Izanagi` → `IZA`, `ichikawa-plugins` → `ICH`, `WiControl` → `WIC`); nome curto completa com `X`.
- **Configurável** em `~/.claude/ichikawa/siglas.json` (`{ "projeto": "SIG" }`), gravado por `perguntas sigla SIG [--projeto P]`. Recusa sigla que outro projeto já usa. `perguntas sigla --todas` lista todas e marca as que coincidem.
- **O arquivo continua `F3.json`** e o campo `id` continua `F3`: a sigla é só de exibição e de entrada. Nada migra.
- **O CLI aceita `F3` e `IZA-F3`** (e `IZA-Q3`). Com sigla e sem `--projeto`, a sigla escolhe o projeto (útil para a orquestradora de outra pasta); com `--projeto` e sigla de outro projeto, erro. `--item IZA-F3` grava `F3`.
- *Assumida, a confirmar*: as perguntas também saem com a sigla (`IZA-Q3`), pelo mesmo motivo dos itens — `Q1` existe em todo projeto.
- *Assumida, a confirmar*: sigla que coincide sem configuração não trava nada; `item nova` avisa no stderr (a saída padrão segue só o id, que a orquestradora lê).
- `ORQUESTRADORA_LIMPA_EM` padrão: 150 mil (*assumida, a confirmar*: a sessão já abre com ~66 mil).

## Tarefas

1. `estado.mjs`: `sigla(projeto)`, `rotulo(projeto, id)`, `separarId(texto)`, `projetoDaSigla(sigla)`, `gravarSigla`. Risco: não.
2. `cli.mjs`: resolver id e projeto pela sigla; saídas com o rótulo; comando `sigla`. Risco: não.
3. `pagina.mjs` + `perguntas.css`: Em andamento por projeto; projeto na primeira linha de Perguntas e Entregues; ids com sigla. Risco: não.
4. `hooks/orquestradora-limpa.mjs`: 150 mil. `hooks/inicio.mjs`: a sigla do projeto no contexto. Risco: não.
5. Skills `orquestradora` e `dona`, `regras.md`, `docs/contratos.md`: ids com sigla; conferir a dona (`list_sessions` linked + PR) antes de `SendMessage`. Risco: não.
6. Testes em `tests/orquestracao.test.mjs` para 1–4; conferir a página na tela.
