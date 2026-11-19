---
name: testes-enxutos
description: Testes que custam pouco e não mentem — escrever só o teste que paga a si mesmo, rodar no PR só o que o diff alcança e a suíte inteira no gate do release, medir o tempo por arquivo, paralelizar pelo custo e acabar com o teste instável. Use ao montar ou revisar a estratégia de testes de um projeto (projeto novo, ou CLAUDE.md sem comando de testes afetados), quando a suíte ou o teste do PR ficou lento, quando um teste falha às vezes, ou antes de escrever muitos testes de uma vez. Para o ciclo de um teste, `orquestracao:tdd`; para tela, `orquestracao:testes-de-tela`.
---

# Testes enxutos

Teste é custo: cada arquivo cobra em todo PR, em toda máquina, para sempre. O objetivo não é ter muito teste, é saber em poucos minutos se a mudança quebrou algo. Isso pede duas coisas: escrever menos e melhor, e rodar só o que a mudança pede.

As regras saem do que um projeto do kit (Izanagi) mediu ao sair de PR de 9 min e suíte de 40 min. Nos últimos 100 PRs, o worker gasto caiu de 37,9 h para 8,5 h e a falha intermitente foi de 6% a 0. Os números de lá são de lá. Reaproveite a forma e meça os seus.

## As três camadas

| Camada | O que roda | Quando |
|---|---|---|
| **Conserto** | O arquivo ou o caso que você está mexendo (`vitest run caminho -t nome`) | A cada ciclo do `orquestracao:tdd` |
| **Teste do PR** | Os testes que o diff alcança, mais o typecheck | Antes do push, e é o que vai no corpo do PR |
| **Gate do release** | A suíte inteira, sem cache | Antes da `develop` ir à `main` (CI ou local, conforme o projeto) |

O que o teste do PR deixa de rodar não some: o gate do release pega. Por isso dá para ser enxuto no PR sem medo. E por isso o gate do release nunca é pulado.

## Escrever menos e melhor

- **Um teste por comportamento que alguém de fora percebe.** Se o typecheck já pega o erro (forma de objeto, contrato entre pacotes), o teste não paga.
- **Não teste o mock.** Afirmar que um dublê foi chamado N vezes testa o dublê.
- **Não teste a biblioteca.** Zod, o ORM e o React já têm testes.
- **Antes de escrever, procure o teste que já cobre aquilo.** Teste repetido custa em dobro e quebra em dobro.
- **O teste paga só pelo que afirma.** Efeito executado e não afirmado (subir CLI, rede, build, navegador) é custo e variância. Ou o teste afirma o efeito, ou deixa de executá-lo. Subir o prazo esconde o problema.
- **Espera de produção vira opção.** Atraso, retentativa e intervalo de sondagem entram como parâmetro com o padrão de hoje, e o teste passa o curto. Um teste fixa os padrões. A exceção é o caso que mede o próprio atraso.
- **Reaproveite o caro dentro do arquivo:**
  - um navegador por arquivo, não por caso;
  - o repositório de teste montado uma vez e copiado por caso;
  - a leitura grande memoizada.
- **Arquivo caro importa direto o módulo que prova,** não o `index.ts` do pacote. Importar o barril avalia o pacote inteiro, e qualquer mudança nele acorda o teste.
- **Divida o arquivo-monstro.** O piso de tempo de um pacote é o seu arquivo mais longo: 700 s num arquivo só não paralelizam. Separe por fluxo, com um helper de setup comum.
- **Ponta a ponta é para o fluxo que só existe inteiro** (checkout, login). Regra de negócio se prova embaixo, em teste de unidade.
- **Snapshot grande não prova nada.** Ninguém lê o diff dele, e ele quebra a cada mudança de forma.

## Sem teste instável

