// O que os hooks dividem: ler a entrada, responder ao PreToolUse e o papel da sessão.
// Hook com erro deixa passar: a trava não pode derrubar a sessão.
import { existsSync, readFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { raiz } from '../lib/estado.mjs';

export function lerEntrada() {
  try { return JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

export const responder = (decisao, motivo) => process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decisao, permissionDecisionReason: motivo },
}));

const ID_DE_SESSAO = /^[\w-]{8,80}$/;

/** O marcador do papel: `papeis/<session_id>` com o texto `orquestradora` (gravado por `perguntas papel`). */
export const marcadorDe = (sessionId) => (ID_DE_SESSAO.test(String(sessionId ?? '')) ? join(raiz(), 'papeis', String(sessionId)) : null);

export function papelDe(sessionId) {
  const m = marcadorDe(sessionId);
  if (!m || !existsSync(m)) return null;
  try { return readFileSync(m, 'utf8').trim() || null; } catch { return null; }
}

/** O caminho absoluto que a ferramenta vai gravar, ou '' quando não grava arquivo. */
export function caminhoDe(entrada) {
  let p = entrada.tool_input?.file_path || entrada.tool_input?.notebook_path || '';
  if (!p) return '';
  if (p.startsWith('~/')) p = join(homedir(), p.slice(2));
  return resolve(entrada.cwd || process.cwd(), p);
}

/** Pastas que não são código de produto: a ~/.claude, os rascunhos e as temporárias. */
export function foraDoProduto(p) {
  return p.startsWith(join(homedir(), '.claude') + '/')
    || p.startsWith(resolve(tmpdir()) + '/')
    || /^\/(private\/)?(tmp|var\/folders)\//.test(p);
}

export function rodar(nome, fn) {
  try { fn(); } catch (err) { process.stderr.write(`${nome}: ${err?.name ?? 'Error'}\n`); }
  process.exitCode = 0;
}
