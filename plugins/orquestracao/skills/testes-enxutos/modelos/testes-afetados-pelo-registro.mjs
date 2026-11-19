#!/usr/bin/env node
// Os testes afetados pelo diff, pelo registro de leituras — degrau 2 da skill `orquestracao:testes-enxutos` do kit
// ichikawa-plugins. Extraído do Izanagi em 18/11/2026 (scripts/os-testes-afetados.mjs, ADRs 0556 e 0725).
//
// Copie junto com registro-de-leituras.mjs e registro-de-leituras.setup.mjs para `scripts/` (e, para o corte dos
// caros, o os-lentos.mjs do degrau 3); ponha `"test:afetados": "node scripts/testes-afetados-pelo-registro.mjs"` no
// package.json e declare o comando no CLAUDE.md.
//
// Entra o arquivo de teste que, pela ordem, com o motivo dito:
//   - `no-diff`        está no diff;
//   - `sem-registro`   é novo, ou nunca rodou nesta máquina;
//   - `le:<caminho>`   carregou ou leu um caminho do diff (ou uma `pasta/**` acima dele);
//   - `lista:<pasta>`  listou a pasta existente mais próxima de um arquivo adicionado ou apagado;
//   - `subprocesso`    lança node/shell sobre o repositório e o diff casa com o `// o-filho-le: <glob>` dele — ou ele
//                      não declarou, e então entra em todo PR, com o nome dito;
//   - `registro-cego`  a rodada que o gravou não viu os módulos (versão do vitest desconhecida).
// Quando não sabe, roda mais: diff que mexe no próprio runner (package.json, lockfile, tsconfig, config do vitest,
// estes scripts) ou registro vazio roda a suíte inteira. Diff vazio e seleção vazia dizem isso, não um verde mudo.
//
// Cortes que mandam para o gate do release (o que é cortado não some; o release roda tudo):
//   - `caro`:   mediana ≥ CARO_A_PARTIR_DE_MS no `.tempos/` do degrau 3 e não importa direto nada do diff. Sem medida,
//               não é caro.
//   - `barril`: o caminho do diff está numa pasta de BARRIS e o teste mora fora do pacote dono (o contrato fica com o
//               typecheck). Vazio por padrão: ligue só depois de medir.
//   - `filho`:  declarou o que o filho lê e o diff não toca nisso.
//
// Uso: node scripts/testes-afetados-pelo-registro.mjs [--base <ref>] [--so-listar]
//   TESTES_VITEST  comando do vitest (padrão: "npx vitest"; num monorepo pnpm, "pnpm vitest")
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leOCaminho, lerEntradas, listaAPasta, paiDe, pastaDoRegistro, RETENCAO_MS } from './registro-de-leituras.mjs';

/** O que muda o próprio runner: o registro deixa de valer e roda tudo. */
export const MUDA_O_VITEST = [
  /(^|\/)package\.json$/,
  /(^|\/)(pnpm-lock\.yaml|pnpm-workspace\.yaml|package-lock\.json|yarn\.lock|bun\.lockb?)$/,
  /(^|\/)tsconfig[^/]*\.json$/,
  /(^|\/)vitest\.[^/]*\.[cm]?[jt]s$/,
  /(^|\/)vite\.config\.[cm]?[jt]s$/,
  /(^|\/)scripts\/(registro-de-leituras(\.setup)?|testes-afetados-pelo-registro)\.mjs$/,
];

/** Um arquivo de teste: o padrão que o vitest coleta por padrão. */
export const ehArquivoDeTeste = (caminho) => /\.(test|spec)\.[cm]?[jt]sx?$/.test(caminho);

/** O arquivo caro (medido no Izanagi; meça o seu): só entra se está no diff ou importa direto o que mudou. */
export const CARO_A_PARTIR_DE_MS = 60_000;

/** Acima deste custo de worker, o seletor diz quem encareceu a seleção. */
export const TETO_DA_SELECAO_MS = 10 * 60_000;

/** Arquivo sem medida conta isto no custo da seleção. */
export const CUSTO_SEM_MEDIDA_MS = 1_000;

/**
 * Barris: `{ pasta, dono }`. Caminho do diff em `pasta` só seleciona teste dentro de `dono`; quem lê de fora (pelo
 * `index.ts`) fica para o release. Ex.: `{ pasta: 'packages/shared/src/', dono: 'packages/shared/' }`.
 */
export const BARRIS = [];

/** Os aliases de import do projeto (`{ '@/': 'src/' }`), para o corte dos caros saber o que é "importar direto". */
export const ALIASES = {};

