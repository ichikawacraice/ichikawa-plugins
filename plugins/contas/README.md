# contas

Painel local para quem usa várias contas no app desktop do Claude no Mac:

- **Cota de cada conta**: as janelas de 5 h e da semana, lado a lado, com a hora em que cada uma zera.
- **Troca de conta sem Sign out** e sem código por e-mail a cada troca.
- **As sessões do Code continuam na conta nova**: a lista de conversas vem junto, e as que estavam respondendo quando o app fechou são retomadas sozinhas.
- **Sessões ativas**: as conversas do Code mexidas nas últimas 24 h, com as que estão respondendo agora em destaque.

Tudo roda em `127.0.0.1`, sem dependência npm (Node ≥ 20, só módulos nativos).

## Instalar

```bash
claude plugin marketplace add ichikawacraice/ichikawa-plugins
claude plugin install contas@ichikawa-plugins
```

Com o plugin `barra` ligado, o botão **Contas** abre o painel. Sem o plugin, de dentro desta pasta: `node src/painel/cli.mjs` e `node src/troca/cli.mjs` (ou `npm link` para ter `painel-de-contas` e `trocar-conta` no PATH).

## Usar

```bash
painel-de-contas            # sobe o painel em http://127.0.0.1:4791 e abre o navegador
```

| No painel | O que faz |
|---|---|
| **Ler cota** | Pede uma vez ao macOS a senha "Claude Safe Storage" do Keychain (clique em **Permitir**, não em Permitir Sempre) e lê a cota de todas as contas guardadas. A senha fica só na memória do painel. |
| **Adicionar conta** | Guarda a conta aberta, fecha o app e o abre na tela de entrada. Entre com a outra conta (código do e-mail, uma vez por conta); o app volta sozinho para a conta de antes. |
| **Trocar para esta** | Fecha o app, põe o login da conta escolhida, traz a lista de conversas e abre o app de novo (uns 5 s). |
| **Dar nome** | Dá um nome à conta na lista. |
| **Sincronizar lista** | Deixa a lista de conversas da conta aberta igual à das outras contas. |

O mesmo pelo terminal: `trocar-conta --ajuda`.

### Vindo do kit de orquestração

Se o kit já guardou os logins das suas contas, traga-os sem entrar de novo em cada uma:

```bash
trocar-conta importar-do-kit
```

Copia de `~/.claude/orquestracao/troca-de-conta/` os logins, os nomes e a última cota lida. A origem fica como estava. Depois disso as duas instalações seguem separadas: use uma só para trocar de conta, senão o login guardado numa envelhece enquanto a outra troca.

### Como plugin do Claude Code (`contas`)

O repositório também é o plugin `contas`: o botão **Contas** da barra (`barra.json`) roda `node src/painel/abrir.mjs`, que sobe o painel desacoplado se ele não estiver no ar e abre o navegador (o mesmo que `abrir-painel-de-contas`). A skill `trocar-conta` lista as contas e abre o painel, mas nunca troca de dentro da sessão: a troca fecha o app.

## O que você precisa saber

- **Nunca use Sign out no app para trocar de conta.** Ele invalida o login guardado daquela conta.
- **A troca fecha o app.** Rode o painel de um terminal, não de dentro do Code do app.
- **Login guardado envelhece.** Se o app pedir para entrar de novo depois de trocar, entre com o código do e-mail e use **Adicionar conta** com ela aberta.
- **O app pode mudar o formato dos arquivos** numa atualização. Se o `config.json` não estiver no formato esperado, a troca recusa sem gravar nada.
- **Termos de uso:** ter várias contas não é proibido; usar contas para contornar limite pode ferir as regras do plano. Por isso não há troca automática.

## O que grava e onde

Pasta de dados: `~/.claude-account-switcher/` (troque com `TROCA_DE_CONTA_DIR`). Pastas `0700`, arquivos `0600`.

| O quê | Onde |
|---|---|
| Login de cada conta (3 chaves do `config.json` + `Cookies`, cifrados como o app os gravou) | `contas/<conta>/` |
| Nomes das contas (sem token) | `estado.json` |
| Backup do `config.json` e do `Cookies` antes de cada troca (10 últimos) | `backups/<data>/` |
| Última cota lida de cada conta e o e-mail (sem token) | `uso.json` |
| Desfecho da última ação, lido pelo painel | `ultima-acao.json` |
| Conversas tiradas da lista por terem sido apagadas em outra conta | `lista-reserva/` |

A lista de conversas fica onde o app a guarda (`~/Library/Application Support/Claude/claude-code-sessions/`). O conteúdo das conversas (`~/.claude/projects`) nunca é tocado.

## Desenvolver

```bash
npm test
```

## Créditos

A lógica de troca é um port para Node do [Claude Account Switcher](https://github.com/SnlperStripes/claude-account-switcher) de SnlperStripes (Apache-2.0); veja [`NOTICE`](NOTICE).
