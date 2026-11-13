# Medição · Donas falam enxuto (F6)

13/11/2026, Claude Code 2.1.319, `claude-opus-5-5`, neste repositório.

## Tarefa de exemplo

Só leitura (Read, Grep, Glob), mesmo pedido em todas as rodadas: "Você é a dona de um item neste repositório. Descubra quais hooks do plugin orquestracao rodam antes de uma ferramenta (PreToolUse) e o que cada um bloqueia ou avisa; diga ao operador se algum deles impediria um `git commit --no-verify`. Só leia; não edite nada."

- **Antes:** sem nada a mais.
- **Depois:** a seção "Escrita enxuta" da skill `dona` passada em `--append-system-prompt`.
- Contagem: `usage.output_tokens` do resultado (inclui pensamento e chamadas de ferramenta) e caracteres do texto visível (`stream-json`, blocos `text`).

## Resultado

| Cenário | Rodadas | Tokens de saída (média) | Texto visível (média, caracteres) |
|---|---|---|---|
| Estilo Concise ligado (o padrão do operador), antes | 6 | 2.536 | 2.668 (3 rodadas `json`) / 2.428 (3 `stream-json`) |
| Estilo Concise ligado, depois | 6 | 2.586 | 2.452 / 2.545 |
| Estilo padrão (`outputStyle: default`), antes | 3 | 3.077 | 3.275 |
| Estilo padrão, depois | 3 | 2.595 (**−16%**) | 2.825 (**−14%**) |

Rodadas individuais — Concise antes: 2.240, 2.330, 2.916, 2.458, 2.558, 2.712; depois: 2.574, 2.684, 2.517, 2.534, 2.380, 2.825. Padrão antes: 3.345, 2.956, 2.930; depois: 2.573, 2.519, 2.692.

## Leitura

- **Com o estilo Concise e o CLAUDE.md do operador, a regra não muda nada medível.** A diferença (+2%) está dentro da variação entre rodadas (2.240 a 2.916). Esses dois já cortam abertura, recapitulação e narração: todas as rodadas tiveram um único bloco de texto, sem nada entre as ferramentas.
- **Sem o estilo Concise, a regra corta ~16% da saída** (~480 tokens nesta tarefa). É a proteção para dona aberta numa máquina ou conta sem esse estilo.
- **Custo de entrada:** a seção soma ~1.370 tokens de leitura de cache numa sessão de 9 turnos (141.466 → 142.837), barato no cache, mas é custo fixo de toda dona.
- **O que não muda:** leitura de arquivo e saída de ferramenta (~141 mil tokens de contexto por rodada, contra ~2,5 mil de saída). É aí que está a maior parte do gasto de uma dona; o Caveman trata isso com compressores de leitura, fora deste item.
- **Limite da medição:** uma tarefa só, de leitura, com resposta que é em boa parte relatório ao operador (que a regra manda manter completo). Sessão longa, com muita narração entre ferramentas, não foi medida.

Custo das 18 rodadas: ~US$ 7,60.
