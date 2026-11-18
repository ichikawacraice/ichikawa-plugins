import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { atualizarKit, arvore, comandoDeAtualizar, passosDeAtualizar, conferirKit, criarAviso, instalados, nomesDosVelhos, pastaDifere, shaDoBlob } from '../lib/kit.mjs';
import { criarServidor, html } from '../lib/pagina.mjs';

const MAIN = 'a'.repeat(40);

beforeEach(() => {
  process.env.ICHIKAWA_HOME = mkdtempSync(join(tmpdir(), 'ichikawa-'));
  process.env.CLAUDE_CONFIG_DIR = mkdtempSync(join(tmpdir(), 'claude-'));
});

const registro = (plugins) => JSON.stringify({ version: 2, plugins });

test('instalados lê só as instalações deste marketplace, com o projeto nos escopos de projeto', () => {
  const texto = registro({
    'barra@ichikawa-plugins': [{ scope: 'user', installPath: '/c/barra/1', projectPath: '/ignorado' }],
    'design-wicomm@ichikawa-plugins': [{ scope: 'local', installPath: '/c/dw/1', projectPath: '/p/WiControl' }, { scope: 'local' }],
    'outro@outro-marketplace': [{ scope: 'user', installPath: '/c/outro' }],
  });
  assert.deepEqual(instalados(texto), [
    { nome: 'barra', pasta: '/c/barra/1', escopo: 'user', projeto: null },
    { nome: 'design-wicomm', pasta: '/c/dw/1', escopo: 'local', projeto: '/p/WiControl' },
  ]);
  assert.deepEqual(instalados('{quebrado'), []);
});

test('shaDoBlob dá o mesmo sha que o git hash-object', () => {
  const arq = join(process.env.CLAUDE_CONFIG_DIR, 'a.txt');
  writeFileSync(arq, 'olá, céu\n');
  assert.equal(shaDoBlob(Buffer.from('olá, céu\n')), execFileSync('git', ['hash-object', arq]).toString().trim());
});

test('arvore pega os blobs da pasta do plugin, sem o prefixo', () => {
  const saida = `100644 blob ${'1'.repeat(40)}\tplugins/barra/README.md\n100644 blob ${'2'.repeat(40)}\tplugins/barra-x/a\n040000 tree ${'3'.repeat(40)}\tplugins/barra/hooks`;
  assert.deepEqual(arvore(saida, 'barra'), { 'README.md': '1'.repeat(40) });
});

test('pastaDifere: igual não avisa, arquivo mudado ou faltando avisa, arquivo a mais não conta', async () => {
  const pasta = join(process.env.CLAUDE_CONFIG_DIR, 'p');
  mkdirSync(pasta);
  writeFileSync(join(pasta, 'a'), 'um');
  writeFileSync(join(pasta, '.in_use'), '');
  assert.equal(await pastaDifere(pasta, { a: shaDoBlob(Buffer.from('um')) }), false);
  assert.equal(await pastaDifere(pasta, { a: shaDoBlob(Buffer.from('dois')) }), true);
  assert.equal(await pastaDifere(pasta, { a: shaDoBlob(Buffer.from('um')), b: '0'.repeat(40) }), true);
});

/** Monta `installed_plugins.json` e um git falso que responde a `rev-parse` e `ls-tree` com `arquivos` da main. */
function cenario(instalacoes, arquivos, { revParse = 0 } = {}) {
  const base = process.env.CLAUDE_CONFIG_DIR;
  mkdirSync(join(base, 'plugins'), { recursive: true });
  writeFileSync(join(base, 'plugins', 'installed_plugins.json'), registro(instalacoes));
  const chamadas = [];
  const git = async (args) => {
    chamadas.push(args[0]);
    if (args[0] === 'rev-parse') return { codigo: revParse, saida: revParse ? '' : MAIN };
    if (args[0] === 'ls-tree') {
      const nome = args.at(-1).split('/')[1];
      return { codigo: 0, saida: Object.entries(arquivos[nome] ?? {}).map(([c, t]) => `100644 blob ${shaDoBlob(Buffer.from(t))}\tplugins/${nome}/${c}`).join('\n') };
    }
    return { codigo: 0, saida: '' };
  };
  return { base, git, chamadas };
}

