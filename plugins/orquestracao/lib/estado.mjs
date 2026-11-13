// O estado de máquina do kit: perguntas, itens e o modo ausente, um arquivo por registro
// (contrato em docs/contratos.md). Nada aqui grava dentro do repositório do projeto.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, renameSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';

const PRAZO_DO_GIT_MS = 5_000;
const TENTATIVAS_DE_NUMERO = 50;

export const raiz = () => process.env.ICHIKAWA_HOME || join(homedir(), '.claude', 'ichikawa');

/** O nome do projeto: a pasta do repositório principal, igual em todos os worktrees. */
export function nomeDoProjeto(cwd = process.cwd()) {
  try {
    const comum = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd, encoding: 'utf8', timeout: PRAZO_DO_GIT_MS, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return basename(dirname(comum));
  } catch {
    return basename(cwd);
  }
}

const PREFIXO = { perguntas: 'Q', itens: 'F' };

export const pastaDe = (colecao, projeto) => join(raiz(), colecao, projeto);

function lerJson(caminho) {
  try { return JSON.parse(readFileSync(caminho, 'utf8')); } catch { return null; }
}

/** Grava por cima sem deixar arquivo pela metade: escreve ao lado e renomeia. */
function gravarJson(caminho, valor) {
  mkdirSync(dirname(caminho), { recursive: true });
  const temp = `${caminho}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(valor, null, 2)}\n`);
  renameSync(temp, caminho);
}

const numeroDe = (nome, prefixo) => {
  const m = new RegExp(`^${prefixo}(\\d+)\\.json$`).exec(nome);
  return m ? Number(m[1]) : null;
};

/** Todos os registros da coleção, do mais novo ao mais velho. */
export function listar(colecao, projeto) {
  const prefixo = PREFIXO[colecao];
  let nomes = [];
  try { nomes = readdirSync(pastaDe(colecao, projeto)); } catch { return []; }
  return nomes
    .map((n) => ({ n, num: numeroDe(n, prefixo) }))
    .filter((x) => x.num !== null)
    .sort((a, b) => b.num - a.num)
    .map((x) => lerJson(join(pastaDe(colecao, projeto), x.n)))
    .filter(Boolean);
}

/**
 * Cria o próximo registro. O número sai de varrer a pasta e criar com `wx`:
 * se outra sessão criou o mesmo número no meio, tenta o seguinte.
 */
export function criar(colecao, projeto, dados, agora = new Date()) {
  const prefixo = PREFIXO[colecao];
  const pasta = pastaDe(colecao, projeto);
  mkdirSync(pasta, { recursive: true });
  const maior = readdirSync(pasta).reduce((m, n) => Math.max(m, numeroDe(n, prefixo) ?? 0), 0);
  for (let i = 1; i <= TENTATIVAS_DE_NUMERO; i += 1) {
    const id = `${prefixo}${maior + i}`;
    const registro = { id, ...dados, criadoEm: agora.toISOString(), atualizadoEm: agora.toISOString() };
    try {
      writeFileSync(join(pasta, `${id}.json`), `${JSON.stringify(registro, null, 2)}\n`, { flag: 'wx' });
      return registro;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
  }
  throw new Error(`não consegui um número livre em ${pasta}`);
}

export function ler(colecao, projeto, id) {
  return lerJson(join(pastaDe(colecao, projeto), `${id.toUpperCase()}.json`));
}

/** Junta os campos ao registro e devolve a versão nova; null se o registro não existe. */
export function atualizar(colecao, projeto, id, campos, agora = new Date()) {
  const atual = ler(colecao, projeto, id);
  if (!atual) return null;
  const novo = { ...atual, ...campos, id: atual.id, atualizadoEm: agora.toISOString() };
  gravarJson(join(pastaDe(colecao, projeto), `${atual.id}.json`), novo);
  return novo;
}

export function lerAusente() {
  const a = lerJson(join(raiz(), 'ausente.json'));
  return a?.ligado === true ? a : null;
}

const TAMANHO_DA_SIGLA = 3;
const SIGLA_VALIDA = /^[A-Z0-9]{3}$/;
const ID_COM_SIGLA = /^(?:([A-Za-z0-9]{3})-)?([QFqf]\d+)$/;
const arquivoDeSiglas = () => join(raiz(), 'siglas.json');

/** As siglas configuradas à mão (`perguntas sigla`), por projeto. */
export function siglasConfiguradas() {
  const s = lerJson(arquivoDeSiglas());
  return s && typeof s === 'object' && !Array.isArray(s) ? s : {};
}

/** A sigla do projeto: a configurada, ou as 3 primeiras letras ou dígitos do nome (`Izanagi` → `IZA`). */
export function sigla(projeto) {
  const configurada = siglasConfiguradas()[projeto];
  if (typeof configurada === 'string' && SIGLA_VALIDA.test(configurada)) return configurada;
  return String(projeto).replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, TAMANHO_DA_SIGLA).padEnd(TAMANHO_DA_SIGLA, 'X');
}

/** O id como o operador lê: `IZA-F3`. O arquivo e o campo `id` seguem `F3`. */
export const rotulo = (projeto, id) => (id ? `${sigla(projeto)}-${String(id).toUpperCase()}` : '');

/** `IZA-F3` → { sigla: 'IZA', id: 'F3' }; `f3` → { sigla: null, id: 'F3' }; outra coisa → null. */
export function separarId(texto) {
  const m = ID_COM_SIGLA.exec(String(texto ?? '').trim());
  return m ? { sigla: m[1]?.toUpperCase() ?? null, id: m[2].toUpperCase() } : null;
}

/** Os projetos conhecidos que respondem por esta sigla. */
export const projetosDaSigla = (s, extras = []) => [...new Set([...projetos(), ...extras])].filter((p) => sigla(p) === s);

/** Grava a sigla do projeto; recusa formato inválido e sigla que outro projeto já usa. */
export function gravarSigla(projeto, nova) {
  const s = String(nova ?? '').toUpperCase();
  if (!SIGLA_VALIDA.test(s)) throw new Error('a sigla tem 3 letras ou dígitos (ex.: IZA)');
  const dono = projetosDaSigla(s).find((p) => p !== projeto);
  if (dono) throw new Error(`${s} já é de ${dono}`);
  gravarJson(arquivoDeSiglas(), { ...siglasConfiguradas(), [projeto]: s });
  return s;
}

/** Os projetos que têm alguma pergunta ou item. */
export function projetos() {
  const nomes = new Set();
  for (const colecao of Object.keys(PREFIXO)) {
    try { for (const n of readdirSync(join(raiz(), colecao))) nomes.add(n); } catch { /* coleção ainda vazia */ }
  }
  return [...nomes].sort();
}
