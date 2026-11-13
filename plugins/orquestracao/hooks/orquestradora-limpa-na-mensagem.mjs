#!/usr/bin/env node
// UserPromptSubmit: com a limpeza pendente (gravada pelo Stop), lembra a orquestradora de responder e se limpar
// ao fim deste turno. A pendência só sai no `perguntas passar-papel`: se ela adiar (brainstorming), o lembrete volta.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lerEntrada, limpezaPendenteDe, papelDe, rodar } from './comum.mjs';

/** O contexto a injetar no turno, ou null quando não há limpeza pendente. */
export function lembrarLimpeza(entrada) {
  if (papelDe(entrada.session_id) !== 'orquestradora') return null;
  const pendente = limpezaPendenteDe(entrada.session_id);
  if (!pendente || !existsSync(pendente)) return null;
  return 'Limpeza pendente (o operador já foi avisado; não pergunte se pode limpar). '
    + 'Responda à mensagem normalmente. No mesmo turno: pergunta sua ao operador que só está no chat vira `perguntas nova`; '
    + `depois \`perguntas passar-papel --sessao-id ${entrada.session_id}\` e \`clear_session\` com "self" — a limpeza roda ao fim do turno. `
    + 'Exceção: se a mensagem abre uma conversa que precisa deste histórico (brainstorming, uma decisão em curso), adie: '
    + 'diga numa linha que limpa no próximo intervalo e não rode nada; o lembrete volta na próxima mensagem.';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('orquestradora-limpa-na-mensagem', () => {
    const contexto = lembrarLimpeza(lerEntrada());
    if (contexto) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: contexto } }));
  });
}
