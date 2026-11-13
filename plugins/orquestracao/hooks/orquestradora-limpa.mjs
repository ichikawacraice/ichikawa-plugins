#!/usr/bin/env node
// Stop: quando o contexto da orquestradora passa do limite, avisa o operador numa caixa (`systemMessage`)
// e deixa a limpeza pendente. Não bloqueia: bloquear forçaria uma rodada extra do modelo.
// A limpeza acontece ao fim da próxima mensagem do operador (hook orquestradora-limpa-na-mensagem).
// O estado vive no `perguntas`; perder o histórico não perde nada. Avisa uma vez por degrau.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lerEntrada, limpezaPendenteDe, marcadorDe, papelDe, rodar, tokensDoContexto } from './comum.mjs';

const LIMITE_PADRAO = 150_000;
const DEGRAU = 40_000;
const MIL = 1_000;

const limite = () => Number(process.env.ORQUESTRADORA_LIMPA_EM) || LIMITE_PADRAO;

/** A saída do Stop (`{ systemMessage }`) quando é hora de avisar; null quando não. */
export function pedirLimpeza(entrada) {
  if (papelDe(entrada.session_id) !== 'orquestradora') return null;
  const tokens = tokensDoContexto(entrada.transcript_path);
  if (!tokens || tokens < limite()) return null;
  const aviso = `${marcadorDe(entrada.session_id)}.limpeza`;
  const anterior = existsSync(aviso) ? Number(readFileSync(aviso, 'utf8')) || 0 : 0;
  if (anterior && tokens < anterior + DEGRAU) return null;
  writeFileSync(aviso, String(tokens));
  writeFileSync(limpezaPendenteDe(entrada.session_id), String(tokens));
  return { systemMessage: `🧹 Contexto em ${Math.round(tokens / MIL)} mil tokens — limpo ao fim da sua próxima mensagem` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('orquestradora-limpa', () => {
    const saida = pedirLimpeza(lerEntrada());
    if (saida) process.stdout.write(JSON.stringify(saida));
  });
}
