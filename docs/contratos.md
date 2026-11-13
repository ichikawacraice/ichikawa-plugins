# Contratos entre os plugins

Os plugins não se importam entre si. Eles se encontram só por estes arquivos e comandos. Mudar um contrato é mudar todos os lados no mesmo PR.

## Pasta de estado

Tudo o que é de máquina (não de projeto) mora em `~/.claude/ichikawa/` (`$ICHIKAWA_HOME` sobrescreve, para teste). Nenhum plugin grava estado dentro do repositório do projeto.

| Caminho | Dono (quem grava) | Quem lê |
|---|---|---|
| `ausente.json` | `barra` | `orquestracao` |
| `perguntas/<projeto>/Q<n>.json` | `orquestracao` | `orquestracao` (página) |
| `itens/<projeto>/F<n>.json` | `orquestracao` | `orquestracao` (página) |
| `siglas.json` | `orquestracao` (`perguntas sigla`) | `orquestracao` |
| `pedidos/<uuid>.json` | página do `orquestracao` | `barra` (o mod toma, executa e apaga) |

- **`<projeto>`** é o nome da pasta raiz do repositório principal (pai do `git rev-parse --path-format=absolute --git-common-dir`), para todos os worktrees darem o mesmo nome.
- **Sigla do projeto**: 3 letras ou dígitos que antecedem o id na leitura (`IZA-F3`, `IZA-Q12`). Sai das 3 primeiras letras ou dígitos do nome, em maiúsculas, ou de `siglas.json` (`{ "<projeto>": "IZA" }`, gravado por `perguntas sigla`). O arquivo e o campo `id` seguem sem sigla (`F3.json`, `"id": "F3"`); o CLI aceita os dois formatos.
- **Um arquivo por registro.** Ninguém acrescenta linha a arquivo dividido. O próximo número sai de varrer a pasta e criar `Q<max+1>.json` com a flag `wx`; se o arquivo já existir (outra sessão ganhou), tenta o seguinte.

### `ausente.json`

```json
{ "ligado": true, "desde": "2026-11-13T21:15:00-03:00", "por": "barra" }
```

Ausente o arquivo, ou `ligado` diferente de `true`: o operador está presente. `desde` é o momento da última troca (ligar ou desligar), em horário de São Paulo; a barra grava `{ "ligado": false, "desde": …, "por": "barra" }` ao desligar.

### `perguntas/<projeto>/Q<n>.json`

```json
{
  "id": "Q12",
  "titulo": "Apagar a tabela antiga de pedidos?",
  "caso": "o caso concreto, em palavras de quem está de fora",
  "seNaoDecidir": "o que acontece se ninguém responder",
  "recomendacao": "a recomendação e o motivo",
  "sessao": "local_…",
  "item": "F7",
  "estado": "aberta",
  "resposta": null,
  "respondidaEm": null,
  "lida": true,
  "criadoEm": "ISO-8601",
  "atualizadoEm": "ISO-8601"
}
```

`estado`: `aberta` · `respondida` · `descartada`. `lida: false` marca resposta dada pela página que a sessão ainda não leu (`perguntas novidades`).

### `itens/<projeto>/F<n>.json`

```json
{
  "id": "F7",
  "titulo": "o pedido em palavras do produto",
  "etapa": "planejamento",
  "sessao": "local_…",
  "pr": null,
  "entrega": null,
  "criadoEm": "ISO-8601",
  "atualizadoEm": "ISO-8601"
}
```

`etapa`: `planejamento` · `execucao` · `revisao` · `pr` · `feito` · `parado` · `descartado`.

**Arquivo.** Item em etapa final (`feito`, `parado`, `descartado`) com entrega há mais de 30 dias sai da página e é movido para `itens/<projeto>/arquivo/F<n>.json` (pela página, uma vez por dia ao abrir, ou por `perguntas arquivar`). Nada é apagado; voltar é mover o arquivo de volta. O próximo número conta também os arquivados.

**A entrega** é o que a dona grava ao terminar, tenha concluído ou não, logo antes de se arquivar (`perguntas item entregar`). A página só lê:

```json
"entrega": {
  "desfecho": "entregue",
  "resultado": "o que mudou para quem usa",
  "medido": "o que foi medido e como",
  "naoMedido": "o que ficou sem medir",
  "proximos": ["próximo passo"],
  "em": "ISO-8601"
}
```