/* ---------- glob ---------- */

/** Um glob (`**`, `*`, `?`, `{a,b}`) em RegExp, casando o caminho inteiro em POSIX. */
export function globParaRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      i++;
      if (glob[i + 1] === '/') {
        i++;
        re += '(?:.*/)?';
      } else re += '.*';
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') {
      const fim = glob.indexOf('}', i);
      if (fim < 0) re += '\\{';
      else {
        re += `(?:${glob.slice(i + 1, fim).split(',').map((p) => p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')).join('|')})`;
        i = fim;
      }
    } else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}

export const casaGlob = (caminho, glob) => globParaRegex(glob).test(caminho);

/* ---------- o diff ---------- */

/** `git diff --name-status -z` em `[{ status, caminho }]`; `T` (troca de tipo) conta como `M`. */
export function lerDiff(texto) {
  const partes = texto.split('\0');
  const itens = [];
  for (let i = 0; i + 1 < partes.length; i += 2) {
    if (partes[i] === '') continue;
    itens.push({ status: partes[i][0] === 'T' ? 'M' : partes[i][0], caminho: partes[i + 1] });
  }
  return itens;
}

/** O diff com os não rastreados, que entram como adicionados. */
export function juntarNaoRastreados(diff, naoRastreados) {
  const ja = new Set(diff.map((d) => d.caminho));
  return [...diff, ...naoRastreados.filter((c) => c !== '' && !ja.has(c)).map((caminho) => ({ status: 'A', caminho }))]
    .sort((a, b) => a.caminho.localeCompare(b.caminho));
}

/** A pasta existente mais próxima de um arquivo (pasta nova não existia na base: vale a de cima). */
export function pastaExistenteMaisProxima(caminho, existe) {
  for (let pasta = paiDe(caminho); ; pasta = paiDe(pasta)) {
    if (pasta === '.' || existe(pasta)) return pasta;
  }
}

/* ---------- a seleção ---------- */

/** O que o FILHO do teste lê, declarado no arquivo: `// o-filho-le: <glob>, <glob>`. `null` = sem declaração. */
export function oFilhoLe(texto) {
  if (typeof texto !== 'string') return null;
  const globs = [...texto.matchAll(/^[ \t]*(?:\/\/|\*)[ \t]*o-filho-le:[ \t]*(.+)$/gm)]
    .flatMap((m) => m[1].split(',').map((g) => g.trim()).filter((g) => g !== ''));
  return globs.length > 0 ? globs : null;
}

/**
 * Os caminhos que o teste importa DIRETO (relativo ou por um alias de `aliases`), com os candidatos de extensão.
 * `incerto`: há import por alias que `aliases` não conhece — aí o corte do caro não se aplica (não sabe, roda).
 */
