import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarServidor } from '../servidor.mjs';
import { esquecerSessoes } from '../sessoes.mjs';
import { principal, lerArgumentos, PORTA_PADRAO, PASTA_DO_PLUGIN } from '../cli.mjs';
import { montar, entrada, CONTA_A, ORG, SENTINELAS } from '../../troca/test/fabrica.mjs';

const PUBLICO = join(dirname(fileURLToPath(import.meta.url)), '..', 'publico');

function pedir(porta, caminho, { metodo = 'GET', host = `127.0.0.1:${porta}` } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port: porta, path: caminho, method: metodo, headers: { Host: host } }, (res) => {
      const partes = [];
      res.on('data', (d) => partes.push(d));
      res.on('end', () => { const texto = Buffer.concat(partes).toString('utf8'); let json = null; try { json = JSON.parse(texto); } catch { /* não é json */ } resolve({ status: res.statusCode, headers: res.headers, texto, json }); });
    });
    r.on('error', reject);
    r.end();
  });
}

async function subir(env) {
  const servidor = criarServidor({ publico: PUBLICO, contas: { env } });
  await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
  return { porta: servidor.address().port, fechar: () => new Promise((r) => servidor.close(r)) };
}

test('serve a tela com CSP e recusa Host de fora', async () => {
  const m = montar();
  const s = await subir(m.env);
  try {
    for (const [caminho, tipo] of [['/', /text\/html/], ['/app.js', /javascript/], ['/regras.js', /javascript/], ['/ceu.js', /javascript/], ['/ceu-dia.js', /javascript/], ['/estilo.css', /text\/css/], ['/cotas.css', /text\/css/], ['/planeta.js', /javascript/], ['/fontes/geist-medium.woff2', /font\/woff2/]]) {
      const r = await pedir(s.porta, caminho);
      assert.equal(r.status, 200, caminho);
      assert.ok(r.texto.length > 0, caminho);
      assert.match(r.headers['content-type'], tipo);
      assert.match(r.headers['content-security-policy'], /default-src 'self'/);
    }
    assert.equal((await pedir(s.porta, '/', { host: 'malicioso.com' })).status, 403);
    assert.equal((await pedir(s.porta, '/nada')).status, 404);
    assert.equal((await pedir(s.porta, '/api/saude')).json.painel, 'contas');
  } finally { await s.fechar(); }
});

test('o céu segue o modo ausente do kit: dia desligado (e sem arquivo), noite ligado', async () => {
  const m = montar();
  const s = await subir(m.env);
  try {
    assert.match((await pedir(s.porta, '/')).texto, /<html lang="pt-BR" data-ceu="dia">/);
    assert.deepEqual((await pedir(s.porta, '/api/ceu')).json, { ceu: 'dia' });
    const pasta = join(m.home, '.claude', 'ichikawa');
    mkdirSync(pasta, { recursive: true });
    writeFileSync(join(pasta, 'ausente.json'), '{"ligado":true}');
    assert.match((await pedir(s.porta, '/')).texto, /<html lang="pt-BR" data-ceu="noite">/);
    const r = await pedir(s.porta, '/api/ceu');
    assert.deepEqual(r.json, { ceu: 'noite' });
    assert.equal(r.headers['cache-control'], 'no-store');
    writeFileSync(join(pasta, 'ausente.json'), 'não é json');
    assert.deepEqual((await pedir(s.porta, '/api/ceu')).json, { ceu: 'dia' });
  } finally { await s.fechar(); }
});

test('GET /api/sessoes: as da conta ativa, sem segredo; sem conta, lista vazia', async () => {
  esquecerSessoes();
  const m = montar();
  entrada(m.sessoes, CONTA_A, ORG, '1', { lastActivityAt: Date.now(), title: 'minha conversa' });
  const s = await subir(m.env);
  try {
    const r = await pedir(s.porta, '/api/sessoes');
    assert.equal(r.status, 200);
    assert.equal(r.json.conta, CONTA_A);
    assert.deepEqual(r.json.sessoes.map((x) => x.titulo), ['minha conversa']);
    for (const sentinela of SENTINELAS) assert.ok(!r.texto.includes(sentinela));
    assert.equal(r.headers['cache-control'], 'no-store');
  } finally { await s.fechar(); }
  esquecerSessoes();
  const semConta = montar();
  writeFileSync(join(semConta.appDir, 'config.json'), JSON.stringify({ theme: 'dark' }, null, '\t'));
  const s2 = await subir(semConta.env);
  try {
    const r = await pedir(s2.porta, '/api/sessoes');
    assert.deepEqual({ conta: r.json.conta, sessoes: r.json.sessoes }, { conta: null, sessoes: [] });
  } finally { await s2.fechar(); }
});

test('CLI do painel: argumentos, porta livre e porta já do painel', async () => {
  assert.equal(lerArgumentos([], {}).porta, PORTA_PADRAO);
  assert.equal(lerArgumentos(['--porta', '0'], {}).porta, 0);
  assert.ok(lerArgumentos(['--porta', 'x'], {}).erro);
  assert.ok(lerArgumentos(['--outra'], {}).erro);
  const m = montar();
  const abertos = [];
  const saida = [];
  const r = await principal({ argv: ['--porta', '0'], env: m.env, saida: (t) => saida.push(t), erro: () => {}, abrir: (u) => abertos.push(u) });
  try {
    assert.equal(r.codigo, 0);
    const porta = r.servidor.address().port;
    assert.deepEqual(abertos, [`http://127.0.0.1:${porta}`]);
    const outra = await principal({ argv: ['--porta', String(porta), '--sem-abrir'], env: m.env, saida: (t) => saida.push(t), erro: () => {} });
    assert.equal(outra.codigo, 0);
    assert.equal(outra.servidor, null);
    assert.match(saida.at(-1), /já está aberto/);
    assert.equal((await pedir(porta, '/api/saude')).json.pasta, PASTA_DO_PLUGIN);
  } finally { await new Promise((x) => r.servidor.close(x)); }
});

test('painel-de-contas na porta do painel de outra versão: encerra o antigo e passa a ouvir nela (ICH-F23)', async () => {
  const velho = http.createServer((_, res) => res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"painel":"contas","versao":"0.1.0","pid":1}'));
  await new Promise((x) => velho.listen(0, '127.0.0.1', x));
  const porta = velho.address().port;
  const encerrados = [];
  const m = montar();
  const r = await principal({
    argv: ['--porta', String(porta), '--sem-abrir'], env: m.env, saida: () => {}, erro: () => {},
    troca: {
      processos: () => [{ pid: 4242, comando: `node /cache/ichikawa-plugins/contas/d288e84/src/painel/cli.mjs --porta ${porta} --sem-abrir` }],
      encerrar: (pid) => { encerrados.push(pid); velho.close(); velho.closeAllConnections(); },
    },
  });
  try {
    assert.deepEqual(encerrados, [4242]);
    assert.equal(r.codigo, 0);
    assert.equal(r.servidor.address().port, porta);
    assert.equal((await pedir(porta, '/api/saude')).json.pasta, PASTA_DO_PLUGIN);
  } finally { velho.close(); if (r.servidor) await new Promise((x) => r.servidor.close(x)); }
});
