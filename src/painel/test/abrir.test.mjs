import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { abrirPainel, lerPorta } from '../abrir.mjs';
import { PORTA_PADRAO } from '../cli.mjs';

const coletor = () => {
  const r = { saida: [], erro: [], abertos: [], subidas: [] };
  return { r, deps: { saida: (t) => r.saida.push(t), erro: (t) => r.erro.push(t), abrir: (u) => r.abertos.push(u), subir: (p) => r.subidas.push(p) } };
};

test('painel já no ar: só abre o navegador, não sobe outro', async () => {
  const { r, deps } = coletor();
  const codigo = await abrirPainel({ ...deps, env: {}, noAr: async () => true });
  assert.equal(codigo, 0);
  assert.deepEqual(r.subidas, []);
  assert.deepEqual(r.abertos, [`http://127.0.0.1:${PORTA_PADRAO}`]);
});

test('painel fora do ar: sobe desacoplado, espera responder e abre', async () => {
  const { r, deps } = coletor();
  let chamadas = 0;
  const codigo = await abrirPainel({ ...deps, argv: ['--porta', '4999'], env: {}, noAr: async () => ++chamadas > 2 });
  assert.equal(codigo, 0);
  assert.deepEqual(r.subidas, [4999]);
  assert.deepEqual(r.abertos, ['http://127.0.0.1:4999']);
});

test('painel que não responde no prazo: sai 1 com o caminho para ver o erro, sem abrir', async () => {
  const { r, deps } = coletor();
  const codigo = await abrirPainel({ ...deps, env: {}, noAr: async () => false, prazoMs: 50 });
  assert.equal(codigo, 1);
  assert.deepEqual(r.abertos, []);
  assert.match(r.erro.join(), /painel-de-contas --porta/);
});

test('argumentos: porta do env, --porta, erro e ajuda', () => {
  assert.equal(lerPorta([], { PAINEL_DE_CONTAS_PORTA: '5000' }).porta, 5000);
  assert.equal(lerPorta(['--porta', '6000'], {}).porta, 6000);
  assert.match(lerPorta(['--porta', '0'], {}).erro, /--porta/);
  assert.match(lerPorta(['--x'], {}).erro, /desconhecido/);
  assert.equal(lerPorta(['-h'], {}).ajuda, true);
});

test('o barra.json aponta para este bin, como argv sem shell', () => {
  const barra = JSON.parse(readFileSync(new URL('../../../barra.json', import.meta.url), 'utf8'));
  const contas = barra.botoes.find((b) => b.id === 'contas');
  assert.equal(contas.rotulo, 'Contas');
  assert.deepEqual(contas.comando, ['node', '${CLAUDE_PLUGIN_ROOT}/src/painel/abrir.mjs']);
});
