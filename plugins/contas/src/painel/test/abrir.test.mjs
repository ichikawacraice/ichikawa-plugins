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

test('--sem-abrir (botão da barra): sobe o painel e sai 0 sem abrir o navegador do sistema', async () => {
  const { r, deps } = coletor();
  let chamadas = 0;
  const codigo = await abrirPainel({ ...deps, argv: ['--sem-abrir'], env: {}, noAr: async () => ++chamadas > 1 });
  assert.equal(codigo, 0);
  assert.deepEqual(r.subidas, [PORTA_PADRAO]);
  assert.deepEqual(r.abertos, []);
  assert.match(r.saida.join(), new RegExp(`127\\.0\\.0\\.1:${PORTA_PADRAO}`));
});

test('--sem-abrir com o painel já no ar: não sobe outro nem abre', async () => {
  const { r, deps } = coletor();
  const codigo = await abrirPainel({ ...deps, argv: ['--sem-abrir'], env: {}, noAr: async () => true });
  assert.equal(codigo, 0);
  assert.deepEqual(r.subidas, []);
  assert.deepEqual(r.abertos, []);
});

test('argumentos: porta do env, --porta, erro e ajuda', () => {
  assert.equal(lerPorta([], { PAINEL_DE_CONTAS_PORTA: '5000' }).porta, 5000);
  assert.equal(lerPorta(['--porta', '6000'], {}).porta, 6000);
  assert.match(lerPorta(['--porta', '0'], {}).erro, /--porta/);
  assert.match(lerPorta(['--x'], {}).erro, /desconhecido/);
  assert.equal(lerPorta(['-h'], {}).ajuda, true);
  assert.equal(lerPorta(['--sem-abrir'], {}).semAbrir, true);
  assert.equal(lerPorta([], {}).semAbrir, false);
});

test('o barra.json abre no navegador do app: url na porta padrão e o bin só sobe o painel nessa porta', () => {
  const barra = JSON.parse(readFileSync(new URL('../../../barra.json', import.meta.url), 'utf8'));
  const contas = barra.botoes.find((b) => b.id === 'contas');
  assert.equal(contas.rotulo, 'Contas');
  assert.equal(contas.url, `http://127.0.0.1:${PORTA_PADRAO}`);
  assert.deepEqual(contas.comando, ['node', '${CLAUDE_PLUGIN_ROOT}/src/painel/abrir.mjs', '--sem-abrir', '--porta', String(PORTA_PADRAO)]);
});