export function importaDireto(teste, texto, aliases = ALIASES) {
  const diretos = new Set();
  let incerto = false;
  if (typeof texto !== 'string') return { diretos, incerto: true };
  const pasta = posix.dirname(teste);
  for (const m of texto.matchAll(/(?:from|import|mock|importActual)\s*\(?\s*["']([^"']+)["']/g)) {
    const especificador = m[1];
    let alvo = null;
    if (especificador.startsWith('./') || especificador.startsWith('../')) alvo = posix.join(pasta, especificador);
    else {
      const alias = Object.keys(aliases).find((a) => especificador.startsWith(a));
      if (alias !== undefined) alvo = posix.join(aliases[alias], especificador.slice(alias.length));
      else if (/^[@~#]\//.test(especificador)) incerto = true;
    }
    if (alvo === null) continue;
    const semJs = alvo.replace(/\.[cm]?js$/, '');
    for (const c of [alvo, semJs, ...['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx'].map((e) => semJs + e), `${semJs}/index.ts`]) diretos.add(c);
  }
  return { diretos, incerto };
}

const recente = (iso, agora) => typeof iso === 'string' && agora - Date.parse(iso) <= RETENCAO_MS;

const leDeForaDoBarril = (teste, caminho, barris) =>
  barris.some((b) => caminho.startsWith(b.pasta) && !teste.startsWith(b.dono));

/**
 * O motivo de um arquivo de teste entrar (`{ motivo }`, com `semDeclaracao` quando é subprocesso sem `o-filho-le`),
 * o de ficar para o release (`{ adiado: { motivo, porque } }`) ou `null`.
 */
export function motivoDoTeste(teste, { entrada, noDiff, caminhosDoDiff, buscadas, custoMs, texto, barris = BARRIS, aliases = ALIASES, agora = Date.now() }) {
  if (noDiff.has(teste)) return { motivo: 'no-diff' };
  if (entrada === undefined) return { motivo: 'sem-registro' };
  const cega = recente(entrada.cega, agora);
  const caro = typeof custoMs === 'number' && custoMs >= CARO_A_PARTIR_DE_MS;
  const imp = caro ? importaDireto(teste, texto, aliases) : null;
  const caroQueNaoImporta = (caminho) => caro && !imp.incerto && !imp.diretos.has(caminho);
  let adiado = null;
  const adiar = (motivo, porque) => void (adiado ??= { motivo, porque });
  for (const caminho of caminhosDoDiff) {
    const chave = leOCaminho(entrada.caminhos, caminho);
    if (chave === null) continue;
    if (caroQueNaoImporta(caminho)) adiar(`le:${chave}`, 'caro');
    else if (leDeForaDoBarril(teste, caminho, barris)) adiar(`le:${chave}`, 'barril');
    else return { motivo: `le:${chave}` };
  }
  for (const pasta of buscadas) {
    const chave = listaAPasta(entrada.pastas, pasta);
    if (chave === null) continue;
    if (caro && !imp.incerto) adiar(`lista:${chave}`, 'caro');
    else return { motivo: `lista:${chave}` };
  }
  if (cega) return { motivo: 'registro-cego' };
  if (recente(entrada.sempre, agora)) {
    const globs = oFilhoLe(texto);
    if (globs === null) return caro ? (adiar('subprocesso', 'caro'), { adiado }) : { motivo: 'subprocesso', semDeclaracao: true };
    if (caminhosDoDiff.some((c) => globs.some((g) => casaGlob(c, g)))) return { motivo: 'subprocesso' };
    adiar('subprocesso', 'filho');
  }
  return adiado === null ? null : { adiado };
}

/**
 * A seleção: `{ arquivos: [{arquivo, motivo}], adiados, semDeclaracao, semLeitor }`.
 * `diff`: `[{status, caminho}]`; `universo`: os arquivos de teste (sem os apagados); `entradas`: o registro;
 * `pastaExiste(pasta)`: existia na base; `custo`: `Map arquivo → ms`; `textoDe(arquivo)`: o texto do teste.
 */
export function selecionar({ diff, universo, entradas, pastaExiste, custo = new Map(), textoDe = () => null, barris = BARRIS, aliases = ALIASES, agora = Date.now() }) {
  const caminhosDoDiff = [...new Set(diff.map((d) => d.caminho))].sort();
  const noDiff = new Set(diff.filter((d) => d.status !== 'D').map((d) => d.caminho));
  const buscadas = [...new Set(diff.filter((d) => d.status === 'A' || d.status === 'D')
    .map((d) => pastaExistenteMaisProxima(d.caminho, pastaExiste)))].sort();
  const porTeste = new Map(entradas.map((e) => [e.teste, e]));
  const arquivos = [];
  const adiados = [];
  const semDeclaracao = [];
  for (const arquivo of [...universo].sort()) {
    const entrada = porTeste.get(arquivo);
    const custoMs = custo.get(arquivo);
    // O texto só se lê de quem precisa: o caro (importa direto?) e o que lança subprocesso (declarou?).
    const precisaDoTexto = (typeof custoMs === 'number' && custoMs >= CARO_A_PARTIR_DE_MS) || typeof entrada?.sempre === 'string';
    const r = motivoDoTeste(arquivo, {
      entrada, noDiff, caminhosDoDiff, buscadas, custoMs, texto: precisaDoTexto ? textoDe(arquivo) : null, barris, aliases, agora,
    });
    if (r === null) continue;
    if (r.adiado) adiados.push({ arquivo, ...r.adiado });
    else {
      arquivos.push({ arquivo, motivo: r.motivo });
      if (r.semDeclaracao) semDeclaracao.push(arquivo);
    }
  }
  const semLeitor = caminhosDoDiff.filter((c) => {
    if (ehArquivoDeTeste(c) || entradas.some((e) => leOCaminho(e.caminhos, c) !== null)) return false;
    const pasta = pastaExistenteMaisProxima(c, pastaExiste);
    return !entradas.some((e) => listaAPasta(e.pastas, pasta) !== null);
  });
  return { arquivos, adiados, semDeclaracao, semLeitor };
}

/** O custo somado por motivo, do maior ao menor: `[{ motivo, arquivos, custoMs }]`. */
export function gatilhosDaSelecao(arquivos, custo) {
  const porMotivo = new Map();
  for (const { arquivo, motivo } of arquivos) {
    const g = porMotivo.get(motivo) ?? { motivo, arquivos: 0, custoMs: 0 };
    g.arquivos += 1;
    g.custoMs += custo.get(arquivo) ?? CUSTO_SEM_MEDIDA_MS;
    porMotivo.set(motivo, g);
  }
  return [...porMotivo.values()].sort((a, b) => b.custoMs - a.custoMs || a.motivo.localeCompare(b.motivo));
}

/** As declarações `o-filho-le` cujo glob não casa com nenhum arquivo rastreado: `[{ arquivo, glob }]`. */
export function globsMortos(textos, rastreados) {
  const mortos = [];
  for (const [arquivo, texto] of textos) {
    for (const glob of oFilhoLe(texto) ?? []) {
      const re = globParaRegex(glob);
      if (!rastreados.some((c) => re.test(c))) mortos.push({ arquivo, glob });
    }
  }
  return mortos;
}

/* ---------- a borda: git, disco, vitest ---------- */

const PRAZO_DO_GIT_MS = 30_000;

function git(args) {
  return execFileSync('git', args, {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: PRAZO_DO_GIT_MS, killSignal: 'SIGKILL', maxBuffer: 256 * 1024 * 1024,
  });
}

const existeRef = (ref) => {
  try {
    git(['rev-parse', '--verify', '--quiet', ref]);
    return true;
  } catch {
    return false;
  }
};

/** O tronco: `--base`, senão origin/develop, senão origin/main. */
export const baseDoDiff = (pedida, existe = existeRef) => pedida || (['origin/develop', 'origin/main'].find(existe) ?? 'HEAD');

/** O custo de cada arquivo pela mediana do `.tempos/` do degrau 3; vazio se o os-lentos ou as rodadas não estão lá. */
async function custoDosTempos(raiz, pasta = '.tempos', rodadas = 10) {
  try {
    const { maisCaros, temposDoRelatorio } = await import('./os-lentos.mjs');
    const nomes = readdirSync(join(raiz, pasta)).filter((a) => a.endsWith('.json')).sort().reverse().slice(0, rodadas);
    const lidas = nomes.map((a) => temposDoRelatorio(JSON.parse(readFileSync(join(raiz, pasta, a), 'utf8')), raiz));
    return new Map(maisCaros(lidas).map((x) => [x.arquivo, x.mediana]));
  } catch {
    return new Map();
  }
}

const dizer = (texto) => process.stderr.write(`[afetados] ${texto}\n`);
const minutos = (ms) => `${Math.floor(ms / 60_000)}m${String(Math.round((ms % 60_000) / 1000)).padStart(2, '0')}s`;
const PORQUES = {
  caro: `custam ${CARO_A_PARTIR_DE_MS / 1000} s ou mais e não importam direto o diff`,
  barril: 'só leem o diff pelo barril de outro pacote',
  filho: 'o filho declarado não lê o diff',
};

function argumentos(argv) {
  const r = { base: null, soListar: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') r.base = argv[++i];
    else if (argv[i] === '--so-listar') r.soListar = true;
    else throw new Error(`argumento desconhecido: ${argv[i]} — use --base <ref> e --so-listar`);
  }
  return r;
}

function rodar(arquivos, soListar, relatorio) {
  if (soListar) {
    process.stdout.write(`${JSON.stringify(relatorio, null, 2)}\n`);
    return 0;
  }
  const [comando, ...antes] = (process.env.TESTES_VITEST || 'npx vitest').split(' ');
  const args = arquivos === null ? [...antes, 'run'] : [...antes, 'run', ...arquivos];
  return spawnSync(comando, args, { stdio: 'inherit' }).status ?? 1;
}

async function main() {
  const { base: pedida, soListar } = argumentos(process.argv.slice(2));
  const raiz = git(['rev-parse', '--show-toplevel']).trim();
  process.chdir(raiz);
  const base = baseDoDiff(pedida);
  const mergeBase = git(['merge-base', 'HEAD', base]).trim();
  const diff = juntarNaoRastreados(
    lerDiff(git(['diff', '--name-status', '--no-renames', '-z', mergeBase])),
    git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0'),
  );
  if (diff.length === 0) {
    dizer(`nada mudou contra ${base} — não há o que rodar`);
    return soListar ? rodar([], true, { base, modo: 'nada' }) : 0;
  }
  const caminhos = diff.map((d) => d.caminho);
  const runner = caminhos.filter((c) => MUDA_O_VITEST.some((r) => r.test(c)));
  if (runner.length > 0) {
    dizer(`o diff mexe no próprio runner (${runner.slice(0, 3).join(', ')}${runner.length > 3 ? ', …' : ''}) — o registro não vale: roda a suíte inteira`);
    return rodar(null, soListar, { base, modo: 'tudo', motivo: 'muda-o-runner', caminhos: runner });
  }
  const dir = pastaDoRegistro(raiz);
  const entradas = dir ? lerEntradas(dir) : [];
  if (entradas.length === 0) {
    dizer(`nenhum teste tem registro nesta máquina (${dir}) — roda a suíte inteira, que grava o registro`);
    return rodar(null, soListar, { base, modo: 'tudo', motivo: 'sem-registro' });
  }
  const apagados = new Set(diff.filter((d) => d.status === 'D').map((d) => d.caminho));
  const rastreados = git(['ls-files', '-z']).split('\0').filter(Boolean);
  const universo = [...new Set([...rastreados, ...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0')])]
    .filter((c) => c !== '' && ehArquivoDeTeste(c) && !apagados.has(c) && !/(^|\/)(node_modules|dist)\//.test(c));
  const pastasDaBase = diff.some((d) => d.status === 'A' || d.status === 'D')
    ? new Set(git(['ls-tree', '-d', '-r', '--name-only', '-z', mergeBase]).split('\0').filter(Boolean))
    : null;
  const custo = await custoDosTempos(raiz);
  const textos = new Map();
  const textoDe = (arquivo) => {
    if (!textos.has(arquivo)) {
      try {
        textos.set(arquivo, readFileSync(arquivo, 'utf8'));
      } catch {
        textos.set(arquivo, null);
      }
    }
    return textos.get(arquivo);
  };
  const sel = selecionar({ diff, universo, entradas, pastaExiste: pastasDaBase ? (p) => pastasDaBase.has(p) : () => true, custo, textoDe });

  dizer(`contra ${base}: ${diff.length} caminho(s) no diff, ${sel.arquivos.length} de ${universo.length} arquivos de teste`);
  for (const { arquivo, motivo } of sel.arquivos.slice(0, 8)) dizer(`  ${arquivo} (${motivo})`);
  if (sel.arquivos.length > 8) dizer(`  … e mais ${sel.arquivos.length - 8}`);
  if (sel.semLeitor.length > 0) dizer(`nenhum teste lê nem lista: ${sel.semLeitor.slice(0, 8).join(', ')}${sel.semLeitor.length > 8 ? ', …' : ''}`);
  for (const [porque, frase] of Object.entries(PORQUES)) {
    const deles = sel.adiados.filter((a) => a.porque === porque);
    if (deles.length > 0) dizer(`ficam para o gate do release: ${deles.length} arquivo(s) que ${frase} (ex.: ${deles[0].arquivo})`);
  }
  if (sel.semDeclaracao.length > 0) {
    dizer(`${sel.semDeclaracao.length} arquivo(s) rodam em TODO PR porque lançam subprocesso sem \`// o-filho-le: <glob>\`: ${sel.semDeclaracao.slice(0, 4).join(', ')}${sel.semDeclaracao.length > 4 ? ', …' : ''}`);
  }
  for (const { arquivo, glob } of globsMortos([...textos].filter(([, t]) => t !== null), rastreados)) {
    dizer(`glob morto: \`o-filho-le: ${glob}\` em ${arquivo} não casa com nenhum arquivo — o teste nunca entra pelo filho`);
  }
  const gatilhos = gatilhosDaSelecao(sel.arquivos, custo);
  const total = gatilhos.reduce((s, g) => s + g.custoMs, 0);
  if (total > TETO_DA_SELECAO_MS) {
    dizer(`a seleção passa do teto: ~${minutos(total)} de worker (teto ${minutos(TETO_DA_SELECAO_MS)}). Quem a encareceu:`);
    for (const g of gatilhos.slice(0, 5)) dizer(`  ~${minutos(g.custoMs)} em ${g.arquivos} arquivo(s) — ${g.motivo}`);
  }
  const relatorio = { base, mergeBase, modo: 'registro', registro: { dir, entradas: entradas.length }, diff, ...sel };
  if (sel.arquivos.length === 0) {
    dizer('a seleção ficou vazia: nenhum teste lê, lista ou carrega o que o diff mexe — não há o que rodar');
    return soListar ? rodar([], true, relatorio) : 0;
  }
  return rodar(sel.arquivos.map((a) => a.arquivo), soListar, relatorio);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (err) {
    process.stderr.write(`testes-afetados-pelo-registro: ${err.message}\n`);
    process.exitCode = 2;
  }
}
