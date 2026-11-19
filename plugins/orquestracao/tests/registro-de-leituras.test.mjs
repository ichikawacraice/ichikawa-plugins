import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  RETENCAO_MS, SETUP_DO_REGISTRO, VARIAVEIS, classificarSubprocesso, comandosDoShell, gravarEntrada, leOCaminho, lerEntrada,
  lerEntradas, listaAPasta, modulosDoWorker, montarEntrada, registroDeLeituras, relativoARaiz,
} from '../skills/testes-enxutos/modelos/registro-de-leituras.mjs';
import {
  CARO_A_PARTIR_DE_MS, MUDA_O_VITEST, casaGlob, globsMortos, juntarNaoRastreados, lerDiff, motivoDoTeste, oFilhoLe, selecionar,
} from '../skills/testes-enxutos/modelos/testes-afetados-pelo-registro.mjs';

const R = '/repo';
const agora = Date.parse('2026-11-18T12:00:00Z');
const iso = new Date(agora).toISOString();
const entrada = (teste, { caminhos = [], pastas = [], sempre = null, cega = null } = {}) => ({
  teste, commit: 'c', caminhos: Object.fromEntries(caminhos.map((c) => [c, iso])), pastas: Object.fromEntries(pastas.map((p) => [p, iso])), sempre, cega,
});

test('caminhos: relativos à raiz, fora de node_modules e .git; pasta/** cobre o que está abaixo; listagem rasa não desce', () => {
  assert.equal(relativoARaiz('/repo/src/a.ts', [R]), 'src/a.ts');
  assert.equal(relativoARaiz('/repo', [R]), '');
  assert.equal(relativoARaiz('/outro/a.ts', [R]), null);
  assert.equal(relativoARaiz('/private/repo/a.ts', [R, '/private/repo']), 'a.ts');
  assert.equal(relativoARaiz('/repo/node_modules/x/i.js', [R]), null);
  assert.equal(leOCaminho({ 'docs/**': iso }, 'docs/guia/a.md'), 'docs/**');
  assert.equal(leOCaminho({ 'docs/a.md': iso }, 'docs/b.md'), null);
  assert.equal(listaAPasta({ 'src/rotas': iso }, 'src/rotas'), 'src/rotas');
  assert.equal(listaAPasta({ src: iso }, 'src/rotas'), null);
  assert.equal(listaAPasta({ 'src/**': iso }, 'src/rotas'), 'src/**');
});

test('montarEntrada une com a anterior, esquece o que passou da retenção e herda sempre/cega recentes', () => {
  const velho = new Date(agora - RETENCAO_MS - 1).toISOString();
  const ontem = new Date(agora - 86_400_000).toISOString();
  const e = montarEntrada({
    teste: 't.test.ts', commit: 'c', caminhos: ['a.ts'], pastas: [], sempre: false, agora,
    anterior: { caminhos: { 'b.ts': ontem, 'velho.ts': velho }, pastas: { src: ontem }, sempre: ontem, cega: velho },
  });
  assert.deepEqual(e.caminhos, { 'b.ts': ontem, 'a.ts': iso });
  assert.deepEqual(e.pastas, { src: ontem });
  assert.equal(e.sempre, ontem);
  assert.equal(e.cega, null);
  assert.equal(montarEntrada({ teste: 't', commit: '', caminhos: [], pastas: [], sempre: false, cega: true, agora }).cega, iso);
});

test('gravarEntrada e lerEntradas fazem a volta e pulam arquivo ilegível', () => {
  const dir = mkdtempSync(join(tmpdir(), 'registro-'));
  const e = entrada('src/a.test.ts', { caminhos: ['src/a.ts'] });
  gravarEntrada(dir, e);
  writeFileSync(join(dir, 'lixo.json'), '{pela met');
  assert.deepEqual(lerEntrada(dir, 'src/a.test.ts'), e);
  assert.deepEqual(lerEntradas(dir), [e]);
  assert.deepEqual(lerEntradas(join(dir, 'nao-existe')), []);
});

test('modulosDoWorker lê o moduleCache (vitest 2/3) e o evaluatedModules (4/5); versão desconhecida dá null', () => {
  assert.deepEqual(modulosDoWorker({ moduleCache: new Map([['/repo/a.ts?v=1', {}], ['file:///repo/b.ts', {}]]) }), ['/repo/a.ts', '/repo/b.ts']);
  assert.deepEqual(modulosDoWorker({ evaluatedModules: { fileToModulesMap: new Map([['/repo/c.ts', new Set()]]) } }), ['/repo/c.ts']);
  assert.equal(modulosDoWorker({}), null);
  assert.equal(modulosDoWorker(undefined), null);
});

