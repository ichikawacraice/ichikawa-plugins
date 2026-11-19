#!/usr/bin/env node
// Os arquivos de teste mais caros, pela mediana das últimas rodadas — degrau 3 da skill `orquestracao:testes-enxutos`.
// Copie para `scripts/os-lentos.mjs`. Cada rodada da suíte grava um relatório JSON do vitest numa pasta fora do git:
//
//   npx vitest run --reporter=default --reporter=json --outputFile.json=.tempos/$(date +%s).json
//
// (ponha `.tempos/` no .gitignore; o gate do release pode gravar sempre). Este script lê as últimas N rodadas e mostra,
// por arquivo, a mediana do tempo — a carga da máquina varia mais que o ganho de um conserto, então uma rodada só mente.
//
// Uso: node scripts/os-lentos.mjs [--pasta .tempos] [--rodadas 10] [--top 15]
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

export const mediana = (xs) => {
  const v = [...xs].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

/** `{ arquivo: ms }` de um relatório JSON do vitest (formato do jest: `testResults[].name/startTime/endTime`). */
export function temposDoRelatorio(relatorio, raiz = process.cwd()) {
  const r = {};
  for (const t of relatorio?.testResults ?? []) {
    if (typeof t?.name !== 'string' || !Number.isFinite(t.startTime) || !Number.isFinite(t.endTime)) continue;
    r[relative(raiz, t.name)] = Math.max(0, t.endTime - t.startTime);
  }
  return r;
}

/** `[{ arquivo, mediana, rodadas }]` do mais caro ao mais barato, sobre as rodadas dadas (da mais nova à mais velha). */
export function maisCaros(rodadas) {
  const porArquivo = new Map();
  for (const tempos of rodadas) {
    for (const [arquivo, ms] of Object.entries(tempos)) {
      if (!porArquivo.has(arquivo)) porArquivo.set(arquivo, []);
      porArquivo.get(arquivo).push(ms);
    }
  }
  return [...porArquivo].map(([arquivo, xs]) => ({ arquivo, mediana: mediana(xs), rodadas: xs.length }))
    .sort((a, b) => b.mediana - a.mediana || a.arquivo.localeCompare(b.arquivo));
}

function argumentos(argv) {
  const r = { pasta: '.tempos', rodadas: 10, top: 15 };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[++i];
    if (argv[i - 1] === '--pasta') r.pasta = v;
    else if (argv[i - 1] === '--rodadas') r.rodadas = Number(v);
    else if (argv[i - 1] === '--top') r.top = Number(v);
    else throw new Error(`argumento desconhecido: ${argv[i - 1]}`);
  }
  return r;
}

function main() {
  const { pasta, rodadas, top } = argumentos(process.argv.slice(2));
  const arquivos = readdirSync(pasta).filter((a) => a.endsWith('.json')).sort().reverse().slice(0, rodadas);
  if (!arquivos.length) { process.stderr.write(`nenhuma rodada em ${pasta}\n`); return 1; }
  const lidas = arquivos.map((a) => temposDoRelatorio(JSON.parse(readFileSync(join(pasta, a), 'utf8'))));
  const lista = maisCaros(lidas);
  const total = lista.reduce((s, x) => s + x.mediana, 0);
  process.stdout.write(`${arquivos.length} rodada(s), ${lista.length} arquivos, ${(total / 1000).toFixed(0)} s de worker (soma das medianas)\n`);
  let acumulado = 0;
  for (const x of lista.slice(0, top)) {
    acumulado += x.mediana;
    process.stdout.write(`${(x.mediana / 1000).toFixed(1).padStart(7)} s  ${((acumulado / total) * 100).toFixed(0).padStart(3)}%  ${x.arquivo}\n`);
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (err) {
    process.stderr.write(`os-lentos: ${err.message}\n`);
    process.exitCode = 2;
  }
}
