#!/usr/bin/env node
// Stop: quando o contexto da orquestradora passa do limite, pede que ela se limpe antes de parar.
// O estado vive no `perguntas`; perder o histórico não perde nada. Pede uma vez por degrau.
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
  return `Contexto da orquestradora em ${Math.round(tokens / MIL)} mil tokens. Limpe-se agora (skill orquestradora, "Limpeza"): `
    + 'pergunta pendente no chat vira `perguntas nova`; depois `perguntas passar-papel --sessao-id <ID>` e `clear_session` com "self". '
    + 'Se o operador está no meio de uma conversa com você, não limpe: responda numa linha que limpa no próximo intervalo.';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('orquestradora-limpa', () => {
    const motivo = pedirLimpeza(lerEntrada());
    if (motivo) process.stdout.write(JSON.stringify({ decision: 'block', reason: motivo }));
  });
}
