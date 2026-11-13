// O navegador do app do Claude descarta window.confirm/alert/prompt (devolve na hora, sem mostrar nada): o botão de
// trocar conta parecia não fazer nada. A página confirma com o <dialog id="confirmar"> dela.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLICO = join(dirname(fileURLToPath(import.meta.url)), '..', 'publico');
const ler = (arquivo) => readFileSync(join(PUBLICO, arquivo), 'utf8');

test('a página não usa diálogo nativo do navegador', () => {
  assert.doesNotMatch(ler('app.js'), /\b(window\.)?(confirm|alert|prompt)\s*\(/);
});

test('a confirmação mora na página: dialog com Cancelar e Continuar', () => {
  const html = ler('index.html');
  assert.match(html, /<dialog id="confirmar"/);
  assert.match(html, /value="nao"/);
  assert.match(html, /value="sim"[^>]*id="confirmar-sim"/);
});