- **Espere o evento ou o estado, nunca um intervalo de relógio.** Sob carga, 20 ms viram 200 ms, e o evento continua sendo o evento. Use `await vi.waitFor(...)`, `findBy*`, a promessa do próprio código, ou `vi.useFakeTimers()` quando o tempo é o assunto.
- **O dublê não avança sozinho.** O servidor falso muda de estado quando o teste manda (`tick()`), não a cada leitura.
- **O prazo do teste serve para pegar o teste pendurado, não o lento.** Use algo como 15× o caso mais caro. Prazo apertado mede a máquina, não o código.
- **Todo subprocesso de teste tem `timeout` e `killSignal: 'SIGKILL'`,** inclusive `git`, shell e navegador. O relógio do runner não corta uma chamada síncrona.
- **O servidor de teste escuta em `127.0.0.1` explícito.** `listen(0)` em `::` deixa outro processo tomar a porta.
- **A porta é a 0, nunca sorteada.** Sorteio numa faixa colide com a suíte de outra sessão (`EADDRINUSE`) e pode cair numa porta que o `fetch` recusa (5060, 5061, 6000…: `bad port`). O código que precisa saber a própria porta lê `server.address().port`. No kit, isso derrubava 12% das rodadas sob carga.
- **Dependência fora do git é precondição declarada e afirmada** antes de medir (variável, binário, banco). Sem isso, o verde quer dizer "esta máquina", não "este código".
- **Consertou um teste instável? Prove sob carga, com controle:** N rodadas da versão nova lado a lado com a velha. Flake consertado sem controle foi só sorte.

## Montar no projeto, em degraus

Comece no degrau que o projeto pede hoje e suba quando a medição mandar. Em todos, o `CLAUDE.md` do projeto declara quatro comandos e um ponto cego: o de um arquivo, o de testes afetados, o typecheck, o do gate do release, e o que a seleção de afetados não enxerga. As skills do kit leem esses comandos de lá.

### Degrau 0 — projeto pequeno (suíte inteira em menos de ~1 min)

Os testes afetados podem ser a suíte inteira. Declare isso no `CLAUDE.md`: "testes afetados = `npm test` (a suíte leva ~40 s)". Suba de degrau quando passar de ~2 min.

### Degrau 1 — pelo grafo de import

Copie [`modelos/testes-afetados.mjs`](modelos/testes-afetados.mjs) para `scripts/` e crie `"test:afetados": "node scripts/testes-afetados.mjs"`.

- O script pega o diff do merge-base com o tronco até o worktree (o não commitado incluso) e roda `vitest related`.
- Quando não sabe, roda tudo: mexeu em `package.json`, lockfile, `tsconfig`, config do vitest ou apagou código.
- Sempre diz o que escolheu e por quê. Diff vazio diz "nada mudou".
- Com `node:test`, a seleção equivalente é por pasta (o teste do pacote que mudou). Escreva a tabela no próprio script e recaia na suíte inteira para o que a tabela não conhece.

**O ponto cego, que vai escrito no `CLAUDE.md`:** o grafo de import não vê leitura por caminho (`readFileSync`, `readdir`, glob, fixture, doc) nem subprocesso. Se o projeto tem teste que lê doc ou pasta, o diff só nesse arquivo não acorda o teste.

**Suba ao degrau 2** quando:
- o gate do release pegar um vermelho que o teste do PR deixou passar por esse ponto cego;
- ou o teste do PR passar de ~5 min mesmo com a seleção.

### Degrau 2 — pelo registro de leituras

Cada arquivo de teste deixa, fora do git, o que de fato carregou, leu, listou e lançou. O seletor cruza esse registro com o diff. É o que o Izanagi usa (ADRs 0556 e 0725), extraído para o kit sem o que era só de lá.

**Montar.** Copie os três modelos para `scripts/` (e o `os-lentos.mjs` do degrau 3, se quiser o corte dos caros):
- [`modelos/registro-de-leituras.mjs`](modelos/registro-de-leituras.mjs): o formato e as regras;
- [`modelos/registro-de-leituras.setup.mjs`](modelos/registro-de-leituras.setup.mjs): o `setupFiles` que grava;
- [`modelos/testes-afetados-pelo-registro.mjs`](modelos/testes-afetados-pelo-registro.mjs): o seletor.

No config do vitest:

