# F5 · Orquestradora leve

Pedido (13/11/2026): a orquestradora virou painel; cada nota de dona gera uma rodada, então ela deve custar pouco — contexto inicial menor e limpeza sozinha quando o histórico cresce.

Pronto quando: medição de onde vem o contexto dela, alavancas reais conferidas, o possível implementado em `skills/orquestradora/SKILL.md` e hooks, PR mergeado na `develop`.

## Medição (13/11/2026, 11:30 SP)

Fonte: `get_usage` da orquestradora `local_ef96a6c5` (Opus 5.5, 30 min de vida) e desta dona; tamanhos com `wc -c`.

| Parte | Tokens | Controlável pelo kit? |
|---|---:|---|
| Mensagens (histórico) | 93.135 | **sim** — limpeza (abaixo) |
| Ferramentas MCP (navegador, Gmail, computer-use, docs…) | 19.375 | não pelo plugin; config do app/usuário |
| Ferramentas do sistema | 18.589 | não |
| System prompt (inclui `~/.claude/CLAUDE.md`, 4,2 KB) | 11.925 | só o CLAUDE.md, que é do operador |
| Lista de skills | 9.961 | em parte |
| Instruções de servidores MCP | 2.398 | não |
| **Total** | **158.459** | |

Base fixa de uma sessão nova: **~62 mil tokens**, igual em qualquer sessão do operador. O kit entra nela com:

- hook `inicio.mjs`: 3.242 B (≈ 0,9 mil tokens) — 3.092 B de `regras.md` + id da sessão + papel/ausente; vai como mensagem;
- skill `orquestradora`: 4,3 KB (agora 5,6 KB), lida uma vez ao assumir;
- descrições na lista de skills: orquestracao 10,6 KB + stack 8,3 KB + contas 0,3 KB; o app já trunca descrições quando a lista estoura (várias skills do kit aparecem só com o nome).

Outros plugins ligados no escopo user somam 9,6 KB de descrições: trailofbits (7 plugins) 5,6 KB, supabase 1,6 KB, impeccable 1,4 KB, claude-md-management/skill-creator/frontend-design 0,9 KB. Fora deles, o app injeta os plugins de claude.ai (product-management, engineering, productivity, anthropic-skills, cowork), que não estão no `settings.json`.

**Conclusão:** o que pesa e cresce é o histórico (59% aos 30 minutos). A base fixa é quase toda do app; o que o kit põe nela é ~2 mil tokens. A alavanca grande é limpar, não enxugar regra.

Cada rodada relê o contexto inteiro (em cache: 158.196 lidos do cache, 261 escritos na última). Com Opus 5.5 a US$ 4/MTok de entrada, a leitura de cache sai a ~10% disso — uma nota a 158 mil custa ~4× uma nota a 40 mil. No plano Max, a conta é a cota semanal (88% usada em 13/11).

## Alavancas conferidas

1. **Resposta de uma linha por nota** — feito na skill. Proíbe `list_sessions`, `get_status`, `perguntas` e releitura de transcript por causa de uma nota; o andamento completo só quando o operador pede.
2. **Limpar a própria sessão** — `clear_session` aceita `"self"`: a limpeza acontece ao fim do turno. Problema: o `/clear` troca o `session_id` do Claude Code, e o papel (`~/.claude/ichikawa/papeis/<session_id>`) se perderia — sem papel, a sessão nova não sabe que é orquestradora e a trava de edição desliga. Resolvido com `perguntas passar-papel` (grava `papeis/passagem.json` com a pasta) e o `inicio.mjs` herdando o papel na próxima sessão da mesma pasta em até 15 min (nunca num `resume`).
3. **Gatilho** — hook `Stop` novo (`orquestradora-limpa.mjs`): lê o `usage` da última resposta no transcript (mesmo número do `get_usage`: 158.459 conferido) e, só na orquestradora, acima de 110 mil (`ORQUESTRADORA_LIMPA_EM`), devolve `block` pedindo a limpeza. Pede uma vez por degrau de 40 mil; `stop_hook_active` evita laço. Nas outras sessões custa só a checagem do marcador (~25 ms).
4. **`/compact`** — não serve: o modelo não tem como chamá-lo, e ele gasta uma rodada resumindo um histórico que não faz falta. O autocompact do operador está em 89% de 300 mil (`CLAUDE_CODE_AUTO_COMPACT_WINDOW`) e continua como rede.
5. **Modelo (Sonnet × Opus)** — pergunta D20 (Q4 na página): recomendação Sonnet 5.5 na orquestradora, Opus nas donas; a troca é do operador, no menu de modelo (uma sessão não muda o próprio modelo).
6. **Plugins ligados por projeto** — desligar trailofbits e afins no `.claude/settings.local.json` da pasta da orquestradora tiraria ~1,5 mil tokens; muda a configuração do operador e afeta qualquer sessão nessa pasta. Fica como sugestão, não implementado.

## Tarefas

| # | Tarefa | Risco | Estado |
|---|---|---|---|
| 1 | Testes: passagem de papel após `/clear`, gatilho por degrau | não | feito |
| 2 | `comum.mjs`: `gravarPassagem`, `herdarPapel`, `tokensDoContexto` | não | feito |
| 3 | `inicio.mjs` herda o papel; `cli.mjs` ganha `passar-papel` | não | feito |
| 4 | Hook `Stop` `orquestradora-limpa.mjs` em `hooks.json` | não | feito |
| 5 | Skill `orquestradora`: nota em uma linha, seção Limpeza | não | feito |

## Não medido

- Se o `clear_session("self")` é aceito com a orquestradora aberta na tela (a descrição recusa sessões abertas ou fixadas quando o alvo é outra; para `"self"` não é claro). A skill manda pedir `/clear` ao operador se for recusado — o caminho da passagem é o mesmo.
- Se o `SessionStart` do `/clear` feito pelo app chega com `source: "clear"`: a herança não depende disso (aceita qualquer origem menos `resume`).
- Economia real por nota depois da mudança: medir com `get_usage` da orquestradora na próxima rodada de itens.
