import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidir } from '../hooks/modelo-da-dona.mjs';

const BRIEF = 'Você é a dona do item IZA-F7 · Login. Siga a skill orquestracao:dona.\nModelo: Opus médio — item comum, planeja e manda o executor.';
const abrir = (input) => decidir({ tool_name: 'mcp__ccd_session__start_session', tool_input: { initiation: 'user_asked', title: 'IZA-F7 · Login', context: 'fresh', ...input } });

test('sessão com brief sem model nem effort é recusada, com a regra na mensagem', () => {
  const motivo = abrir({ prompt: BRIEF });
  assert.match(motivo, /model/);
  assert.match(motivo, /effort/);
  assert.match(motivo, /Opus alto/);
  assert.match(motivo, /Sonnet médio/);
});

test('faltar só um dos dois também é recusado', () => {
  assert.match(abrir({ prompt: BRIEF, model: 'claude-opus-5-5' }), /effort/);
  assert.match(abrir({ prompt: BRIEF, effort: 'medium' }), /model/);
});

test('com model e effort explícitos e a linha Modelo: no brief, passa', () => {
  assert.equal(abrir({ prompt: BRIEF, model: 'claude-opus-5-5', effort: 'medium' }), null);
  assert.equal(abrir({ prompt: BRIEF.replace('Opus médio', 'Sonnet médio'), model: 'claude-sonnet-5-5', effort: 'medium', initiation: 'own_initiative' }), null);
});

test('brief sem a linha Modelo: é recusado, pedindo o escolhido e o porquê', () => {
  const motivo = abrir({ prompt: 'Você é a dona do item IZA-F7 · Login.', model: 'claude-opus-5-5', effort: 'medium' });
  assert.match(motivo, /Modelo:/);
});

test('o que não aceita model/effort passa: proposta já feita, oferta só com título, fork, nuvem, preset, hand_off', () => {
  assert.equal(abrir({ proposal_id: 'task_1', initiation: undefined, title: undefined }), null);
  assert.equal(abrir({ initiation: 'offer' }), null);
  assert.equal(abrir({ prompt: BRIEF, context: 'fork' }), null);
  assert.equal(abrir({ prompt: BRIEF, target: 'cloud' }), null);
  assert.equal(abrir({ prompt: BRIEF, preset: 'meu-preset' }), null);
  assert.equal(decidir({ tool_name: 'mcp__ccd_session__hand_off_to_session', tool_input: { title: 'IZA-F7 · x', remaining_plan: 'x' } }), null);
});

test('proposta iniciada pelo proposal_id passa, mesmo com o brief: o app não garante model/effort nessa chamada', () => {
  assert.equal(abrir({ proposal_id: 'task_1', initiation: undefined, prompt: BRIEF }), null);
});
