// A lista inteira não cabe na memória: estes testes rodam a varredura num processo com teto de heap
// pequeno. Antes do conserto o processo era abatido pelo V8 ("heap out of memory") no meio da troca,
// o app ficava fechado e a lista vinha vazia.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { CONTA_A, CONTA_B, ORG, entrada, montar } from './fabrica.mjs';

const MODULO = new URL('../conversas.mjs', import.meta.url).href;
const TETO_MB = 64;
const QUANTAS = 40;
const RECHEIO = 'x'.repeat(2_000_000); // 40 × 2 MB = 80 MB de acervo contra 64 MB de heap

/**
 * Roda o trecho num filho com teto de heap e devolve { status, saida, erro }. O `env` de quem chama leva o `HOME` e as
 * pastas do ambiente temporário: nenhum teste toca o `~/.claude` de verdade, nem por descuido de um filho.
 */
function emHeapPequeno(script, env) {
  const r = spawnSync(process.execPath, [`--max-old-space-size=${TETO_MB}`, '--input-type=module', '-e', script], {
    env: { ...process.env, ...env }, encoding: 'utf8', timeout: 180_000, killSignal: 'SIGKILL',
  });
  return { status: r.status, saida: r.stdout ?? '', erro: `${r.stderr ?? ''}${r.error ? ` ${r.error.message}` : ''}` };
}

/** O acervo tem de ser maior que o teto, senão o teste passa sem medir nada. */
function acervo(amb) {
  for (let i = 0; i < QUANTAS; i++) entrada(amb.sessoes, CONTA_B, ORG, `b${i}`, { recheio: RECHEIO });
  entrada(amb.sessoes, CONTA_A, ORG, 'a0');
  const bytes = QUANTAS * RECHEIO.length;
  assert.ok(bytes > TETO_MB * 1024 * 1024, `acervo de ${bytes} bytes não excede o teto de ${TETO_MB} MB`);
}

test('sincronizar não carrega o acervo todo na memória', () => {
  const amb = montar();
  acervo(amb);
  const { status, saida, erro } = emHeapPequeno(
    `const { sincronizar } = await import(${JSON.stringify(MODULO)});
     console.log(JSON.stringify(sincronizar(process.env.RAIZ, process.env.CONTA, process.env.ORG, {})));`,
    { ...amb.env, RAIZ: amb.sessoes, CONTA: CONTA_A, ORG },
  );
  assert.ok(!/heap out of memory/i.test(erro), `o V8 abateu o processo:\n${erro}`);
  assert.equal(status, 0, `saiu com ${status}:\n${erro}`);
  assert.deepEqual(JSON.parse(saida.trim()), { gravadas: QUANTAS, removidas: 0 });
});

test('tomarConversasCortadas não carrega o acervo todo na memória', () => {
  const amb = montar();
  acervo(amb);
  for (let i = 0; i < QUANTAS; i++) entrada(amb.sessoes, CONTA_A, ORG, `b${i}`, { recheio: RECHEIO, interruptedByQuitAt: 9_000 });
  const { status, saida, erro } = emHeapPequeno(
    `const { tomarConversasCortadas } = await import(${JSON.stringify(MODULO)});
     const c = tomarConversasCortadas(process.env.RAIZ, process.env.CONTA, [process.env.ORG], 1000);
     console.log(JSON.stringify(c.length));`,
    { ...amb.env, RAIZ: amb.sessoes, CONTA: CONTA_A, ORG },
  );
  assert.ok(!/heap out of memory/i.test(erro), `o V8 abateu o processo:\n${erro}`);
  assert.equal(status, 0, `saiu com ${status}:\n${erro}`);
  assert.equal(JSON.parse(saida.trim()), QUANTAS);
});

test('enxugar não carrega o acervo todo na memória', () => {
  const amb = montar();
  // O mesmo id nas duas contas dá o arquivo idêntico: 40 pares de 2 MB, 160 MB de acervo contra 64 MB de heap.
  for (let i = 0; i < QUANTAS; i++) for (const conta of [CONTA_A, CONTA_B]) entrada(amb.sessoes, conta, ORG, `b${i}`, { recheio: RECHEIO });
  const { status, saida, erro } = emHeapPequeno(
    `const { enxugar } = await import(${JSON.stringify(MODULO)});
     const r = enxugar(process.env.RAIZ, { referencia: process.env.CONTA, aplicar: true });
     console.log(JSON.stringify({ arquivos: r.arquivos, unicos: r.unicos, copias: r.copias, reclonados: r.reclonados, pulados: r.pulados }));`,
    { ...amb.env, RAIZ: amb.sessoes, CONTA: CONTA_A, ORG },
  );
  assert.ok(!/heap out of memory/i.test(erro), `o V8 abateu o processo:\n${erro}`);
  assert.equal(status, 0, `saiu com ${status}:\n${erro}`);
  assert.deepEqual(JSON.parse(saida.trim()), { arquivos: QUANTAS * 2, unicos: QUANTAS, copias: QUANTAS, reclonados: QUANTAS, pulados: 0 });
});
