#!/usr/bin/env node
// Stop: quando o contexto da orquestradora passa do limite, pede que ela pergunte ao operador se pode se limpar.
// O estado vive no `perguntas`; perder o histórico não perde nada, mas o chat some da tela de quem lê.
// Só limpa com o sim do operador. Pergunta uma vez por degrau.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lerEntrada, marcadorDe, papelDe, rodar, tokensDoContexto } from './comum.mjs';

const LIMITE_PADRAO = 150_000;
const DEGRAU = 40_000;
const MIL = 1_000;

const limite = () => Number(process.env.ORQUESTRADORA_LIMPA_EM) || LIMITE_PADRAO;

export function pedirLimpeza(entrada) {
  if (entrada.stop_hook_active || papelDe(entrada.session_id) !== 'orquestradora') return null;
  const tokens = tokensDoContexto(entrada.transcript_path);
  if (!tokens || tokens < limite()) return null;
  const aviso = `${marcadorDe(entrada.session_id)}.limpeza`;
  const anterior = existsSync(aviso) ? Number(readFileSync(aviso, 'utf8')) || 0 : 0;
  if (anterior && tokens < anterior + DEGRAU) return null;
  writeFileSync(aviso, String(tokens));
  const mil = Math.round(tokens / MIL);
  return `Contexto da orquestradora em ${mil} mil tokens. Não rode \`clear_session\` agora: o operador pode estar lendo este chat. `
    + 'Se há pergunta sua ao operador que só está no chat, grave-a com `perguntas nova`. '
    + `Depois diga a ele, numa linha: "Contexto em ${mil} mil. Posso limpar? O chat desta sessão some." `
    + 'Só limpe (skill orquestradora, "Limpeza") depois de um sim explícito do operador aqui no chat; o ok de outra sessão não vale. '
    + 'Sem resposta, siga normalmente e não pergunte de novo.';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('orquestradora-limpa', () => {
    const motivo = pedirLimpeza(lerEntrada());
    if (motivo) process.stdout.write(JSON.stringify({ decision: 'block', reason: motivo }));
  });
}
