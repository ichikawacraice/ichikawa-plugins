#!/usr/bin/env node
// SessionStart: baixa a prioridade do processo da sessão do Claude Code (macOS: `renice 10`). Tudo o que a sessão abrir
// depois — build, teste, servidor — herda, e a tela e o teclado do operador passam na frente (medido em 26/11: 46 sessões e
// builds de Rust, load 69 em 15 núcleos). Não usa `taskpolicy -b`: ele prende o processo nos núcleos de eficiência, e com
// load 30 o teste do barra foi de 3,5 s para 605 s e estourou o prazo; com só o `renice 10`, 3,5 s. Subir de volta pede
// root, então o desligamento é antes: `ICHIKAWA_PRIORIDADE_NORMAL=1`.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rodar } from './comum.mjs';

const NICE_DE_FUNDO = '10';
const PRAZO_MS = 3_000;
const MAX_SUBIDA = 12;
const E_A_SESSAO = /(^|\/)claude$/;

/** A tabela `pid ppid comm` do `ps` → o pid do primeiro ancestral de `pid` que é o executável `claude`, ou `null`. */
export function sessaoAncestral(tabela, pid) {
  const linhas = new Map();
  for (const linha of String(tabela).split('\n')) {
    const m = linha.trim().match(/^(\d+)\s+(\d+)\s+(.+)$/);
    if (m) linhas.set(Number(m[1]), { ppid: Number(m[2]), comm: m[3].trim() });
  }
  let atual = linhas.get(pid)?.ppid;
  for (let i = 0; atual && atual > 1 && i < MAX_SUBIDA; i++) {
    const p = linhas.get(atual);
    if (!p) return null;
    if (E_A_SESSAO.test(p.comm)) return atual;
    atual = p.ppid;
  }
  return null;
}

export function rebaixar({ env = process.env, plataforma = process.platform, executar = execFileSync } = {}) {
  if (plataforma !== 'darwin' || env.ICHIKAWA_PRIORIDADE_NORMAL === '1') return null;
  const tabela = executar('ps', ['-axo', 'pid=,ppid=,comm='], { encoding: 'utf8', timeout: PRAZO_MS });
  const alvo = sessaoAncestral(tabela, process.pid);
  if (!alvo) return null;
  executar('renice', [NICE_DE_FUNDO, '-p', String(alvo)], { timeout: PRAZO_MS, stdio: 'ignore' });
  return alvo;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('prioridade-de-fundo', () => { rebaixar(); });
}
