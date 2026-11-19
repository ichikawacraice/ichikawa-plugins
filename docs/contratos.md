# Contratos entre os plugins

Os plugins não se importam entre si. Eles se encontram só por estes arquivos e comandos. Mudar um contrato é mudar todos os lados no mesmo PR.

## Pasta de estado

Tudo o que é de máquina (não de projeto) mora em `~/.claude/ichikawa/` (`$ICHIKAWA_HOME` sobrescreve, para teste). Nenhum plugin grava estado dentro do repositório do projeto.

| Caminho | Dono (quem grava) | Quem lê |
|---|---|---|
| `ausente.json` | `barra` | `orquestracao` |
| `tema.json` | `barra`, Painel do `orquestracao`, painel do `contas` (o botão de tema) | os três |
| `tema-do-app.json` | Painel do `orquestracao`, painel do `contas` (a gaveta de temas, botão do canto esquerdo do topo) | `barra` e as duas páginas |
| `tema-do-painel.json` | Painel do `orquestracao`, painel do `contas` (a gaveta de temas) | as duas páginas |
| `efeitos.json` | Painel do `orquestracao`, painel do `contas` (a gaveta de temas) | `barra` e as duas páginas |
| `perguntas/<projeto>/Q<n>.json` | `orquestracao` | `orquestracao` (página) |
| `itens/<projeto>/F<n>.json` | `orquestracao` | `orquestracao` (página) |
| `siglas.json` | `orquestracao` (`perguntas sigla`) | `orquestracao` |
| `pedidos/<uuid>.json` | página do `orquestracao` | `barra` (o mod toma, executa e apaga) |
| `orquestradoras.json` | `orquestracao` (`perguntas papel orquestradora` e o início da sessão com o papel) | `orquestracao` (página, para onde vai a resposta de dona arquivada) |
| `sessoes-do-app.json` | `barra` (a cada 60 s) | `orquestracao` (página, seção Sessões) |

- **`<projeto>`** é o nome da pasta raiz do repositório principal (pai do `git rev-parse --path-format=absolute --git-common-dir`), para todos os worktrees darem o mesmo nome.
- **Sigla do projeto**: 3 letras ou dígitos que antecedem o id na leitura (`IZA-F3`, `IZA-Q12`). Sai das 3 primeiras letras ou dígitos do nome, em maiúsculas, ou de `siglas.json` (`{ "<projeto>": "IZA" }`, gravado por `perguntas sigla`). O arquivo e o campo `id` seguem sem sigla (`F3.json`, `"id": "F3"`); o CLI aceita os dois formatos.
- **Um arquivo por registro.** Ninguém acrescenta linha a arquivo dividido. O próximo número sai de varrer a pasta e criar `Q<max+1>.json` com a flag `wx`; se o arquivo já existir (outra sessão ganhou), tenta o seguinte.

### `ausente.json`

```json
{ "ligado": true, "desde": "2026-11-13T21:15:00-03:00", "por": "barra" }
```

Ausente o arquivo, ou `ligado` diferente de `true`: o operador está presente. `desde` é o momento da última troca (ligar ou desligar), em horário de São Paulo; a barra grava `{ "ligado": false, "desde": …, "por": "barra" }` ao desligar.

### `tema.json`

```json
{ "tema": "claro", "em": "2026-11-13T21:15:00-03:00", "por": "barra" }
```

A escolha do botão de tema, uma só para a barra, o Painel e o painel de contas. `tema` igual a `"claro"` é o claro (o céu de dia, `data-ceu="dia"`); sem arquivo, ilegível ou qualquer outro valor, o escuro (a noite, o padrão). `por` diz quem gravou (`barra`, `painel`, `cotas`); `em` é ISO-8601. Quem grava escreve ao lado e renomeia (a barra grava direto, o arquivo é de uma linha). Nem a hora nem o `ausente.json` mudam o tema.

### `tema-do-app.json`

