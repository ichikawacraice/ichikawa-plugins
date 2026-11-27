#!/usr/bin/env node
// PreToolUse: sessão nova (start_session) nasce com `model` e `effort` escolhidos pelo item, e o brief diz qual e por quê.
// Sem os dois, a sessão herda o padrão global do settings (Opus 1M, esforço alto): medido em 27/11/2026 no Izanagi,
// toda dona nascia em Opus alto, inclusive as de doc e renumeração. A regra está na skill `orquestradora`.
// Passa o que não aceita `model`/`effort`: proposta iniciada pelo `proposal_id`, oferta só com título, `fork`,
// nuvem e preset (que traz os seus); `hand_off_to_session` nem tem os campos.
import { fileURLToPath } from 'node:url';
import { lerEntrada, responder, rodar } from './comum.mjs';

const START = 'mcp__ccd_session__start_session';
const LINHA_DO_MODELO = /^Modelo:\s*\S/m;

export const REGRA = [
  'Opus alto (`claude-opus-5-5`, `high`): item de risco (auth, permissão ou segredo; dinheiro; migration ou dado que não volta; diff acima de ~400 linhas), arquitetura, decisão nova ou bug sem causa medida.',
  'Opus médio (`claude-opus-5-5`, `medium`): item comum, que planeja e manda o executor fazer.',
  'Sonnet médio (`claude-sonnet-5-5`, `medium`): item mecânico de plano fechado (doc, renumeração, roadmap, ajuste de texto).',
  'Haiku (`claude-haiku-5-5`, `medium`): vigia ou ronda que só lê.',
  'Na dúvida, o de cima.',
].join(' ');

const preenchido = (v) => typeof v === 'string' && v.trim() !== '';

export function decidir(entrada) {
  if (entrada.tool_name !== START) return null;
  const i = entrada.tool_input ?? {};
  if (preenchido(i.proposal_id)) return null;
  if (!preenchido(i.prompt)) return null;
  if (i.context === 'fork' || i.target === 'cloud' || preenchido(i.preset)) return null;

  const faltam = ['model', 'effort'].filter((campo) => !preenchido(i[campo]));
  if (faltam.length) {
    return `start_session sem ${faltam.join(' e ')}: a sessão herdaria o padrão global (Opus alto). Escolha pelo item (skill orquestradora, "Modelo da dona"): ${REGRA} E ponha no brief a linha "Modelo: <escolhido> — <porquê>".`;
  }
  if (!LINHA_DO_MODELO.test(i.prompt)) {
    return `o brief não diz o modelo escolhido. Acrescente a linha "Modelo: <modelo e esforço> — <porquê, em uma frase>" (ex.: "Modelo: Opus médio — item comum, planeja e manda o executor"). Ela diz à dona por que nasceu assim e quando pedir para subir.`;
  }
  return null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('modelo-da-dona', () => {
    const motivo = decidir(lerEntrada());
    if (motivo) responder('deny', motivo);
  });
}