```js
import { registroDeLeituras } from './scripts/registro-de-leituras.mjs';
export default defineConfig({ test: { setupFiles: [...registroDeLeituras().setupFiles] } });
```

Depois, `"test:afetados": "node scripts/testes-afetados-pelo-registro.mjs"` no `package.json`. Rode a suíte inteira uma vez para gravar o registro; sem registro, o seletor roda tudo. Medido com vitest 2, 3, 4 e 5.

Ajuste no topo do seletor o que é do projeto:
- `ehArquivoDeTeste` e `EXCLUIR`, iguais ao `include` e ao `exclude` do vitest. Um spec do Playwright fora do `EXCLUIR` entra como `sem-registro` em todo PR;
- `ALIASES` e `BARRIS`, para os cortes;
- `TESTES_VITEST`, o comando (num monorepo pnpm, `"pnpm vitest"`).

O tronco é `origin/develop`, `origin/main` ou `origin/master`. Sem nenhum deles, o seletor para e pede `--base`, em vez de comparar com o `HEAD` e dizer "nada mudou".

**Como o registro é gravado:**
- o setup envolve `fs`, `fs/promises` e `child_process`, e chama `syncBuiltinESMExports()`;
- os módulos carregados vêm do estado do worker do vitest; versão que o modelo não conhece grava a entrada como `cega`, e o seletor roda esse teste sempre;
- o estado zera no setup, antes do import do arquivo de teste, porque a leitura feita no topo do módulo e no `it.each` conta;
- a gravação acontece no `afterAll`, com um JSON por teste em `<git-common-dir>/registro-de-leituras/`, que serve a todos os worktrees;
- desligado no CI e com `SEM_REGISTRO_DE_LEITURAS=1`;
- o registro nunca reprova o teste: falha nele vira aviso no stderr.

**Por que um teste entra**, sempre com o motivo dito:
- está no diff (`no-diff`);
- é novo ou nunca rodou nesta máquina (`sem-registro`);
- leu ou carregou um caminho do diff (`le:<caminho>`);
- listou a pasta de um arquivo adicionado ou apagado (`lista:<pasta>`);
- lança subprocesso sobre o repositório (`subprocesso`).

**Subprocesso declara o que o filho lê.** O registro não vê o que o filho lê. Quem lança `node` ou shell sobre o repositório escreve no próprio teste `// o-filho-le: scripts/**, {docs,guias}/*.md`. Com a declaração, o teste entra quando o diff casa com um glob. Sem ela, entra em todo PR, e o seletor diz o nome dele. Glob que não casa com nenhum arquivo é apontado, porque tiraria o teste do PR para sempre.

**Quando não sabe, roda mais:**
- diff que mexe no runner (`package.json`, lockfile, `tsconfig`, config do vitest, os três scripts) roda a suíte inteira;
- registro vazio roda a suíte inteira;
- import por alias que o seletor não conhece desliga o corte do caro;
- a marca de subprocesso não vence enquanto o teste não roda de novo: o teste adiado não some da seleção.

**O seletor fala.** Ele diz quantos testes de quantos rodam e o motivo de cada um, o que fica para o release, o caminho do diff que nenhum teste lê e quem encareceu a seleção acima do teto. `--so-listar` imprime o JSON sem rodar. Diff vazio e seleção vazia são ditos, não um verde mudo.

**Cortes que mandam para o release** (só depois de medir):
- o teste caro (mediana ≥ `CARO_A_PARTIR_DE_MS` no `.tempos/` do degrau 3) que não importa direto o que mudou. Ponha os aliases do projeto em `ALIASES`;
- o teste que só alcança o diff pelo barril de outro pacote (`BARRIS`, vazio por padrão). O contrato fica com o typecheck.

**Com `node:test`** não há worker com a lista de módulos: o caminho é um `--import` que envolva `fs`, `child_process` e os hooks do loader. O kit ainda não tem esse modelo. Fique no degrau 1 por pasta.

### Degrau 3 — tempo e paralelismo

