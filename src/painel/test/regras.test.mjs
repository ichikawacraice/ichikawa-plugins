import { test } from 'node:test';
import assert from 'node:assert/strict';
import { desfecho, erroDoUso, fraseDoAndamento, haQuanto, identidade, janelas, ordenarContas, percentual, quando, validarNome } from '../publico/regras.js';

// 12/11/2026 12:00 em São Paulo (UTC−3).
const AGORA = Date.parse('2026-11-12T15:00:00.000Z');

test('quando: hora de São Paulo, amanhã, dia da semana e data', () => {
  assert.equal(quando('2026-11-12T16:40:00.000Z', AGORA), '13:40');
  assert.equal(quando('2026-11-13T04:10:00.000Z', AGORA), 'amanhã 01:10');
  assert.equal(quando('2026-11-11T17:40:00.000Z', AGORA), 'ontem 14:40');
  assert.match(quando('2026-11-15T00:00:00.000Z', AGORA), /^sáb 21:00$/);
  assert.match(quando('2026-11-25T00:00:00.000Z', AGORA), /^ter 24\/11 21:00$/);
  assert.equal(quando(null, AGORA), '');
});

test('haQuanto e percentual', () => {
  assert.equal(haQuanto(AGORA - 10_000, AGORA), 'agora');
  assert.equal(haQuanto(AGORA - 5 * 60_000, AGORA), 'há 5 min');
  assert.equal(haQuanto(AGORA - 3 * 3_600_000, AGORA), 'há 3 h');
  assert.equal(haQuanto(AGORA - 86_400_000, AGORA), 'há 1 dia');
  assert.equal(percentual(42.9), 42);
  assert.equal(percentual(140), 100);
  assert.equal(percentual('10'), null);
});

test('janelas: tom, zerou, no limite e zera', () => {
  const j = janelas({ sessao: 95, sessaoReinicia: '2026-11-12T16:40:00.000Z', semana: 30, semanaReinicia: '2026-11-12T14:00:00.000Z' }, AGORA);
  assert.equal(j.length, 2);
  assert.deepEqual(j.map((x) => [x.chave, x.pct, x.tom]), [['sessao', 95, 'critico'], ['semana', 0, 'normal']]);
  assert.equal(j[0].texto, '95% · zera 13:40');
  assert.equal(j[1].texto, '0% · zerou');
  assert.deepEqual(j.map((x) => x.curto), ['5 h', 'Semana']);
  assert.equal(janelas({ sessao: 100, sessaoReinicia: '2026-11-12T16:40:00.000Z' }, AGORA)[0].texto, '100% · no limite até 13:40');
  assert.deepEqual(janelas(null, AGORA), []);
  assert.equal(erroDoUso({ erro: 'venceu' }).length > 0, true);
  assert.equal(erroDoUso({ erro: null }), '');
});

test('identidade, ordem e nome', () => {
  const a = { uuid: 'aaaaaaaa-1', nome: 'aaaaaaaa', ativa: false };
  const b = { uuid: 'bbbbbbbb-2', nome: 'Trabalho', ativa: true };
  assert.deepEqual(identidade(a, { 'aaaaaaaa-1': 'a@x.com' }), { nome: 'a@x.com', apoio: 'aaaaaaaa' });
  assert.deepEqual(identidade(b, {}), { nome: 'Trabalho', apoio: 'bbbbbbbb' });
  assert.deepEqual(ordenarContas([a, b]).map((c) => c.uuid), ['bbbbbbbb-2', 'aaaaaaaa-1']);
  assert.equal(validarNome('  Novo ', 'aaaaaaaa-1', [a, b]).nome, 'Novo');
  assert.equal(validarNome('trabalho', 'aaaaaaaa-1', [a, b]).ok, false);
  assert.equal(validarNome('BBBBBBBB', 'aaaaaaaa-1', [a, b]).ok, false);
  assert.equal(validarNome('', 'aaaaaaaa-1', [a, b]).ok, false);
});

test('andamento e desfecho', () => {
  const nome = (u) => (u === 'x' ? 'Pessoal' : u);
  assert.match(fraseDoAndamento({ comando: 'adicionar', fase: 'esperando', voltarPara: 'x', prazoEm: '2026-11-12T15:15:00.000Z' }, AGORA, nome), /volta sozinho para Pessoal\. Espero até 12:15\./);
  assert.match(fraseDoAndamento({ comando: 'trocar', conta: 'x' }, AGORA, nome), /^Trocando para Pessoal/);
  assert.equal(fraseDoAndamento(null, AGORA), '');
  assert.deepEqual(desfecho({ comando: 'trocar', ok: false, codigo: 'abriuNao', mensagem: 'cru', fim: new Date(AGORA - 120_000).toISOString() }, AGORA), { tom: 'erro', texto: 'Troca: falhou há 2 min. A troca foi feita, mas o app não abriu sozinho. Abra o Claude à mão.' });
  assert.equal(desfecho({ comando: 'trocar', ok: true, mensagem: 'Conta trocada.', fim: new Date(AGORA).toISOString() }, AGORA).tom, 'ok');
  assert.equal(desfecho(null, AGORA), null);
});