```json
{ "ligado": false, "em": "2026-11-14T03:30:00.000Z", "por": "painel" }
```

O tema do app (o céu atrás da conversa no Claude desktop e no mobile, com a paleta puxada para ele): só `ligado` igual a `false` desliga; sem arquivo, ilegível ou qualquer outro valor, ligado (o padrão, que vem com o kit). Um para a máquina. Grava quem tem a gaveta de temas: o Painel (`POST /tema-do-app`, formulário `ligado=true|false`, só da própria origem) e o painel de contas (`POST /api/tema-do-app`, JSON `{ "ligado": boolean }` com a guarda das ações); `por` é `painel` ou `cotas`. As páginas saem com `data-tema-do-app="ligado|desligado"` no `<html>` (a chave do tema do Claude, na gaveta, fica desligada). A barra não tem o botão (a largura dele tirava a cena de estrelas da barra); ela relê este arquivo e o `tema.json` a cada 2 s e aplica `$.theme.set` com a cena da noite (`noite-do-kit-<nível>`, escuro) ou do dia (`dia-do-kit-<nível>`, claro), com o nível do `efeitos.json`, só quando muda; desligado depois de ter aplicado, `$.theme.clear`. Uma sessão que abre com o tema desligado não limpa nada (não apaga o tema de outro plugin).

### `tema-do-painel.json`

```json
{ "ligado": false, "em": "2026-11-15T21:00:00.000Z", "por": "painel" }
```

O tema das duas páginas (Painel e contas): ligado, o céu e o vidro; desligado, o layout do kit antigo (fundo chapado, cartões com borda, sem céu; o topo tem a mesma anatomia do ligado). Só `ligado` igual a `false` desliga; sem arquivo ou ilegível, ligado. Grava a gaveta de temas: o Painel (`POST /tema-do-painel`, formulário `ligado=true|false`, só da própria origem, 204) e o painel de contas (`POST /api/tema-do-painel`, JSON `{ "ligado": boolean }` com a guarda das ações); `por` é `painel` ou `cotas`. As páginas saem com `data-tema-do-painel="ligado|desligado"` no `<html>`; `ceu.js` não desenha céu com ele desligado. O `GET /api/ceu` do painel de contas devolve `{ ceu, temaDoApp, temaDoPainel, efeitos }`.

### `efeitos.json`

```json
{ "efeitos": "poucos", "em": "2026-11-18T18:30:00.000Z", "por": "painel" }
```

Quanto o céu se mexe, no app e nas duas páginas. `nenhum` ("Mínimo" na gaveta): o céu parado. `poucos` (o padrão; sem arquivo, ilegível ou valor desconhecido também): no app, só as estrelas que piscam em degraus de 1 s e as nuvens em passinhos de 0,5 s, sem cadentes, halo, fagulhas ou brilhos; nas páginas, 2 quadros por segundo. `completo`: tudo, como antes (12 quadros por segundo nas páginas). Medido em 18/11/2026: com o tema do app no completo, o app gastava ~68% de CPU contra ~18% com o tema desligado; num Chrome à parte, a noite foi de ~18% (completo) para ~5% (poucos) e ~3% (nenhum). Grava a gaveta de temas: o Painel (`POST /efeitos`, formulário `efeitos=nenhum|poucos|completo`, só da própria origem, 204; outro valor, 400) e o painel de contas (`POST /api/efeitos`, JSON `{ "efeitos": "…" }` com a guarda das ações); `por` é `painel` ou `cotas`. As duas páginas saem com `data-efeitos="nenhum|poucos|completo"` no `<html>` (o `GET /api/ceu` do contas também o devolve), e `ceu.js`/`ceu-dia.js` o seguem sem recarregar. A barra relê o arquivo a cada 2 s com o `tema-do-app.json`, troca a cena do app e, em `nenhum`, para também as estrelas da própria barra.