test('registroDeLeituras: desligado no CI, com a variável ou sem git; ligado grava o ambiente que os workers herdam', () => {
  const git = (args) => ({ '--show-toplevel': R, '--path-format=absolute': '/repo/.git', HEAD: 'abc' })[args[1]];
  assert.deepEqual(registroDeLeituras({ CI: 'true' }, { git }), { setupFiles: [] });
  assert.deepEqual(registroDeLeituras({ [VARIAVEIS.desliga]: '1' }, { git }), { setupFiles: [] });
  const erro = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(registroDeLeituras({}, { git: () => null }), { setupFiles: [] });
  } finally {
    console.error = erro;
  }
  const env = {};
  assert.deepEqual(registroDeLeituras(env, { git }), { setupFiles: [SETUP_DO_REGISTRO] });
  assert.deepEqual(env, { [VARIAVEIS.raiz]: R, [VARIAVEIS.dir]: '/repo/.git/registro-de-leituras', [VARIAVEIS.commit]: 'abc' });
});

test('classificarSubprocesso: o que o filho recebe do repositório e quando ele roda o repositório', () => {
  const existentes = new Set(['/repo', '/repo/scripts/x.mjs', '/repo/docs', '/repo/src']);
  const amb = { raizes: [R], existe: (a) => existentes.has(a), ehPasta: (a) => ['/repo', '/repo/docs', '/repo/src'].includes(a), cwdDoWorker: R };
  assert.deepEqual(classificarSubprocesso({ programa: 'node', args: ['scripts/x.mjs'] }, amb), { leituras: ['scripts/x.mjs'], pastas: [], sempre: true });
  assert.deepEqual(classificarSubprocesso({ programa: 'git', args: ['ls-files', 'docs'] }, amb), { leituras: ['docs'], pastas: ['docs/**'], sempre: false });
  assert.deepEqual(classificarSubprocesso({ programa: 'git', args: ['grep', '-n', 'TODO', '--', 'src'] }, amb), { leituras: ['src', 'src/**'], pastas: ['src/**'], sempre: false });
  assert.equal(classificarSubprocesso({ programa: 'sh', args: ['-c', 'cd src && FOO=1 pnpm test'] }, amb).sempre, true);
  assert.deepEqual(classificarSubprocesso({ programa: 'echo', args: ['oi'] }, amb), { leituras: [], pastas: [], sempre: false });
  assert.deepEqual(comandosDoShell(`a "b c";d|e $(f)`), [['a', 'b c'], ['d'], ['e'], ['f']]);
});

test('o-filho-le e glob: declaração lida do comentário, glob casa caminho inteiro e glob morto é apontado', () => {
  assert.deepEqual(oFilhoLe('// o-filho-le: scripts/**, docs/*.md\n * o-filho-le: a.json'), ['scripts/**', 'docs/*.md', 'a.json']);
  assert.equal(oFilhoLe('nada'), null);
  assert.ok(casaGlob('scripts/a/b.mjs', 'scripts/**'));
  assert.ok(casaGlob('a.ts', '**/*.ts'));
  assert.ok(!casaGlob('docs/x/a.md', 'docs/*.md'));
  assert.ok(casaGlob('src/a.tsx', 'src/*.{ts,tsx}'));
  assert.deepEqual(globsMortos([['t.test.ts', '// o-filho-le: scripts/**, sumiu/*.mjs']], ['scripts/x.mjs']), [{ arquivo: 't.test.ts', glob: 'sumiu/*.mjs' }]);
});

test('diff: name-status -z vira lista, T conta como M e os não rastreados entram como adicionados', () => {
  const d = lerDiff('M\0src/a.ts\0D\0src/b.ts\0T\0c\0');
  assert.deepEqual(d, [{ status: 'M', caminho: 'src/a.ts' }, { status: 'D', caminho: 'src/b.ts' }, { status: 'M', caminho: 'c' }]);
  assert.deepEqual(juntarNaoRastreados(d.slice(0, 1), ['src/a.ts', 'novo.ts', '']).map((x) => x.status + x.caminho), ['Anovo.ts', 'Msrc/a.ts']);
  for (const c of ['package.json', 'pnpm-lock.yaml', 'tsconfig.json', 'vitest.config.ts', 'scripts/registro-de-leituras.setup.mjs']) {
    assert.ok(MUDA_O_VITEST.some((r) => r.test(c)), c);
  }
});

