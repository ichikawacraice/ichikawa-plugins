import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidir } from '../hooks/sessao-com-codigo.mjs';

const abrir = (input) => decidir({ tool_name: 'mcp__ccd_session__start_session', tool_input: input });

test('abrir sessão sem o código do item no título é recusado, com o comando que falta', () => {
  const motivo = abrir({ initiation: 'user_asked', title: 'Tirar o teto de custo de US$ 40 do produto', prompt: 'x' });
  assert.match(motivo, /perguntas item nova "Tirar o teto de custo de US\$ 40 do produto"/);
  assert.match(motivo, /SIG-F7 · /);
});

test('título com o código do item passa, em qualquer sigla', () => {
  assert.equal(abrir({ initiation: 'user_asked', title: 'IZA-F16 · Tirar o teto de custo', prompt: 'x' }), null);
  assert.equal(abrir({ initiation: 'own_initiative', title: 'ICH-F26 · Barra das IAs', prompt: 'x' }), null);
});

test('iniciar uma proposta já feita (só proposal_id) passa: o título veio da proposta', () => {
  assert.equal(abrir({ proposal_id: 'task_f2c77cd2' }), null);
});

test('passar a tarefa para outra sessão também pede o código', () => {
  const motivo = decidir({ tool_name: 'mcp__ccd_session__hand_off_to_session', tool_input: { title: 'Lote de peças', remaining_plan: 'x' } });
  assert.match(motivo, /perguntas item nova/);
  assert.equal(decidir({ tool_name: 'mcp__ccd_session__hand_off_to_session', tool_input: { title: 'ICH-F27 · Lote', remaining_plan: 'x' } }), null);
});

test('outras ferramentas não são da conta deste hook', () => {
  assert.equal(decidir({ tool_name: 'SendMessage', tool_input: { to: 'x', message: 'sem código' } }), null);
});
