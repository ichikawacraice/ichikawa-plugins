# F6 · Donas falam enxuto

**Pedido.** O operador lê o andamento pela orquestradora; as donas devem gastar o mínimo de tokens em texto no chat, no espírito do [Caveman](https://github.com/JuliusBrussee/caveman) (Apache-2.0).

**Pronto quando.** Regras de escrita enxuta na skill `dona` (e uma linha em `regras.md`), em PT-BR; texto normal no que outra pessoa lê fora do chat (commit, PR, ADR, plano, pergunta ao operador, entrega do `perguntas item entregar`); atribuição em `docs/terceiros.md`; medição antes/depois numa tarefa de exemplo; PR para `develop` mergeado.

## O que o Caveman economiza de fato

- **Economiza: tokens de saída** — o texto que o modelo escreve no chat (abertura, narração entre ferramentas, recapitulação, frases de cortesia). No benchmark do próprio Caveman (10 perguntas, Opus 5.5): sem instrução 6.983 tokens de saída; "Answer concisely." 4.334; `/caveman` 4.119. Ou seja, a maior parte do ganho vem de pedir concisão; as regras do Caveman somam pouco a mais.
- **Não economiza: leitura.** Arquivo lido, saída de ferramenta, log, diff, o próprio prompt do sistema e as skills carregadas continuam do mesmo tamanho. Numa sessão de dona, isso é a maior parte do contexto. O Caveman tem compressores de leitura (proxy, `caveman-compress`), que este item não traz.
- **Custa entrada:** as regras entram no contexto. Por isso o texto aqui é curto (~250 palavras) e fica só na skill `dona`, não no `regras.md` inteiro, que vai para toda sessão.
- **Pensamento (thinking) não muda:** a regra é sobre o texto visível.

## Decisões

- Texto próprio em PT-BR, inspirado nas regras do Caveman; nenhum trecho traduzido literalmente. Atribuição em `docs/terceiros.md` como origem da ideia; sem NOTICE porque não há texto deles (*assumida, a confirmar*).
- Sem o tom "homem das cavernas" (cortar artigos, fragmentos): em PT-BR isso prejudica a leitura e economiza pouco. Fica o essencial: resultado primeiro, sem narração, sem recapitulação, uma ideia por frase, conteúdo técnico literal (*assumida, a confirmar*).
- Em `regras.md`, só uma linha apontando para a skill (o arquivo entra em toda sessão).

## Tarefas

1. Seção "Escrita enxuta" na skill `dona`. Risco: não.
2. Uma linha em `regras.md` (Comunicação). Risco: não.
3. Linha do Caveman em `docs/terceiros.md`. Risco: não.
4. Medição: mesma tarefa de leitura no repo com `claude -p --output-format json`, 3 rodadas com e 3 sem a seção, comparando `usage.output_tokens` e o tamanho da resposta. Resultado em `docs/medicoes/2026-11-13-donas-enxutas.md`. Risco: não.
5. Teste: a skill `dona` contém a seção e as exceções. Risco: não.
