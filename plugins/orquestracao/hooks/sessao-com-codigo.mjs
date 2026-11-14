#!/usr/bin/env node
// PreToolUse: sessão nova (start_session, hand_off) nasce com o código do item no título, `IZA-F7 · <tema>`.
// A skill da orquestradora pede o item antes da sessão, mas só a regra escrita não segurou: em 13/11/2026 quatro
// sessões nasceram sem código (três do ateliê e a do teto de custo do Izanagi, com o item criado depois e o título
// nunca trocado). Iniciar proposta já feita (só `proposal_id`) passa: o título veio da proposta.
import { fileURLToPath } from 'node:url';
import { lerEntrada, responder, rodar } from './comum.mjs';

const ABREM_SESSAO = new Set(['mcp__ccd_session__start_session', 'mcp__ccd_session__hand_off_to_session']);
const CODIGO_NO_TITULO = /^[A-Z][A-Z0-9]{1,5}-F\d+ · \S/;

export function decidir(entrada) {
  if (!ABREM_SESSAO.has(entrada.tool_name)) return null;
  const titulo = String(entrada.tool_input?.title ?? '').trim();
  if (!titulo) return null;
  if (CODIGO_NO_TITULO.test(titulo)) return null;
  return `sessão sem o código do item no título. Crie o item antes: perguntas item nova "${titulo}" (imprime o código, SIG-F7) e abra com o título "SIG-F7 · ${titulo}". Depois do start_session: perguntas item etapa SIG-F7 planejamento --sessao <local_…>.`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('sessao-com-codigo', () => {
    const motivo = decidir(lerEntrada());
    if (motivo) responder('deny', motivo);
  });
}
