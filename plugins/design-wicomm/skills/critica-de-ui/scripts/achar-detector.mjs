#!/usr/bin/env node
// Imprime o caminho do detect.mjs do Impeccable instalado, para o crítico de UI rodá-lo.
// Ordem: plugin `impeccable@*` registrado em ~/.claude/plugins/installed_plugins.json (escopo project/local
// cujo projectPath contém o cwd, depois user); <raiz do projeto>/.claude/skills/impeccable; ~/.claude/skills/impeccable.
// Sai 1, com os lugares conferidos no stderr, quando não acha.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';

const DETECTOR = join('skills', 'impeccable', 'scripts', 'detect.mjs');
const cwd = process.cwd();
const H = homedir();

function raizDoProjeto(inicio) {
  for (let d = inicio; ; d = dirname(d)) {
    if (existsSync(join(d, '.git'))) return d;
    if (dirname(d) === d) return null;
  }
}

function contem(pasta, alvo) {
  const p = resolve(pasta);
  return alvo === p || alvo.startsWith(p.endsWith(sep) ? p : p + sep);
}

function instalados() {
  try {
    const plugins = JSON.parse(readFileSync(join(H, '.claude', 'plugins', 'installed_plugins.json'), 'utf8').replace(/^﻿/, ''))?.plugins ?? {};
    const entradas = Object.entries(plugins)
      .filter(([nome]) => nome.startsWith('impeccable@'))
      .flatMap(([, v]) => (Array.isArray(v) ? v : []))
      .filter((e) => e && typeof e.installPath === 'string');
    const doProjeto = entradas.filter((e) => e.scope !== 'user' && typeof e.projectPath === 'string' && contem(e.projectPath, cwd));
    return [...doProjeto, ...entradas.filter((e) => e.scope === 'user')].map((e) => join(e.installPath, DETECTOR));
  } catch {
    return [];
  }
}

const raiz = raizDoProjeto(cwd);
const candidatos = [
  ...instalados(),
  ...(raiz ? [join(raiz, '.claude', DETECTOR)] : []),
  join(H, '.claude', DETECTOR),
];
const achado = candidatos.find((c) => existsSync(c));
if (achado) {
  process.stdout.write(achado + '\n');
} else {
  process.stderr.write(`Impeccable não foi encontrado. Lugares conferidos:\n${candidatos.map((c) => `  - ${c}`).join('\n')}\n`);
  process.exitCode = 1;
}
