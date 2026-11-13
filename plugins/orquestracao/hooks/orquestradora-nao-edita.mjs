#!/usr/bin/env node
// PreToolUse (Edit|Write|NotebookEdit): a orquestradora não escreve código de produto, nem pelos subagentes dela
// (que chegam com o mesmo session_id). Pergunta em vez de recusar: o operador pode aprovar o que for da orquestração.
import { fileURLToPath } from 'node:url';
import { caminhoDe, foraDoProduto, lerEntrada, papelDe, responder, rodar } from './comum.mjs';

export function decidir(entrada) {
  if (papelDe(entrada.session_id) !== 'orquestradora') return null;
  const p = caminhoDe(entrada);
  if (!p || foraDoProduto(p)) return null;
  return `Orquestradora editando ${p}. Trabalho de produto vira sessão de dona (start_session), não edição aqui. Aprove só se for da orquestração.`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('orquestradora-nao-edita', () => {
    const motivo = decidir(lerEntrada());
    if (motivo) responder('ask', motivo);
  });
}
