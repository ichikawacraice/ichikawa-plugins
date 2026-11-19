#!/usr/bin/env node
// Os testes afetados pelo diff — degrau 1 da skill `orquestracao:testes-enxutos` do kit ichikawa-plugins.
// Copie para `scripts/testes-afetados.mjs`, ponha `"test:afetados": "node scripts/testes-afetados.mjs"` no package.json e
// declare o comando (e o ponto cego abaixo) no CLAUDE.md do projeto.
//
// O que faz: pega o diff do merge-base com o tronco até o worktree (não commitado e não rastreado inclusos) e roda
// `vitest related`, que segue o grafo de import (alias incluso). Quando não sabe, roda mais: diff que mexe no que muda o
// próprio vitest (package.json, lockfile, tsconfig, config do vitest, este script) ou que apaga código roda a suíte inteira.
// Sempre diz o que escolheu e por quê; diff vazio diz "nada mudou".
//
// Ponto cego (diga no CLAUDE.md): o grafo de import não vê leitura por caminho (readFileSync, readdir, glob) nem
// subprocesso. Teste que lê doc, fixture ou pasta por caminho não acorda com a mudança do arquivo lido. Quando isso
// deixar vermelho escapar para o gate do release, suba ao degrau 2 (registro de leituras).
//
// Uso: node scripts/testes-afetados.mjs [--base <ref>] [--so-listar]
//   TESTES_VITEST  comando do vitest (padrão: "npx vitest"; num monorepo pnpm, "pnpm vitest")
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** O que muda o próprio runner de teste: mexeu, a seleção pelo grafo não vale e roda tudo. */
export const MUDA_O_VITEST = [
  /(^|\/)package\.json$/,
  /(^|\/)(pnpm-lock\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)vitest\.[^/]*\.[cm]?[jt]s$/,
  /(^|\/)vite\.config\.[cm]?[jt]s$/,
  /(^|\/)scripts\/testes-afetados\.mjs$/,
];
const CODIGO = /\.(?:[cm]?[jt]sx?|vue|svelte|astro)$/;
const TESTE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', timeout: 30_000 }).trim();
}

/** O tronco: `--base`, senão origin/develop, origin/main, origin/master, origin/HEAD. Sem nenhum, `null`. */
export function baseDoDiff(pedida, existe = (ref) => { try { git(['rev-parse', '--verify', '--quiet', ref]); return true; } catch { return false; } }) {
  if (pedida) return pedida;
  return ['origin/develop', 'origin/main', 'origin/master', 'origin/HEAD'].find(existe) ?? null;
}

/** `{ mudados, apagados }` do merge-base com a base até o worktree, com os não rastreados. */
export function diffDoWorktree(base, rodar = git) {
  const desde = rodar(['merge-base', base, 'HEAD']);
  const linhas = rodar(['diff', '--name-status', '--no-renames', desde]).split('\n').filter(Boolean);
  const novos = rodar(['ls-files', '--others', '--exclude-standard']).split('\n').filter(Boolean);
  const mudados = new Set(novos);
  const apagados = new Set();
  for (const linha of linhas) {
    const [status, caminho] = linha.split('\t');
    (status === 'D' ? apagados : mudados).add(caminho);
  }
  return { mudados: [...mudados].sort(), apagados: [...apagados].sort() };
}

/**
 * O plano: `{ modo: 'nada' | 'tudo' | 'related', motivo, arquivos, avisos }`.
 * `avisos` lista o que o grafo de import não alcança (arquivo que não é código), para quem lê saber do ponto cego.
 */
export function plano({ mudados, apagados }, { mudaOVitest = MUDA_O_VITEST } = {}) {
  const todos = [...mudados, ...apagados];
  if (!todos.length) return { modo: 'nada', motivo: 'nada mudou contra o tronco', arquivos: [], avisos: [] };
  const config = todos.find((c) => mudaOVitest.some((r) => r.test(c)));
  if (config) return { modo: 'tudo', motivo: `${config} muda o próprio vitest`, arquivos: [], avisos: [] };
  const codigoApagado = apagados.find((c) => CODIGO.test(c) && !TESTE.test(c));
  if (codigoApagado) return { modo: 'tudo', motivo: `${codigoApagado} foi apagado e o grafo de import não diz quem o usava`, arquivos: [], avisos: [] };
  const avisos = mudados.filter((c) => !CODIGO.test(c));
  const arquivos = mudados.filter((c) => CODIGO.test(c));
  if (!arquivos.length) return { modo: 'nada', motivo: 'o diff não tem código; o grafo de import não tem por onde começar', arquivos, avisos };
  return { modo: 'related', motivo: `${arquivos.length} arquivo(s) de código no diff`, arquivos, avisos };
}

function argumentos(argv) {
  const r = { base: null, soListar: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') r.base = argv[++i];
    else if (argv[i] === '--so-listar') r.soListar = true;
    else throw new Error(`argumento desconhecido: ${argv[i]}`);
  }
  return r;
}

function main() {
  const { base: pedida, soListar } = argumentos(process.argv.slice(2));
  const base = baseDoDiff(pedida);
  // Sem tronco não há diff que valha: comparar com HEAD diria "nada mudou" sobre o que já foi commitado.
  if (base === null) throw new Error('não achei o tronco (origin/develop, origin/main, origin/master): passe --base <ref>');
  const p = plano(diffDoWorktree(base));
  process.stderr.write(`testes afetados contra ${base}: ${p.modo} — ${p.motivo}\n`);
  if (p.avisos.length) {
    process.stderr.write(`o grafo de import não vê quem lê: ${p.avisos.slice(0, 5).join(', ')}${p.avisos.length > 5 ? ` e mais ${p.avisos.length - 5}` : ''}\n`);
  }
  if (soListar) { process.stdout.write(`${JSON.stringify(p, null, 2)}\n`); return 0; }
  if (p.modo === 'nada') return 0;
  const [comando, ...antes] = (process.env.TESTES_VITEST || 'npx vitest').split(' ');
  const args = p.modo === 'tudo'
    ? [...antes, 'run']
    : [...antes, 'related', '--run', '--passWithNoTests', ...p.arquivos.filter((c) => existsSync(c))];
  return spawnSync(comando, args, { stdio: 'inherit' }).status ?? 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (err) {
    process.stderr.write(`testes-afetados: ${err.message}\n`);
    process.exitCode = 2;
  }
}
