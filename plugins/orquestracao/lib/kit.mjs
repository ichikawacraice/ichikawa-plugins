// O aviso de kit novo do Painel: algum plugin deste marketplace instalado com arquivos diferentes dos da `main`.
// O clone do marketplace que o Claude guarda é raso (só o último commit), então a comparação é por conteúdo: o hash de
// blob do git de cada arquivo da pasta instalada contra o `ls-tree` da `origin/main`. Arquivo a mais na pasta instalada
// (`.in_use`, tipos gerados) não conta. A conferência roda na carga da página, no máximo uma vez por minuto, e busca a
// `main` no GitHub no máximo uma vez a cada 30 min; nada fica rodando em segundo plano.
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const MARKETPLACE = 'ichikawa-plugins';
const INTERVALO_LOCAL_MS = 60 * 1000;
const INTERVALO_DA_BUSCA_MS = 30 * 60 * 1000;
const PRAZO_DO_GIT_MS = 20_000;
const SHA = /^[0-9a-f]{40}$/;

const pastaClaude = () => process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');

/**
 * As instalações dos plugins deste marketplace em `installed_plugins.json`: `{ nome, pasta, escopo, projeto }`, com
 * `projeto` só nos escopos `local` e `project`. `[]` se ilegível.
 */
export function instalados(texto) {
  let dados;
  try { dados = JSON.parse(texto); } catch { return []; }
  const fim = `@${MARKETPLACE}`;
  const r = [];
  for (const [chave, lista] of Object.entries(dados?.plugins ?? {})) {
    if (!chave.endsWith(fim) || !Array.isArray(lista)) continue;
    for (const i of lista) {
      if (typeof i?.installPath !== 'string' || !i.installPath) continue;
      const escopo = typeof i.scope === 'string' ? i.scope : 'user';
      const projeto = escopo === 'user' || typeof i.projectPath !== 'string' ? null : i.projectPath;
      r.push({ nome: chave.slice(0, -fim.length), pasta: i.installPath, escopo, projeto });
    }
  }
  return r;
}

/** `{ caminho relativo: sha do blob }` a partir das linhas de `git ls-tree -r <ref> -- plugins/<nome>/`. */
export function arvore(saida, nome) {
  const prefixo = `plugins/${nome}/`;
  const r = {};
  for (const linha of saida.split('\n')) {
    const m = /^\d+ blob ([0-9a-f]{40})\t(.+)$/.exec(linha);
    if (m && m[2].startsWith(prefixo)) r[m[2].slice(prefixo.length)] = m[1];
  }
  return r;
}

/** O sha que o git daria ao arquivo (`git hash-object`): sha1 de `blob <tamanho>\0<conteúdo>`. */
export const shaDoBlob = (conteudo) => createHash('sha1').update(`blob ${conteudo.length}\0`).update(conteudo).digest('hex');

/** Algum arquivo da `main` falta ou difere na pasta instalada. */
export async function pastaDifere(pasta, esperado, ler = readFile) {
  for (const [caminho, sha] of Object.entries(esperado)) {
    try {
      if (shaDoBlob(await ler(join(pasta, caminho))) !== sha) return true;
    } catch { return true; }
  }
  return false;
}

function rodarGit(pasta) {
  return (args) => new Promise((ok) => {
    execFile('git', ['-C', pasta, ...args], { timeout: PRAZO_DO_GIT_MS, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      ok({ codigo: err ? (typeof err.code === 'number' ? err.code : -1) : 0, saida: String(stdout ?? '').trim() });
    });
  });
}

/**
 * `{ velhos, main }`: as instalações que diferem da `origin/main` do clone do marketplace (por nome, as de usuário
 * primeiro) e o sha dela; instalação de projeto cuja pasta já não existe fica de fora; `null` sem plugin deste marketplace ou sem clone legível. `buscar` traz a `main` do GitHub antes
 * (falha na busca não impede a conferência com o que o clone já tem).
 */