function pastaCom(nome, conteudo) {
  const pasta = join(process.env.CLAUDE_CONFIG_DIR, nome);
  mkdirSync(pasta, { recursive: true });
  for (const [c, t] of Object.entries(conteudo)) writeFileSync(join(pasta, c), t);
  return pasta;
}

test('conferirKit aponta só a instalação que difere da main e pula projeto que sumiu', async () => {
  const projeto = mkdtempSync(join(tmpdir(), 'projeto-'));
  const { base, git, chamadas } = cenario({
    'barra@ichikawa-plugins': [{ scope: 'user', installPath: pastaCom('barra', { a: 'velho' }) }],
    'stack@ichikawa-plugins': [{ scope: 'user', installPath: pastaCom('stack', { a: 'igual' }) }],
    'design-wicomm@ichikawa-plugins': [
      { scope: 'local', installPath: pastaCom('dw-velho', { a: 'velho' }), projectPath: projeto },
      { scope: 'local', installPath: pastaCom('dw-sumiu', { a: 'velho' }), projectPath: '/nao/existe' },
    ],
  }, { barra: { a: 'novo' }, stack: { a: 'igual' }, 'design-wicomm': { a: 'novo' } });
  const r = await conferirKit({ base, git, buscar: true });
  assert.equal(r.main, MAIN);
  assert.deepEqual(r.velhos, [
    { nome: 'barra', escopo: 'user', projeto: null },
    { nome: 'design-wicomm', escopo: 'local', projeto },
  ]);
  assert.equal(chamadas[0], 'fetch');
});

test('conferirKit sem registro, sem plugin do kit ou sem clone devolve null', async () => {
  assert.equal(await conferirKit({ base: process.env.CLAUDE_CONFIG_DIR, git: async () => ({ codigo: 0, saida: MAIN }) }), null);
  const semClone = cenario({ 'barra@ichikawa-plugins': [{ scope: 'user', installPath: '/x' }] }, {}, { revParse: 1 });
  assert.equal(await conferirKit({ base: semClone.base, git: semClone.git }), null);
});

test('criarAviso devolve o último resultado, confere no máximo uma vez por intervalo e busca a main mais devagar', async () => {
  const pedidos = [];
  const aviso = criarAviso({ conferir: async ({ buscar }) => { pedidos.push(buscar); return { velhos: [], main: MAIN, n: pedidos.length }; }, intervaloLocal: 60, intervaloDaBusca: 1000 });
  assert.equal(aviso(0), null);
  await aviso.esperar();
  assert.equal(aviso(10).n, 1);
  aviso(100);
  await aviso.esperar();
  aviso(1000);
  await aviso.esperar();
  assert.deepEqual(pedidos, [true, false, true]);
});

test('comando e nomes: o de usuário direto; o de projeto de dentro da pasta, com o escopo; worktree pelo projeto', () => {
  const velhos = [
    { nome: 'barra', escopo: 'user', projeto: null },
    { nome: 'design-wicomm', escopo: 'local', projeto: "/p/Wi Control/.claude/worktrees/upbeat-x" },
    { nome: 'design-wicomm', escopo: 'project', projeto: "/p/O'Neil" },
  ];
  assert.equal(comandoDeAtualizar(velhos), [
    'claude plugin marketplace update ichikawa-plugins',
    'claude plugin update barra@ichikawa-plugins',
    "(cd '/p/Wi Control/.claude/worktrees/upbeat-x' && claude plugin update design-wicomm@ichikawa-plugins --scope local)",
    "(cd '/p/O'\\''Neil' && claude plugin update design-wicomm@ichikawa-plugins --scope project)",
  ].join(' && '));
  assert.deepEqual(nomesDosVelhos(velhos), ['barra', 'design-wicomm (Wi Control, worktree)', "design-wicomm (O'Neil)"]);
});

