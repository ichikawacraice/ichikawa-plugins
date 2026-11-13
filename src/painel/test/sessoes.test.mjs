import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { lerSessoes, esquecerSessoes, MAXIMO } from '../sessoes.mjs';
import { montar, entrada, CONTA_A, CONTA_B, ORG } from '../../troca/test/fabrica.mjs';

beforeEach(() => esquecerSessoes());

const AGORA = Date.parse('2026-11-12T15:00:00.000Z');
const envelhecer = (caminho, horas) => { const t = new Date(AGORA - horas * 3_600_000); utimesSync(caminho, t, t); };

test('lista as recentes da conta, respondendo primeiro, sem as arquivadas, as velhas nem as de outra conta', () => {
  const m = montar();
  const recente = entrada(m.sessoes, CONTA_A, ORG, '1', { lastActivityAt: AGORA - 60_000, cwd: '/x/projeto-um' });
  const respondendo = entrada(m.sessoes, CONTA_A, ORG, '2', { lastActivityAt: AGORA - 600_000, title: 'em curso' });
  const corte = entrada(m.sessoes, CONTA_A, ORG, '3', { lastActivityAt: AGORA - 120_000, interruptedByQuitAt: AGORA - 100_000 });
  const arquivada = entrada(m.sessoes, CONTA_A, ORG, '4', { isArchived: true });
  const antiga = entrada(m.sessoes, CONTA_A, ORG, '5');
  const deOutra = entrada(m.sessoes, CONTA_B, ORG, '6');
  for (const c of [recente, respondendo, corte, arquivada, deOutra]) envelhecer(c, 1);
  envelhecer(antiga, 30);
  const r = lerSessoes({ raiz: m.sessoes, conta: CONTA_A, env: m.env, agora: AGORA, andamento: new Set(['cli-2']) });
  assert.ok(r.sessoes.length > 0);
  assert.deepEqual(r.sessoes.map((s) => s.titulo), ['em curso', 'conversa 1', 'conversa 3']);
  assert.equal(r.sessoes[0].respondendo, true);
  assert.equal(r.sessoes[1].pasta, 'projeto-um');
  assert.equal(r.sessoes[2].vaiContinuar, true);
  assert.equal(r.respondendo, 1);
  assert.equal(r.vaoContinuar, 1);
  assert.ok(!('cli' in r.sessoes[0]), 'o id do CLI não sai para a tela');
  assert.equal(lerSessoes({ raiz: m.sessoes, conta: CONTA_B, env: m.env, agora: AGORA, andamento: new Set() }).sessoes.length, 1, 'a de outra conta seria vista na conta dela');
});

test('a mesma conversa em duas organizações vira uma linha; o teto corta a lista', () => {
  const m = montar();
  entrada(m.sessoes, CONTA_A, ORG, '1', { lastActivityAt: AGORA - 1000 });
  entrada(m.sessoes, CONTA_A, 'org-0002', '1b', { cliSessionId: 'cli-1', lastActivityAt: AGORA - 500, title: 'mais nova' });
  const r = lerSessoes({ raiz: m.sessoes, conta: CONTA_A, env: m.env, agora: AGORA, andamento: new Set() });
  assert.deepEqual(r.sessoes.map((s) => s.titulo), ['mais nova']);
  for (let i = 0; i < MAXIMO + 5; i++) entrada(m.sessoes, CONTA_A, ORG, `n${i}`, { lastActivityAt: AGORA - i });
  assert.equal(lerSessoes({ raiz: m.sessoes, conta: CONTA_A, env: m.env, agora: AGORA, andamento: new Set() }).sessoes.length, MAXIMO);
});

test('entrada ilegível é pulada e sem conta não lê nada', () => {
  const m = montar();
  mkdirSync(join(m.sessoes, CONTA_A, ORG), { recursive: true });
  writeFileSync(join(m.sessoes, CONTA_A, ORG, 'local_torta.json'), '{ não é json');
  entrada(m.sessoes, CONTA_A, ORG, 'boa', { lastActivityAt: AGORA });
  assert.deepEqual(lerSessoes({ raiz: m.sessoes, conta: CONTA_A, env: m.env, agora: Date.now(), andamento: new Set() }).sessoes.map((s) => s.titulo), ['conversa boa']);
  assert.deepEqual(lerSessoes({ raiz: m.sessoes, conta: '', env: m.env, agora: AGORA }), { sessoes: [], respondendo: 0, vaoContinuar: 0 });
});

test('respondendo vem do transcrito: turno aberto mexido há pouco', () => {
  const m = montar();
  entrada(m.sessoes, CONTA_A, ORG, '7', { lastActivityAt: Date.now() });
  mkdirSync(join(m.projetos, 'pasta'), { recursive: true });
  writeFileSync(join(m.projetos, 'pasta', 'cli-7.jsonl'), `${JSON.stringify({ type: 'user', message: { content: 'oi' } })}\n`);
  const r = lerSessoes({ raiz: m.sessoes, conta: CONTA_A, env: m.env });
  assert.equal(r.sessoes.length, 1);
  assert.equal(r.sessoes[0].respondendo, true);
});