test('seleção: cada teste entra pelo primeiro motivo, quem não lê fica de fora e o diff sem leitor é dito', () => {
  const entradas = [
    entrada('src/le.test.ts', { caminhos: ['docs/guia.md'] }),
    entrada('src/lista.test.ts', { pastas: ['src/rotas'] }),
    entrada('src/nada.test.ts', { caminhos: ['src/outro.ts'] }),
    entrada('src/cego.test.ts', { cega: iso }),
  ];
  const sel = selecionar({
    diff: [{ status: 'M', caminho: 'docs/guia.md' }, { status: 'A', caminho: 'src/rotas/nova/page.ts' }, { status: 'M', caminho: 'src/no-diff.test.ts' }, { status: 'M', caminho: 'leia-me.txt' }],
    universo: ['src/le.test.ts', 'src/lista.test.ts', 'src/nada.test.ts', 'src/cego.test.ts', 'src/novo.test.ts', 'src/no-diff.test.ts'],
    entradas,
    pastaExiste: (p) => p === 'src/rotas' || p === 'src',
    agora,
  });
  assert.deepEqual(sel.arquivos, [
    { arquivo: 'src/cego.test.ts', motivo: 'registro-cego' },
    { arquivo: 'src/le.test.ts', motivo: 'le:docs/guia.md' },
    { arquivo: 'src/lista.test.ts', motivo: 'lista:src/rotas' },
    { arquivo: 'src/no-diff.test.ts', motivo: 'no-diff' },
    { arquivo: 'src/novo.test.ts', motivo: 'sem-registro' },
  ]);
  assert.deepEqual(sel.semLeitor, ['leia-me.txt']);
});

test('subprocesso: sem declaração entra sempre e é nomeado; com declaração entra só quando o diff casa', () => {
  const ctx = { entrada: entrada('t.test.ts', { sempre: iso }), noDiff: new Set(), buscadas: [], agora };
  assert.deepEqual(motivoDoTeste('t.test.ts', { ...ctx, caminhosDoDiff: ['src/a.ts'], texto: '' }), { motivo: 'subprocesso', semDeclaracao: true });
  const declarado = '// o-filho-le: scripts/**';
  assert.deepEqual(motivoDoTeste('t.test.ts', { ...ctx, caminhosDoDiff: ['scripts/x.mjs'], texto: declarado }), { motivo: 'subprocesso' });
  assert.deepEqual(motivoDoTeste('t.test.ts', { ...ctx, caminhosDoDiff: ['src/a.ts'], texto: declarado }), { adiado: { motivo: 'subprocesso', porque: 'filho' } });
});

test('cortes para o release: caro que não importa direto, barril lido de fora; alias desconhecido não corta', () => {
  const ctx = { entrada: entrada('src/e2e.test.ts', { caminhos: ['src/a.ts', 'src/b.ts'] }), noDiff: new Set(), buscadas: [], agora, custoMs: CARO_A_PARTIR_DE_MS };
  assert.deepEqual(motivoDoTeste('src/e2e.test.ts', { ...ctx, caminhosDoDiff: ['src/b.ts'], texto: "import { a } from './a.js'" }), { adiado: { motivo: 'le:src/b.ts', porque: 'caro' } });
  assert.deepEqual(motivoDoTeste('src/e2e.test.ts', { ...ctx, caminhosDoDiff: ['src/a.ts'], texto: "import { a } from './a.js'" }), { motivo: 'le:src/a.ts' });
  assert.deepEqual(motivoDoTeste('src/e2e.test.ts', { ...ctx, caminhosDoDiff: ['src/b.ts'], texto: "import { b } from '@/b'" }), { motivo: 'le:src/b.ts' });
  assert.deepEqual(motivoDoTeste('src/e2e.test.ts', { ...ctx, caminhosDoDiff: ['src/b.ts'], texto: "import { b } from '@/b'", aliases: { '@/': 'src/' } }), { motivo: 'le:src/b.ts' });
  const barris = [{ pasta: 'packages/shared/src/', dono: 'packages/shared/' }];
  const lido = { entrada: entrada('apps/web/x.test.ts', { caminhos: ['packages/shared/src/i.ts'] }), noDiff: new Set(), buscadas: [], agora, barris, caminhosDoDiff: ['packages/shared/src/i.ts'] };
  assert.deepEqual(motivoDoTeste('apps/web/x.test.ts', lido), { adiado: { motivo: 'le:packages/shared/src/i.ts', porque: 'barril' } });
  assert.deepEqual(motivoDoTeste('packages/shared/x.test.ts', { ...lido, entrada: entrada('packages/shared/x.test.ts', { caminhos: ['packages/shared/src/i.ts'] }) }), { motivo: 'le:packages/shared/src/i.ts' });
});

test('guarda: o afterAll do setup não recebe parâmetro (no vitest 4 e 5 ele vira fixture e derruba o arquivo de teste)', () => {
  const setup = readFileSync(SETUP_DO_REGISTRO, 'utf8');
  assert.match(setup, /afterAll\(\(\) =>/);
  assert.doesNotMatch(setup, /^\s*afterAll\(\([^)]/m);
  assert.doesNotMatch(setup, /console\.(error|log|warn)/);
});
