// O layout comum das páginas locais (docs/contratos.md, "Layout comum das páginas"): a fonte é a página de perguntas
// (plugins/orquestracao/lib/publico) e o painel de contas leva cópias idênticas da base. Divergiu, o teste falha.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const COPIA = join(AQUI, '..', 'publico');
const FONTE = join(AQUI, '..', '..', '..', '..', 'orquestracao', 'lib', 'publico');
const BASE = ['estilo.css', 'ceu.js', 'planeta.js', 'fontes/geist-medium.woff2', 'fontes/OFL-geist.txt'];

test('a base visual do painel é cópia idêntica da página de perguntas', { skip: !existsSync(FONTE) && 'sem o plugin orquestracao ao lado' }, () => {
  for (const arquivo of BASE) {
    assert.ok(readFileSync(join(COPIA, arquivo)).equals(readFileSync(join(FONTE, arquivo))), `${arquivo} divergiu: copie de ${join('plugins/orquestracao/lib/publico', arquivo)}`);
  }
});