- **Grave o tempo por arquivo em toda rodada,** verde ou vermelha: `--reporter=json --outputFile.json=.tempos/<ts>.json`, com `.tempos/` no `.gitignore`. [`modelos/os-lentos.mjs`](modelos/os-lentos.mjs) mostra a mediana das últimas rodadas e quanto do total os primeiros arquivos levam. Costuma ser 1% dos arquivos levando metade do tempo.
- **Meça antes de mexer, e meça antes e depois na mesma máquina,** com a carga anotada. Use a mediana de várias rodadas, nunca uma rodada só.
- **Workers pelo custo da seleção:** `⌈custo medido / alvo por worker⌉`, com piso e teto. A seleção pequena não reserva a máquina.
- **O teto de workers é da máquina, não do processo.** Várias sessões e agentes rodam testes ao mesmo tempo, e cada uma pegar metade dos núcleos derruba todas.
- **No vitest, `maxWorkers` vai sempre com `minWorkers`.** Sem o par, há versão que sai com "no tests".
- **No CI, fatie por arquivo** (`--shard=i/N`) numa matriz com `fail-fast: false` e um job agregador com `if: always()` como check obrigatório. Cada fatia paga o setup de novo: simule antes de escolher N.

## Banco local (Supabase/Postgres)

- **No banco local compartilhado entre worktrees, aplique só a migration que já está no tronco.** Migration de PR aberto cega os testes das outras branches.
- **Teste de banco pula só quando o banco está atrás da árvore.** Com o banco à frente, ele mede e diz quais migrations sobram.
- **Teste de banco não depende de ordem nem de dado de outro teste.** Cada um cria o que usa, com um prefixo único, e não apaga o que não criou.

## Diagnóstico de um projeto que já existe

1. **Leia o `CLAUDE.md` e o `package.json`.** Há comando de testes afetados? Quanto leva a suíte? Onde roda o gate completo?
2. **Meça uma rodada da suíte com o reporter JSON.** Rode o `os-lentos` e anote: o tempo total, os 10 piores arquivos e a fração que eles levam.
3. **Para cada um dos piores, ache a causa:**
   - `sleep` ou espera de produção;
   - rede ou CLI de verdade;
   - navegador ou repositório montado por caso;
   - arquivo-monstro;
   - import do barril (o tempo de coleta aparece alto);
   - banco recriado por teste.
4. **Escreva o plano** (`orquestracao:planejar`):
   - o degrau de seleção a montar;
   - os consertos dos piores, um por tarefa, cada um com o tempo antes e depois;
   - as linhas do `CLAUDE.md` com os quatro comandos e o ponto cego.
5. **Mudar a estratégia de testes é decisão de arquitetura:** vira ADR (`orquestracao:adr`), com os números medidos.

## Cada regra com uma guarda

Regra escrita não segura a próxima sessão. A regra que importa ganha um teste que lê os arquivos de teste e reprova quem a quebra. Exemplos:
- `setTimeout` ou `sleep` com número em arquivo de teste;
- `execFileSync` sem `timeout`;
- `listen(0)` sem host;
- porta sorteada com `Math.random()`;
- declaração `o-filho-le` cujo glob não casa com nada.

Duas listas que precisam concordar (a dos caros e a do CI, o setup e as configs) também ganham um teste que lê as duas.

## Armadilhas

| Pensamento | Realidade |
|---|---|
| "É só doc, não roda teste" | Se algum teste lê aquele doc, roda. Deixe a seleção decidir; não pule na mão. |
| "Rodo a suíte inteira para garantir" | É do gate do release. No PR, os afetados e o typecheck. |
| "Subo o prazo e passa" | O prazo pega o teste pendurado. Teste lento se conserta pela causa. |
| "Falhou uma vez, rodei de novo e passou" | Teste instável é bug. Ache o relógio que ele espera. |
| "Escrevo um teste por função" | Um por comportamento. Função interna se prova pelo comportamento de fora. |
| "A seleção não achou nada, então está verde" | "Nada para rodar" e "rodou e passou" precisam sair diferentes. |
| "O teste lento é lento mesmo" | Meça a coleta e o setup em separado: quase sempre é import, navegador ou espera. |
