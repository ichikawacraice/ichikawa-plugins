// As sessões do Code da conta em uso, para o painel: as que mexeram nas últimas horas, quais estão respondendo agora
// (turno aberto no transcrito) e quais o app vai continuar sozinho depois de uma troca (marca de corte).
// Só lê: a lista de conversas do app e a cauda dos transcritos em `~/.claude/projects`. Não grava nada.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pastaDeProjetos } from '../troca/app-do-claude.mjs';
import { conversasEmAndamento } from '../troca/conversas.mjs';

/** Conversa mexida há mais que isso não entra na lista do painel. */
export const JANELA_MS = 24 * 60 * 60 * 1000;
/** Teto de linhas: o painel mostra as recentes, não o acervo. */
export const MAXIMO = 40;
/** Teto de JSONs abertos por leitura: cada entrada pesa centenas de KB. */
export const LEITURAS_MAXIMAS = MAXIMO * 3;
/** A varredura dos transcritos custa disco: o resultado vale por alguns segundos entre um GET e outro. */
const CACHE_MS = 10_000;

const subpastas = (dir) => { try { return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch { return []; } };
const entradas = (dir) => { try { return readdirSync(dir).filter((n) => n.startsWith('local_') && n.endsWith('.json')); } catch { return []; } };
const pastaDe = (cwd) => (typeof cwd === 'string' && cwd ? cwd.replace(/\/+$/, '').split('/').pop() : '');

let cache = { chave: '', em: 0, valor: null };

/** Só para os testes. */
export function esquecerSessoes() { cache = { chave: '', em: 0, valor: null }; }

/** Lê uma entrada e devolve só o que a tela mostra; null se ilegível ou arquivada. */
function resumoDaEntrada(caminho) {
  let obj;
  try { obj = JSON.parse(readFileSync(caminho, 'utf8')); } catch { return null; }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || obj.isArchived === true) return null;
  const cwd = typeof obj.originCwd === 'string' && obj.originCwd ? obj.originCwd : obj.cwd;
  return {
    id: typeof obj.sessionId === 'string' ? obj.sessionId : caminho.slice(caminho.lastIndexOf('/') + 1, -'.json'.length),
    cli: typeof obj.cliSessionId === 'string' ? obj.cliSessionId : '',
    titulo: (typeof obj.title === 'string' && obj.title.trim()) || pastaDe(cwd) || '(sem título)',
    pasta: pastaDe(cwd),
    modelo: typeof obj.model === 'string' ? obj.model : null,
    atividade: Number.isFinite(obj.lastActivityAt) ? obj.lastActivityAt : null,
    vaiContinuar: typeof obj.interruptedByQuitAt === 'number' && obj.interruptedAwaitingPerson !== true,
  };
}

/**
 * As sessões recentes da conta `conta` em `raiz` (`claude-code-sessions`), da mais recente para a mais antiga.
 * O filtro pela data do arquivo vem antes de abrir o JSON: cada entrada pesa centenas de KB e a lista tem milhares.
 * Devolve `{ sessoes, respondendo, vaoContinuar }`.
 */
export function lerSessoes({ raiz, conta, env = process.env, agora = Date.now(), andamento } = {}) {
  if (!raiz || !conta) return { sessoes: [], respondendo: 0, vaoContinuar: 0 };
  const chave = `${raiz}|${conta}`;
  if (andamento === undefined && cache.chave === chave && agora - cache.em < CACHE_MS) return cache.valor;
  const abertas = andamento ?? conversasEmAndamento(pastaDeProjetos(env), agora);
  // Pela data do arquivo, da mais nova para a mais antiga; o JSON só se abre até juntar o teto de conversas distintas
  // (a mesma conversa pode estar em várias organizações), com um limite de leituras para a lista não travar o servidor.
  const candidatos = [];
  for (const org of subpastas(join(raiz, conta))) {
    for (const nome of entradas(join(raiz, conta, org))) {
      const caminho = join(raiz, conta, org, nome);
      let mtime;
      try { mtime = statSync(caminho).mtimeMs; } catch { continue; }
      if (agora - mtime <= JANELA_MS) candidatos.push({ caminho, mtime });
    }
  }
  candidatos.sort((a, b) => b.mtime - a.mtime);
  const porCli = new Map();
  let lidas = 0;
  for (const { caminho, mtime } of candidatos) {
    if (porCli.size >= MAXIMO || lidas >= LEITURAS_MAXIMAS) break;
    lidas++;
    const s = resumoDaEntrada(caminho);
    if (!s) continue;
    const atual = { ...s, atividade: s.atividade ?? mtime, respondendo: Boolean(s.cli) && abertas.has(s.cli) };
    const chaveDaConversa = s.cli || s.id;
    const antes = porCli.get(chaveDaConversa);
    if (!antes || atual.atividade > antes.atividade) porCli.set(chaveDaConversa, atual); // conta com várias organizações: uma linha por conversa
  }
  const todas = [...porCli.values()].sort((a, b) => Number(b.respondendo) - Number(a.respondendo) || b.atividade - a.atividade);
  const sessoes = todas.slice(0, MAXIMO).map(({ cli: _cli, ...resto }) => resto);
  const valor = { sessoes, respondendo: todas.filter((s) => s.respondendo).length, vaoContinuar: todas.filter((s) => s.vaiContinuar).length };
  if (andamento === undefined) cache = { chave, em: agora, valor };
  return valor;
}
