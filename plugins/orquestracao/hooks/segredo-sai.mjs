#!/usr/bin/env node
// PreToolUse: recusa o que leva segredo para outra sessão (mensagem, start_session, hand_off). O texto fica no
// transcript do destino e dali ninguém tira. A recusa nomeia o padrão, nunca o valor.
import { fileURLToPath } from 'node:url';
import { lerEntrada, responder, rodar } from './comum.mjs';
import { segredosEm, nomesDe } from './varredura-entre-sessoes.mjs';

const SAIDAS = new Set([
  'SendMessage',
  'mcp__ccd_session_mgmt__send_message',
  'mcp__ccd_session__start_session',
  'mcp__ccd_session__hand_off_to_session',
]);
const PROFUNDIDADE_MAXIMA = 8;

function textos(v, acc = [], fundo = 0) {
  if (typeof v === 'string') acc.push(v);
  else if (fundo < PROFUNDIDADE_MAXIMA && v && typeof v === 'object') for (const x of Object.values(v)) textos(x, acc, fundo + 1);
  return acc;
}

export function decidir(entrada) {
  if (!SAIDAS.has(entrada.tool_name)) return null;
  const achados = textos(entrada.tool_input).flatMap((t) => segredosEm(t));
  return achados.length ? `segredo no que sai para outra sessão: ${nomesDe(achados)}. Mande o caminho do arquivo ou o nome da variável, não o valor.` : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('segredo-sai', () => {
    const motivo = decidir(lerEntrada());
    if (motivo) responder('deny', motivo);
  });
}