`desfecho`: `entregue` (PR aberto ou mergeado) · `parcial` (parte entregue, o resto em `proximos`) · `parado` (não deu, com o motivo em `resultado`). Com `entregue` ou `parcial` a etapa vai a `feito`; com `parado`, a `parado`.

### `pedidos/<uuid>.json`

O navegador não alcança as ferramentas do app; o mod da `barra` alcança. A página grava o pedido e o mod de qualquer sessão viva o executa.

```json
{ "tipo": "abrir-sessao", "sessao": "local_…", "texto": null, "criadoEm": "ISO-8601" }
```

`tipo`: `abrir-sessao` (foca a sessão da pergunta) · `responder` (manda `texto` à sessão como mensagem). O mod toma o pedido renomeando-o para `pedidos/tomados/` (só um mod ganha), executa e apaga; falha vai a `pedidos/falhos/` com o motivo. Pedido de mais de 30 min é descartado.

Pedido vencido ou inválido também vai a `falhos/` com o motivo (fica o rastro). O nome do arquivo segue `[A-Za-z0-9_-]+.json` e `sessao` segue `local_[A-Za-z0-9-]+`. **Limite do app:** `abrir-sessao` usa `open_session_in` com `target: "focus"`, que só mostra a própria sessão (`self`) ou uma que a sessão que tomou o pedido abriu, e só age com essa sessão na tela; fora disso o app diz que não mudou nada e o mod registra o texto no log.

## Botões da barra: `barra.json`

Cada plugin que quer botão na barra traz um `barra.json` na raiz dele (ao lado de `.claude-plugin/`). A `barra` lê o arquivo de cada plugin **instalado e ligado** e mostra os botões. Plugin desligado ou ausente não aparece.

```json
{
  "botoes": [
    {
      "id": "perguntas",
      "rotulo": "Perguntas",
      "dica": "Abre no navegador do app a página com as perguntas abertas e os itens",
      "comando": ["node", "${CLAUDE_PLUGIN_ROOT}/lib/cli.mjs", "pagina", "--subir"],
      "url": "http://127.0.0.1:4747",
      "contador": ["node", "${CLAUDE_PLUGIN_ROOT}/lib/cli.mjs", "contar"],
      "ordem": 20
    }
  ]
}
```

- `comando`: argv executado sem shell, com `${CLAUDE_PLUGIN_ROOT}` trocado pela pasta do plugin dono do arquivo. Roda desacoplado (`/bin/sh -c 'nohup "$@" &' barra <argv>`: o shell só repassa o argv, nada é interpretado; a saída vai para `/dev/null`, a variável `CLAUDE_PLUGIN_ROOT` também é passada); a barra não espera a saída.
- `url` (opcional): página local (`http://127.0.0.1…` ou `http://localhost…`; outra URL é recusada) que o clique abre no **navegador do app** (o painel de navegador do Claude, pela ferramenta `mcp__Claude_Browser__preview_start`). Com `url`, o `comando` roda sem desacoplar, com prazo de 10 s, e a barra espera ele terminar (é ele que sobe a página) antes de abrir. Sem a ferramenta (terminal), abre no navegador do sistema (`open`); recusa ou erro do app vira aviso.
- `contador` (opcional): argv que imprime um número inteiro no stdout, mostrado como selo no botão. A barra o roda no máximo a cada 30 s, com prazo de 3 s; falha, `0` ou saída não numérica = sem selo. `dica` não aparece na barra (o motor não tem dica de botão); fica para documentação.
- `ordem`: menor fica à esquerda. Os botões próprios da barra (cache, ausente) vêm antes de todos.

## Branches dos projetos

- `develop` é o tronco de trabalho: toda branch nasce dela e todo PR de trabalho entra nela, por squash.
- `main` é produção. Só recebe o release (avanço rápido da `develop`), e o push na `main` dispara o deploy.
- Projeto sem `develop`: o tronco é a `main`, e cada merge é release.

## Layout comum das páginas

Toda página local dos plugins (contas, perguntas e as que vierem) usa o mesmo visual: o do painel de contas (`plugins/contas/src/painel/publico/estilo.css` e `ceu.js`, céu noturno com cartões de vidro). A fonte é o painel de contas; as outras páginas levam uma cópia idêntica dos dois arquivos e acrescentam só classes próprias num arquivo à parte. Mudar o visual é mudar o original e copiar nos outros no mesmo dia.
