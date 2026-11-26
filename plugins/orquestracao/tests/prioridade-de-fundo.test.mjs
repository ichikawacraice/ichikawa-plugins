import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sessaoAncestral, rebaixar } from '../hooks/prioridade-de-fundo.mjs';

const TABELA = `
  1     0 /sbin/launchd
 500     1 /Applications/Claude.app/Contents/MacOS/Claude
 600   500 /Applications/Claude.app/Contents/Helpers/disclaimer
 700   600 /Users/x/Library/Application Support/Claude/claude-code/2.1.331/abc/claude.app/Contents/MacOS/claude
 800   700 /bin/sh
 900   800 node
`;

test('acha o processo claude subindo da árvore, e não o app Claude nem o disclaimer', () => {
  assert.equal(sessaoAncestral(TABELA, 900), 700);
  assert.equal(sessaoAncestral(TABELA, 600), null, 'acima da sessão não há sessão');
  assert.equal(sessaoAncestral('', 900), null);
});

test('rebaixa a sessão com renice 10, sem taskpolicy -b; fora do Mac ou desligado, nada', () => {
  const chamadas = [];
  const executar = (cmd, args) => { chamadas.push([cmd, ...args].join(' ')); return cmd === 'ps' ? TABELA.replace(' 900   800', ` ${process.pid}   800`) : ''; };
  assert.equal(rebaixar({ env: {}, plataforma: 'darwin', executar }), 700);
  assert.deepEqual(chamadas.slice(1), ['renice 10 -p 700']);
  chamadas.length = 0;
  assert.equal(rebaixar({ env: {}, plataforma: 'linux', executar }), null);
  assert.equal(rebaixar({ env: { ICHIKAWA_PRIORIDADE_NORMAL: '1' }, plataforma: 'darwin', executar }), null);
  assert.equal(chamadas.length, 0);
});