**Gaveta de temas** (`BOTAO_DE_TEMAS`, `GAVETA_DE_TEMAS` e `ligarGavetaDeTemas` de `tema.js`): o botão do canto esquerdo do topo abre um `<dialog>` com três chaves — tema do Claude, tema do painel e os dois (indeterminada quando só um está ligado; com os dois ligados desliga os dois, senão liga os dois) — e os três níveis de **Efeitos do céu** (`ligarEfeitos`, rádio: Mínimo, Poucos efeitos, Completo). A chave muda o atributo na hora e volta atrás, com o erro na gaveta, se a gravação falhar. Fecha pelo X, pelo fundo e por Esc; com ela aberta o Painel não recarrega.

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

`sessao` é quem perguntou e recebe a resposta da página: o `--sessao`, senão a sessão do app que rodou o `perguntas nova` (`CLAUDE_CODE_HOST_SESSION_ID`), senão a dona gravada no item.

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
  "historico": [{ "etapa": "planejamento", "em": "ISO-8601" }],
  "andamento": { "feito": "texto", "falta": "texto", "em": "ISO-8601" },
  "criadoEm": "ISO-8601",
  "atualizadoEm": "ISO-8601"
}
```

`etapa`: `planejamento` · `execucao` · `revisao` · `pr` · `feito` · `parado` · `descartado`.

`historico` ganha uma linha só quando a etapa muda (`item nova`, `item etapa`, `item entregar`); o cartão da sessão no Painel soma o tempo de cada etapa (a que repete soma; a atual conta até agora). Item anterior ao registro não tem `historico`: o cartão diz "Sem registro das etapas" até a próxima mudança. `andamento` é o resumo que a dona passa com `--feito`/`--falta` em `item etapa` ou `item andamento` (o que não vier mantém o anterior); ausente, o cartão pede o resumo.

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

### `sessoes-do-app.json`

```json
{ "lidoEm": "ISO-8601", "por": "local_…", "sessoes": [ { "sessionId": "local_…", "title": "ICH-F7 · tema", "cwd": "…", "originCwd": "…", "isArchived": false, "isRunning": true, "prNumber": 12, "prState": "OPEN", "lastActivityAt": "ISO-8601", "link": "claude://…" } ] }
```

O status ao vivo das sessões, que só o app enxerga. O mod da barra de toda sessão aberta, a cada 60 s, lê `list_sessions` (até 50) e a própria sessão (`get_session self`, que a lista não traz, vem primeiro) e grava por cima, de forma atômica (`.tmp` e `mv`). Arquivo com `lidoEm` de menos de 50 s: não lê de novo (outra sessão acabou de gravar). Falha da leitura não apaga o arquivo. A página casa a sessão com o item pelo `sessao` do item; quando esse id não está na lista ou está arquivado (gravado com o id do transcript, ou a dona foi reaberta), vale a sessão aberta do mesmo projeto cujo título começa pelo código do item (`IZA-F48 · …`, ICH-F38). Com `lidoEm` de mais de 3 min, ela só mostra a idade e não deduz parada nem "rodando". Nada disso entra no contexto do modelo.

### `orquestradoras.json`

```json
{ "<projeto>": { "sessao": "local_…", "em": "ISO-8601" } }
```

A sessão do app que tem o papel de orquestradora em cada projeto. `perguntas papel orquestradora` grava (com o `CLAUDE_CODE_HOST_SESSION_ID` de quem roda), e o início de toda sessão com o papel regrava, inclusive depois do /clear.

### `pedidos/<uuid>.json`

O navegador não alcança as ferramentas do app; o mod da `barra` alcança. A página grava o pedido e o mod de qualquer sessão viva o executa.

```json
{ "tipo": "abrir-sessao", "sessao": "local_…", "texto": null, "criadoEm": "ISO-8601" }
{ "tipo": "responder", "sessao": "local_…", "texto": "…", "reserva": { "sessao": "local_…", "texto": "…" }, "criadoEm": "ISO-8601" }
```

**Para quem vai a resposta.** A sessão que perguntou, se `sessoes-do-app.json` (fresco) a mostra aberta. Arquivada, apagada ou pergunta sem sessão: a orquestradora do projeto, a de `orquestradoras.json` se aberta, senão a sessão aberta do projeto com "orquestradora" no título; o texto diz que a dona não vai receber e pede que ela aja. Com a leitura do app velha, vai à que perguntou com a orquestradora em `reserva`: se o app recusar a entrega porque a sessão está arquivada ou não existe, a barra manda o `texto` da reserva a ela. Sem ninguém, nenhum pedido: a resposta fica para `perguntas novidades`.

`tipo`: `responder` (manda `texto` à sessão como mensagem) · `abrir-sessao` (foca a sessão da pergunta; a página não grava mais esse pedido desde a ICH-F34, porque o app só foca a própria sessão — a barra ainda o aceita). O mod toma o pedido renomeando-o para `pedidos/tomados/` (só um mod ganha), executa e apaga; falha vai a `pedidos/falhos/` com o motivo. Pedido de mais de 30 min é descartado.

Pedido vencido ou inválido também vai a `falhos/` com o motivo (fica o rastro). O nome do arquivo segue `[A-Za-z0-9_-]+.json` e `sessao` segue `local_[A-Za-z0-9-]+`. **Limite do app:** `abrir-sessao` usa `open_session_in` com `target: "focus"`, que só mostra a própria sessão (`self`) ou uma que a sessão que tomou o pedido abriu, e só age com essa sessão na tela; fora disso o app diz que não mudou nada e o mod registra o texto no log.

### Kit novo (leitura de fora da pasta de estado)

O Painel compara o que está instalado com a `main`, sem gravar nada em `ICHIKAWA_HOME` (`lib/kit.mjs`):

- **Lê** `~/.claude/plugins/installed_plugins.json` (ou `$CLAUDE_CONFIG_DIR/plugins/…`), só as chaves `<plugin>@ichikawa-plugins`. Instalação de escopo `local` ou `project` cuja pasta de projeto já não existe fica de fora.
- **Compara** por conteúdo, não por commit. O clone do marketplace que o Claude guarda (`plugins/marketplaces/ichikawa-plugins`) é raso. Por isso cada arquivo de `git ls-tree -r origin/main -- plugins/<plugin>/` é comparado, pelo hash de blob do git, com o arquivo da pasta instalada (`installPath`). Arquivo a mais na pasta instalada (`.in_use`, tipos gerados) não conta.
- **Busca a `main`** com `git fetch --depth=1 origin main` no clone, no máximo uma vez a cada 30 min. Isso só mexe em `refs/remotes/origin/main`, não no `HEAD` nem nos arquivos. A comparação local roda no máximo uma vez por minuto, disparada pela carga da página e sem esperar por ela: o resultado aparece no recarregamento seguinte. Falha do git ou da rede: nada aparece.
- **Mostra** um `<div class="aviso-kit">` no topo, com o botão **Atualizar**.
- **Atualiza** por `POST /atualizar-kit`, aceito só da própria origem; outra origem recebe 403.
  - O pedido não carrega nada: a página roda os passos das instalações que ela mesma achou velhas, um de cada vez, e para no primeiro que falhar.
  - Os passos são `claude plugin marketplace update ichikawa-plugins` e, para cada instalação velha, `claude plugin update <plugin>@ichikawa-plugins`. A de projeto roda de dentro da pasta do projeto, com `--scope <escopo>`.
  - Cada passo tem prazo de 2 min e roda sem stdin.
  - Respostas:
    - `200 {ok:true}`;
    - `409` sem plugin velho ou com uma atualização já em curso;
    - `500 {ok:false, erro, comando}` quando um passo falha. Nesse caso a página mostra o motivo e o comando inteiro para rodar no terminal.
  - Depois, a conferência esquece o resultado e confere de novo na próxima carga.

## Botões da barra: `barra.json`

Cada plugin que quer botão na barra traz um `barra.json` na raiz dele (ao lado de `.claude-plugin/`). A `barra` lê o arquivo de cada plugin **instalado e ligado** e mostra os botões. Plugin desligado ou ausente não aparece.

```json
{
  "botoes": [
    {
      "id": "perguntas",
      "rotulo": "Painel",
      "icone": "◫",
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
- `icone` (opcional): um glifo (até 2 caracteres, sem espaço) desenhado antes do rótulo, como `◫`. O app desenha o botão nativo, só com texto: por isso glifo, não SVG. Sem ele, ou inválido, a barra põe `✦`.
- `ordem`: menor fica à esquerda. Os botões próprios da barra (cache, ausente, sessões) vêm antes de todos.

## Branches dos projetos

- `develop` é o tronco de trabalho: toda branch nasce dela e todo PR de trabalho entra nela, por squash.
- `main` é produção. Só recebe o release (avanço rápido da `develop`), e o push na `main` dispara o deploy.
- Projeto sem `develop`: o tronco é a `main`, e cada merge é release.

## Layout comum das páginas

Toda página local dos plugins (perguntas, contas e as que vierem) usa o mesmo visual: céu com o astro no rodapé, cartões de vidro, títulos em Geist, topo centralizado (selo, título, subtítulo) e duas colunas em tela larga.

- **A fonte é a página de perguntas**, `plugins/orquestracao/lib/publico/`: `estilo.css` (tokens, tipografia, topo, seções, botões, pé), `ceu.js`, `ceu-dia.js`, `planeta.js`, `tema.js` (o botão de tema) e `fontes/` (`geist-medium.woff2` com a licença `OFL-geist.txt`).
- As outras páginas levam **cópia idêntica** desses arquivos (o painel de contas, em `plugins/contas/src/painel/publico/`) e acrescentam só classes próprias num arquivo à parte (`perguntas.css`, `cotas.css`).
- O arquivo próprio usa só os tokens da base (`var(--…)`; tom translúcido por `color-mix`), sem cor solta: o tema troca os tokens em `estilo.css` e todas as páginas acompanham. Exceção: o preenchimento das barras de cota do painel de contas vai do verde ao vermelho pelo uso (`--matiz`, de 140 a 0, posto por `matizDoUso` de `regras.js` via `style.setProperty`), não pelo tema.
- **Dois céus, pelo botão de tema** (`tema.json` em `ICHIKAWA_HOME`, padrão `~/.claude/ichikawa`): escuro, sem arquivo ou ilegível, a noite (via láctea e planeta, os tokens de `:root`); claro, o dia (céu azul, nuvens e sol, os tokens de `:root[data-ceu="dia"]`). O servidor grava `data-ceu="noite|dia"` no `<html>` e põe o botão (`BOTAO_DE_TEMA` de `tema.js`) no canto do topo; `ligarBotaoDeTema` troca o atributo na hora e grava pela rota da página (Painel: `POST /tema`, formulário; contas: `POST /api/tema`, JSON com a guarda das ações). `ceu.js` desenha o céu pedido e troca sozinho quando o atributo muda. A escolha feita em outro lugar chega ao Painel no recarregamento de 30 s e ao painel de contas pelo `GET /api/ceu` de 10 s; a barra relê a cada 2 s e leva o tema do app junto (`tema-do-app.json`). A hora e o modo ausente não mudam o céu; o aviso de ausente do Painel continua.
- O arquivo próprio pode trazer ajustes só do dia sob `:root[data-ceu="dia"]` (ex.: tirar brilhos), nunca cor que valha só para um céu fora desse bloco.
- Mudar o visual é mudar a fonte e copiar nas outras no mesmo PR. `plugins/contas/src/painel/test/layout-comum.test.mjs` falha se as cópias divergirem.
