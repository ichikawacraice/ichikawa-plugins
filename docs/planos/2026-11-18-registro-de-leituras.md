# Registro de leituras como ferramenta do kit (ICH-F44)

**Pronto quando:** PR mergeado na `develop` com o gate completo verde, release feito e a entrega gravada.

## Forma: modelo para copiar (recomendada; *assumida, a confirmar*)

| Opção | A favor | Contra |
|---|---|---|
| **Modelos em `skills/testes-enxutos/modelos/`** | Igual aos degraus 1 e 3; roda no CI e no terminal sem o kit; o projeto ajusta números e tabelas que são dele | Conserto no kit não chega sozinho às cópias |
| Bin do plugin | Atualiza com o kit | O `PATH` do plugin só existe dentro da sessão do Claude; o `setupFiles` do vitest apontaria para `~/.claude/plugins/cache/<sha>/…`, que muda a cada versão; o CI não tem o kit |
| Pacote npm | Versão e atualização normais | Publicar fora é decisão do operador, e o kit não tem npm hoje |

O registro é preso ao runner do projeto (setup do vitest, config, versão). Por isso o modelo copiado é a forma certa. Cada arquivo leva no cabeçalho a origem e a data, para quem quiser comparar com a versão do kit.

## Arquivos

- `plugins/orquestracao/skills/testes-enxutos/modelos/registro-de-leituras.mjs`: o formato, as regras de caminho, a classificação de subprocesso, os módulos vistos pelo worker do vitest (v1–v4, por API interna conhecida; quando não acha, a entrada sai `cega`) e o `registroDeLeituras()` para o config. Só Node, sem vitest.
- `.../modelos/registro-de-leituras.setup.mjs`: o `setupFiles` (envelope em `fs`, `fs/promises`, `child_process`; zera no setup; grava no `afterAll`; nunca reprova).
- `.../modelos/testes-afetados-pelo-registro.mjs`: o seletor. Diff do merge-base até o worktree; recaída para a suíte inteira quando muda o runner; motivo por arquivo; `o-filho-le`; corte de caro pelo `.tempos/` do `os-lentos` (só com medida); corte de barril opcional (`BARRIS`, vazio por padrão); fala o que escolheu, o que ninguém lê e o glob morto; `--so-listar`.
- `plugins/orquestracao/tests/registro-de-leituras.test.mjs`: a lógica pura.
- `SKILL.md` (degrau 2) e `README.md` da raiz (linha da skill).

## O que sai do Izanagi

Nomes de pacote e `PACOTES`, a tabela do ADR 0389 (a recaída vira suíte inteira), as filas e as fichas, o `historico.jsonl` (o custo vem do `.tempos/` do degrau 3), os workers pelo custo (fica no degrau 3 como regra; `minWorkers` mudou entre versões do vitest), as variáveis `IZANAGI_*` (viram `REGISTRO_*`), a aceitação dos caminhos do kit antigo e a detecção do principal pelo `argv[1]`. Detecção genérica: o config roda só no processo principal; o helper grava o ambiente lá e os workers herdam.

## Tarefas

1. Testes da lógica pura primeiro (`node --test plugins/orquestracao/tests/registro-de-leituras.test.mjs`). Risco: não.
2. Os três modelos. Risco: não (não rodam no kit; só nos projetos que copiarem).
3. Fumaça com vitest 3 e 4 reais num projeto de rascunho: o registro grava módulo, leitura, listagem e subprocesso; o seletor escolhe pelo motivo certo. Risco: não.
4. Skill e README. Risco: não.
5. Gate completo, PR, merge, release, entrega.

## Fica de fora

- Variante `node:test` (`--import` com hooks de loader): descrita na skill como caminho, sem modelo.
- Limpeza dos vestígios no Izanagi: item à parte, com o ok do operador.
