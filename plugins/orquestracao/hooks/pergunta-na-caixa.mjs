#!/usr/bin/env node
// PreToolUse (mcp__ccd_turn__wrap_up): a pergunta da caixa de próximo passo do app some com a sessão e não chega
// à página. A caixa que espera o operador (`blocked: true`), e na orquestradora toda caixa com pergunta, só passa
// citando um id gravado (`IZA-Q12`) ou depois de `perguntas nova` no mesmo turno. Hook com erro deixa passar.
import { fileURLToPath } from 'node:url';
import * as estado from '../lib/estado.mjs';
import { lerEntrada, papelDe, responder, rodar } from './comum.mjs';
import { gravada, turnoAtual } from './pergunta-no-painel.mjs';

const ID_CITADO = /\b([A-Z0-9]{3})-(Q\d+)\b/g;
const GRAVA_PERGUNTA = /\bperguntas\s+nova\b/;

export function decidir(entrada) {
  const i = entrada.tool_input ?? {};
  if (typeof i.ask !== 'string' || !i.ask.trim()) return null;
  if (i.blocked !== true && papelDe(entrada.session_id) !== 'orquestradora') return null;
  const projeto = estado.nomeDoProjeto(entrada.cwd || process.cwd());
  const s = estado.sigla(projeto);
  const citados = [...i.ask.matchAll(ID_CITADO)].map((m) => ({ sigla: m[1], id: m[2] }));
  const comoGravar = `\`perguntas nova --titulo … --caso … --se-nao … --recomendacao … --item ${s}-Fn\``;
  if (citados.length) {
    const faltam = citados.filter((c) => !gravada(c.sigla, c.id, projeto)).map((c) => `${c.sigla}-${c.id}`);
    return faltam.length
      ? `A caixa cita ${faltam.join(', ')}, que não está na página. Grave com ${comoGravar} e cite o id que ela imprimir.`
      : null;
  }
  if (turnoAtual(entrada.transcript_path).comandos.some((c) => GRAVA_PERGUNTA.test(c))) return null;
  return `A pergunta da caixa espera o operador e não está na página: a caixa some com a sessão. `
    + `Grave antes com ${comoGravar} e comece o ask pelo id impresso (${s}-Qn), não por D1, D2.`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('pergunta-na-caixa', () => {
    const motivo = decidir(lerEntrada());
    if (motivo) responder('deny', motivo);
  });
}