export async function conferirKit({
  base = pastaClaude(),
  buscar = false,
  git = rodarGit(join(base, 'plugins', 'marketplaces', MARKETPLACE)),
  ler = readFile,
  existe = existsSync,
} = {}) {
  let texto;
  try { texto = readFileSync(join(base, 'plugins', 'installed_plugins.json'), 'utf8'); } catch { return null; }
  const lista = instalados(texto).filter((i) => !i.projeto || existe(i.projeto));
  if (!lista.length) return null;
  if (buscar) await git(['fetch', '--quiet', '--depth=1', 'origin', 'main']);
  const { codigo, saida: main } = await git(['rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main^{commit}']);
  if (codigo !== 0 || !SHA.test(main)) return null;
  const arvores = new Map();
  const velhos = [];
  for (const i of lista) {
    if (!arvores.has(i.nome)) {
      const r = await git(['ls-tree', '-r', main, '--', `plugins/${i.nome}/`]);
      arvores.set(i.nome, r.codigo === 0 ? arvore(r.saida, i.nome) : {});
    }
    const esperado = arvores.get(i.nome);
    // Plugin que saiu da `main` (ou ls-tree falhou): não há o que comparar.
    if (Object.keys(esperado).length && await pastaDifere(i.pasta, esperado, ler)) velhos.push({ nome: i.nome, escopo: i.escopo, projeto: i.projeto });
  }
  velhos.sort((a, b) => a.nome.localeCompare(b.nome) || Number(Boolean(a.projeto)) - Number(Boolean(b.projeto)) || String(a.projeto).localeCompare(String(b.projeto)));
  return { velhos, main };
}

/**
 * O último resultado conhecido, para a página desenhar já; se passou o intervalo, dispara outra conferência sem
 * esperar por ela (o recarregamento de 30 s da página mostra o resultado novo).
 */
export function criarAviso({ conferir = conferirKit, intervaloLocal = INTERVALO_LOCAL_MS, intervaloDaBusca = INTERVALO_DA_BUSCA_MS } = {}) {
  let ultimo = null;
  let conferidoEm = -Infinity;
  let buscadoEm = -Infinity;
  let emCurso = null;
  const aviso = (agora = Date.now()) => {
    if (!emCurso && agora - conferidoEm >= intervaloLocal) {
      const buscar = agora - buscadoEm >= intervaloDaBusca;
      conferidoEm = agora;
      if (buscar) buscadoEm = agora;
      emCurso = conferir({ buscar }).then((r) => { ultimo = r; }, () => {}).finally(() => { emCurso = null; });
    }
    return ultimo;
  };
  aviso.esperar = () => emCurso ?? Promise.resolve();
  return aviso;
}

const aspas = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;

/** O comando que põe o kit em dia: o marketplace primeiro, depois cada instalação velha (a de projeto, de dentro dele). */
export const comandoDeAtualizar = (velhos) => [
  `claude plugin marketplace update ${MARKETPLACE}`,
  ...velhos.map(({ nome, escopo, projeto }) => (projeto
    ? `(cd ${aspas(projeto)} && claude plugin update ${nome}@${MARKETPLACE} --scope ${escopo})`
    : `claude plugin update ${nome}@${MARKETPLACE}`)),
].join(' && ');

const WORKTREE = /^(.*)\/\.claude\/worktrees\/[^/]+\/?$/;
const ultimaPasta = (caminho) => caminho.split('/').filter(Boolean).pop() ?? caminho;
const nomeDoProjeto = (projeto) => {
  const m = WORKTREE.exec(projeto);
  return m ? `${ultimaPasta(m[1])}, worktree` : ultimaPasta(projeto);
};

/** O nome curto de cada instalação velha: `barra`, `design-wicomm (WiControl)`, `design-wicomm (WiControl, worktree)`. */
export const nomesDosVelhos = (velhos) => [...new Set(velhos.map(({ nome, projeto }) => (projeto ? `${nome} (${nomeDoProjeto(projeto)})` : nome)))];
