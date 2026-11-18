import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { arvore, comandoDeAtualizar, conferirKit, criarAviso, instalados, nomesDosVelhos, pastaDifere, shaDoBlob } from '../lib/kit.mjs';
import { html } from '../lib/pagina.mjs';

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

test('a página mostra o aviso de kit novo só quando há plugin velho', () => {
  assert.doesNotMatch(html(Date.now(), null), /<details class="aviso-kit"/);
  assert.doesNotMatch(html(Date.now(), { velhos: [], main: MAIN }), /<details class="aviso-kit"/);
  const pagina = html(Date.now(), { velhos: [{ nome: 'barra', escopo: 'user', projeto: null }, { nome: 'contas', escopo: 'user', projeto: null }], main: MAIN });
  const comando = 'claude plugin marketplace update ichikawa-plugins &amp;&amp; claude plugin update barra@ichikawa-plugins &amp;&amp; claude plugin update contas@ichikawa-plugins';
  assert.match(pagina, /<details class="aviso-kit" id="aviso-kit"><summary>.*Versão nova dos plugins barra, contas<\/span><span class="kit-ver">ver comando<\/span><\/summary>/);
  assert.ok(pagina.includes(`<code>${comando}</code><button type="button" class="botao-kit" data-comando="${comando}">Copiar</button>`));
});
