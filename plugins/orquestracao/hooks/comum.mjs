// O que os hooks dividem: ler a entrada, responder ao PreToolUse e o papel da sessão.
// Hook com erro deixa passar: a trava não pode derrubar a sessão.
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readFileSync, readSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { raiz } from '../lib/estado.mjs';

export function lerEntrada() {
  try { return JSON.parse(readFileSync(0, 'utf8') || '{}'); } catch { return {}; }
}

export const responder = (decisao, motivo) => process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decisao, permissionDecisionReason: motivo },
}));

/** PostToolUse: só devolve contexto ao modelo (não bloqueia nem pergunta). */
export const avisar = (contexto) => process.stdout.write(JSON.stringify({
  hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: contexto },
}));

/** Os textos que uma edição grava: `content` (Write), `new_string` (Edit) e cada `edits[].new_string` (MultiEdit). */
export function textoGravado(entrada) {
  const i = entrada.tool_input ?? {};
  const partes = [i.content, i.new_string, ...(Array.isArray(i.edits) ? i.edits.map((e) => e?.new_string) : [])];
  return partes.filter((t) => typeof t === 'string');
}

const ID_DE_SESSAO = /^[\w-]{8,80}$/;

/** O marcador do papel: `papeis/<session_id>` com o texto `orquestradora` (gravado por `perguntas papel`). */
export const marcadorDe = (sessionId) => (ID_DE_SESSAO.test(String(sessionId ?? '')) ? join(raiz(), 'papeis', String(sessionId)) : null);

/** A limpeza pendente da orquestradora: gravada pelo Stop, apagada pelo `passar-papel`. */
export const limpezaPendenteDe = (sessionId) => { const m = marcadorDe(sessionId); return m ? `${m}.limpeza-pendente` : null; };

export function papelDe(sessionId) {
  const m = marcadorDe(sessionId);
  if (!m || !existsSync(m)) return null;
  try { return readFileSync(m, 'utf8').trim() || null; } catch { return null; }
}

// O /clear troca o session_id: o papel passa ao id novo pela `passagem.json`, gravada logo antes de limpar.
const PASSAGEM_VALE_MS = 15 * 60_000;
const passagem = () => join(raiz(), 'papeis', 'passagem.json');
const pastaReal = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

/** Grava a passagem do papel da sessão `de` para a próxima sessão que começar na mesma pasta. */
export function gravarPassagem(de, cwd, agora = Date.now()) {
  const papel = papelDe(de);
  if (!papel) throw new Error(`sessão ${de} sem papel: rode antes \`perguntas papel orquestradora --sessao-id ${de}\``);
  mkdirSync(join(raiz(), 'papeis'), { recursive: true });
  writeFileSync(passagem(), JSON.stringify({ papel, de, cwd: pastaReal(cwd), em: agora }));
  rmSync(limpezaPendenteDe(de), { force: true });
  return papel;
}

/** No início de uma sessão sem papel: herda o da passagem fresca da mesma pasta (nunca num resume). */
export function herdarPapel(entrada, agora = Date.now()) {
  const novo = marcadorDe(entrada.session_id);
  if (!novo || existsSync(novo) || entrada.source === 'resume') return null;
  let p;
  try { p = JSON.parse(readFileSync(passagem(), 'utf8')); } catch { return null; }
  if (!p?.papel || pastaReal(entrada.cwd || process.cwd()) !== p.cwd || agora - p.em > PASSAGEM_VALE_MS) return null;
  writeFileSync(novo, `${p.papel}\n`);
  rmSync(passagem(), { force: true });
  const velho = marcadorDe(p.de);
  if (velho && velho !== novo) rmSync(velho, { force: true });
  return p.papel;
}

const CAUDA_DO_TRANSCRIPT = 512 * 1024;

/** O tamanho do contexto na última resposta, pelo `usage` do transcript (o mesmo número do get_usage). */
export function tokensDoContexto(transcriptPath) {
  let fd;
  try {
    fd = openSync(transcriptPath, 'r');
    const tamanho = fstatSync(fd).size;
    const n = Math.min(tamanho, CAUDA_DO_TRANSCRIPT);
    const buf = Buffer.alloc(n);
    readSync(fd, buf, 0, n, tamanho - n);
    const linhas = buf.toString('utf8').split('\n');
    for (let i = linhas.length - 1; i >= 0; i -= 1) {
      let u;
      try { u = JSON.parse(linhas[i])?.message?.usage; } catch { continue; }
      if (u) return (u.input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0);
    }
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
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
