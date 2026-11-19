import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = join(import.meta.dirname, '..', '..', '..');
const PASTAS_DE_TESTE = /(^|\/)(tests?)(\/|$)/;
const ARQUIVO_DE_TESTE = /\.(test|serial)\.(mjs|ts|tsx)$/;

// O filho é outro processo e recebe a porta pela linha de comando antes de subir: não dá para pedir a 0.
// A faixa 20000–39999 não tem porta que o fetch bloqueia (as "bad ports" param em 10080).
const PORTA_SORTEADA_ACEITA = new Set(['plugins/contas/src/painel/test/abrir.test.mjs']);

function arquivosDeTeste(pasta) {
  return readdirSync(pasta, { withFileTypes: true }).flatMap((e) => {
    const caminho = join(pasta, e.name);
    if (e.isDirectory()) return e.name === 'node_modules' || e.name === 'fixtures' ? [] : arquivosDeTeste(caminho);
    const rel = relative(RAIZ, caminho);
    return ARQUIVO_DE_TESTE.test(e.name) && PASTAS_DE_TESTE.test(rel) ? [rel] : [];
  });
}

test('servidor de teste pede a porta 0 em vez de sortear uma (sorteio colide entre sessões e cai na 5060, que o fetch recusa)', () => {
  const todos = arquivosDeTeste(join(RAIZ, 'plugins'));
  assert.ok(todos.length > 20, `achou só ${todos.length} arquivos de teste: a varredura se perdeu`);
  const quebram = todos.filter((rel) => !PORTA_SORTEADA_ACEITA.has(rel))
    .filter((rel) => readFileSync(join(RAIZ, rel), 'utf8').split('\n').some((l) => /porta/i.test(l) && /Math\.random\(\)/.test(l)));
  assert.deepEqual(quebram, []);
});
