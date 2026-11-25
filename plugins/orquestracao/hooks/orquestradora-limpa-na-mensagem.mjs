#!/usr/bin/env node
// UserPromptSubmit: com a limpeza pendente (gravada pelo Stop), só a mensagem do operador que pede a limpeza
// ("limpa", "pode limpar", "/clear") faz a orquestradora se limpar ao fim do turno. Qualquer outra passa sem lembrete:
// limpar sem o sim dele apagava o texto que ele lia e prendia as notas das donas até a próxima mensagem.
// A pendência só sai no `perguntas passar-papel`.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lerEntrada, limpezaPendenteDe, papelDe, rodar } from './comum.mjs';

const PEDE_LIMPEZA = /(^|[^\p{L}])limp(a|e|ar)([^\p{L}]|$)|^\s*\/clear\b/iu;
const PERGUNTA = /\?/;

/** O contexto a injetar no turno, ou null quando não há limpeza pendente ou a mensagem não pede a limpeza. */
export function lembrarLimpeza(entrada) {
  if (papelDe(entrada.session_id) !== 'orquestradora') return null;
  const pendente = limpezaPendenteDe(entrada.session_id);
  if (!pendente || !existsSync(pendente)) return null;
  const prompt = String(entrada.prompt ?? '');
  if (!PEDE_LIMPEZA.test(prompt) || PERGUNTA.test(prompt)) return null;
  return 'O operador pediu a limpeza (a caixa 🧹 perguntou). Responda ao resto da mensagem, se houver. No mesmo turno: '
    + 'pergunta sua ao operador que só está no chat vira `perguntas nova`; '
    + `depois \`perguntas passar-papel --sessao-id ${entrada.session_id}\` e \`clear_session\` com "self" — a limpeza roda ao fim do turno. `
    + 'Se a mensagem só fala de limpar outra coisa (cache, pasta, branch), ignore este lembrete.';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('orquestradora-limpa-na-mensagem', () => {
    const contexto = lembrarLimpeza(lerEntrada());
    if (contexto) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: contexto } }));
  });
}
