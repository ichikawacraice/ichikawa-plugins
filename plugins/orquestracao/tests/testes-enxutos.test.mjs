import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { avisoDeTestes } from '../hooks/inicio.mjs';
import { MUDA_O_VITEST, baseDoDiff, diffDoWorktree, plano } from '../skills/testes-enxutos/modelos/testes-afetados.mjs';
import { maisCaros, mediana, temposDoRelatorio } from '../skills/testes-enxutos/modelos/os-lentos.mjs';

function repo({ pacote, claude } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'repo-'));
  mkdirSync(join(raiz, '.git'));
  mkdirSync(join(raiz, 'src', 'fundo'), { recursive: true });
  if (pacote) writeFileSync(join(raiz, 'package.json'), JSON.stringify(pacote));
  if (claude) writeFileSync(join(raiz, 'CLAUDE.md'), claude);
  return raiz;
}

test('avisoDeTestes cobra o comando de afetados só de projeto com teste e CLAUDE.md que não o declara', () => {
  const sem = repo({ pacote: { scripts: { test: 'vitest run' } }, claude: '# Projeto\\nnpm test roda tudo' });
  assert.match(avisoDeTestes(join(sem, 'src', 'fundo')), /orquestracao:testes-enxutos/);
  assert.equal(avisoDeTestes(repo({ pacote: { scripts: { test: 'vitest run' } }, claude: '- Testes afetados: `pnpm test:afetados`' })), null);
  assert.equal(avisoDeTestes(repo({ pacote: { scripts: { test: 'echo "Error: no test specified" && exit 1' } } })), null);
  assert.equal(avisoDeTestes(repo({ pacote: { scripts: { build: 'tsc' } } })), null);
  assert.equal(avisoDeTestes(repo()), null);
  assert.equal(avisoDeTestes(mkdtempSync(join(tmpdir(), 'solto-'))), null);
});

test('diffDoWorktree junta o diff desde o merge-base com os não rastreados e separa os apagados', () => {
  const respostas = {
    'merge-base': 'abc',
    diff: 'M\tsrc/a.ts\nD\tsrc/velho.ts\nA\tdocs/b.md',
    'ls-files': 'src/novo.ts',
  };
  const d = diffDoWorktree('origin/develop', (args) => respostas[args[0]]);
  assert.deepEqual(d, { mudados: ['docs/b.md', 'src/a.ts', 'src/novo.ts'], apagados: ['src/velho.ts'] });
});

test('baseDoDiff prefere a pedida, depois develop, depois main', () => {
  assert.equal(baseDoDiff('x'), 'x');
  assert.equal(baseDoDiff(null, (r) => r === 'origin/main'), 'origin/main');
  assert.equal(baseDoDiff(null, () => true), 'origin/develop');
  assert.equal(baseDoDiff(null, () => false), null);
});

test('plano: nada, tudo quando muda o vitest ou some código, related com o aviso do ponto cego', () => {
  assert.equal(plano({ mudados: [], apagados: [] }).modo, 'nada');
  for (const c of ['package.json', 'apps/web/package.json', 'pnpm-lock.yaml', 'tsconfig.base.json', 'vitest.config.ts', 'scripts/testes-afetados.mjs']) {
    assert.ok(MUDA_O_VITEST.some((r) => r.test(c)), c);
    assert.equal(plano({ mudados: [c], apagados: [] }).modo, 'tudo', c);
  }
  assert.match(plano({ mudados: ['src/a.ts'], apagados: ['src/b.ts'] }).motivo, /src\/b\.ts foi apagado/);
  assert.equal(plano({ mudados: [], apagados: ['src/b.test.ts'] }).modo, 'nada');
  assert.deepEqual(plano({ mudados: ['docs/x.md', 'src/a.tsx'], apagados: [] }), {
    modo: 'related', motivo: '1 arquivo(s) de código no diff', arquivos: ['src/a.tsx'], avisos: ['docs/x.md'],
  });
  assert.equal(plano({ mudados: ['docs/x.md'], apagados: [] }).modo, 'nada');
});

test('os-lentos: tempo por arquivo do relatório do vitest e mediana entre rodadas', () => {
  assert.equal(mediana([5, 1, 3]), 3);
  assert.equal(mediana([4, 1, 3, 2]), 2.5);
  const r1 = temposDoRelatorio({ testResults: [{ name: '/r/a.test.ts', startTime: 0, endTime: 900 }, { name: '/r/b.test.ts', startTime: 10, endTime: 20 }, { name: 'quebrado' }] }, '/r');
  assert.deepEqual(r1, { 'a.test.ts': 900, 'b.test.ts': 10 });
  assert.deepEqual(maisCaros([r1, { 'a.test.ts': 100, 'b.test.ts': 30 }, { 'a.test.ts': 500 }]), [
    { arquivo: 'a.test.ts', mediana: 500, rodadas: 3 },
    { arquivo: 'b.test.ts', mediana: 20, rodadas: 2 },
  ]);
});