test('a página mostra o aviso de kit novo só quando há plugin velho, com o botão de atualizar', () => {
  assert.doesNotMatch(html(Date.now(), null), /<div class="aviso-kit"/);
  assert.doesNotMatch(html(Date.now(), { velhos: [], main: MAIN }), /<div class="aviso-kit"/);
  const pagina = html(Date.now(), { velhos: [{ nome: 'barra', escopo: 'user', projeto: null }, { nome: 'contas', escopo: 'user', projeto: null }], main: MAIN });
  assert.match(pagina, /<div class="aviso-kit" role="status"><p>.*Versão nova dos plugins barra, contas<\/span><button type="button" class="botao-kit">Atualizar<\/button><\/p>/);
  assert.ok(pagina.includes('<div class="kit-comando" hidden><p class="kit-erro"></p><code>claude plugin marketplace update ichikawa-plugins &amp;&amp; claude plugin update barra@ichikawa-plugins &amp;&amp; claude plugin update contas@ichikawa-plugins</code></div>'));
});

const VELHOS = [
  { nome: 'barra', escopo: 'user', projeto: null },
  { nome: 'design-wicomm', escopo: 'local', projeto: '/p/WiControl' },
];

test('passosDeAtualizar: o marketplace primeiro; a instalação de projeto roda de dentro dele, com o escopo', () => {
  assert.deepEqual(passosDeAtualizar(VELHOS), [
    { args: ['plugin', 'marketplace', 'update', 'ichikawa-plugins'], cwd: null },
    { args: ['plugin', 'update', 'barra@ichikawa-plugins'], cwd: null },
    { args: ['plugin', 'update', 'design-wicomm@ichikawa-plugins', '--scope', 'local'], cwd: '/p/WiControl' },
  ]);
});

test('atualizarKit para no primeiro passo que falha e diz qual foi', async () => {
  const rodados = [];
  const r = await atualizarKit(VELHOS, async (p) => { rodados.push(p.args[1]); return p.args[1] === 'update' ? { ok: false, saida: 'linha 1\nplugin não encontrado' } : { ok: true, saida: '' }; });
  assert.deepEqual(rodados, ['marketplace', 'update']);
  assert.deepEqual(r, { ok: false, falhou: { comando: 'claude plugin update barra@ichikawa-plugins', saida: 'linha 1\nplugin não encontrado' } });
  assert.deepEqual(await atualizarKit(VELHOS, async () => ({ ok: true, saida: '' })), { ok: true });
});

/** Sobe o servidor numa porta livre com a conferência e a atualização falsas. */
async function servidorDeTeste(kit, atualizar) {
  let esquecido = 0;
  const aviso = Object.assign(() => kit, { esquecer: () => { esquecido++; } });
  const servidor = criarServidor(0, { aviso, atualizar });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const porta = servidor.address().port;
  servidor.close();
  const real = criarServidor(porta, { aviso, atualizar });
  await new Promise((ok) => real.listen(porta, '127.0.0.1', ok));
  const post = (origem = `http://127.0.0.1:${porta}`) => fetch(`http://127.0.0.1:${porta}/atualizar-kit`, { method: 'POST', headers: origem ? { Origin: origem } : {} });
  return { post, fechar: () => new Promise((ok) => real.close(ok)), esquecidos: () => esquecido };
}

test('POST /atualizar-kit: só da própria origem, só com plugin velho, e devolve o comando quando falha', async () => {
  const chamadas = [];
  const ok = await servidorDeTeste({ velhos: VELHOS, main: MAIN }, async (v) => { chamadas.push(v); return { ok: true }; });
  try {
    assert.equal((await ok.post('http://mal.example')).status, 403);
    assert.equal((await ok.post(null)).status, 403);
    assert.equal(chamadas.length, 0);
    const r = await ok.post();
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
    assert.deepEqual(chamadas, [VELHOS]);
    assert.equal(ok.esquecidos(), 1);
  } finally { await ok.fechar(); }

  const nada = await servidorDeTeste({ velhos: [], main: MAIN }, async () => assert.fail('não devia rodar'));
  try {
    assert.equal((await nada.post()).status, 409);
  } finally { await nada.fechar(); }

  const falha = await servidorDeTeste({ velhos: VELHOS, main: MAIN }, async () => ({ ok: false, falhou: { comando: 'x', saida: 'a\nsem rede' } }));
  try {
    const r = await falha.post();
    assert.equal(r.status, 500);
    const corpo = await r.json();
    assert.equal(corpo.erro, 'falhou: sem rede');
    assert.match(corpo.comando, /^claude plugin marketplace update ichikawa-plugins && /);
  } finally { await falha.fechar(); }
});
