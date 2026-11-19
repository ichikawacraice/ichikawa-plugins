// O registro do que cada arquivo de teste lê — degrau 2 da skill `orquestracao:testes-enxutos` do kit ichikawa-plugins.
// Extraído do Izanagi em 18/11/2026 (scripts/o-registro-de-leituras.mjs, ADRs 0556 e 0725), sem o que era só de lá.
//
// Os três arquivos do degrau 2 vão juntos para `scripts/` do projeto:
//   - registro-de-leituras.mjs          (este) o formato, as regras de caminho, a classificação de subprocesso e o
//                                       `registroDeLeituras()` que o config do vitest chama;
//   - registro-de-leituras.setup.mjs    o `setupFiles` que grava, dentro de cada worker;
//   - testes-afetados-pelo-registro.mjs o seletor, que cruza o registro com o diff.
//
// No config do vitest (o `test` de `vitest.config.ts`, ou de cada projeto):
//
//   import { registroDeLeituras } from './scripts/registro-de-leituras.mjs';
//   export default defineConfig({ test: { setupFiles: [...registroDeLeituras().setupFiles] } });
//
// O formato de uma entrada (`<git-common-dir>/registro-de-leituras/<sha1 do teste>.json`, fora de todos os worktrees):
//
//   { teste, commit, caminhos: {<rel>: <iso>}, pastas: {<rel>: <iso>}, sempre: <iso>|null, cega: <iso>|null }
//
// `caminhos`: módulos que o arquivo carregou, arquivos lidos ou copiados, caminhos passados a subprocesso; `pasta/**`
// diz que tudo abaixo da pasta foi lido. `pastas`: as listagens (readdir, glob, git ls-files). `sempre`: o teste lança
// node/shell/gerenciador de pacote sobre o repositório (o que o filho lê não passa por aqui). `cega`: a rodada não
// conseguiu ver os módulos carregados (versão do vitest que este modelo não conhece) — o seletor roda o teste sempre.
// Tudo relativo à raiz, em POSIX; cada caminho guarda a data da última rodada que o viu, e o que ninguém viu em
// RETENCAO_MS sai.
//
// Só Node: nada de vitest aqui, para o config e o seletor importarem sem carregar o runner.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Quanto tempo um caminho vale sem que nenhuma rodada o veja de novo. */
export const RETENCAO_MS = 14 * 24 * 60 * 60 * 1000;

/** O nome da pasta do registro dentro do diretório comum do git. */
export const PASTA_DO_REGISTRO = 'registro-de-leituras';

/** As variáveis que o config grava no processo principal e os workers herdam (e a que desliga o registro). */
export const VARIAVEIS = Object.freeze({
  desliga: 'SEM_REGISTRO_DE_LEITURAS',
  dir: 'REGISTRO_DE_LEITURAS_DIR',
  raiz: 'REGISTRO_DE_LEITURAS_RAIZ',
  commit: 'REGISTRO_DE_LEITURAS_COMMIT',
});

/** O setup que cada worker carrega. */
export const SETUP_DO_REGISTRO = fileURLToPath(new URL('./registro-de-leituras.setup.mjs', import.meta.url));

const PRAZO_DO_GIT_MS = 10_000;

function gitOuNulo(args, cwd) {
  try {
    return execFileSync('git', args, {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: PRAZO_DO_GIT_MS, killSignal: 'SIGKILL',
    }).trim();
  } catch {
    return null;
  }
}

/** `CI` ligado: qualquer valor que não seja vazio, `false` ou `0`. */
export const ehCI = (env) => typeof env.CI === 'string' && !['', 'false', '0'].includes(env.CI.toLowerCase());

/**
 * O pedaço do config do vitest que liga o registro: `{ setupFiles: [SETUP_DO_REGISTRO] }`, ou `{ setupFiles: [] }`.
 *
 * Desligado no CI (lá não há registro anterior a consultar) e com `SEM_REGISTRO_DE_LEITURAS=1`. O config roda no
 * processo principal do vitest: é ali que se grava no ambiente a raiz, a pasta e o commit, e os workers herdam.
 * Variável já posta por quem chamou vale — é o que faz um vitest aninhado num teste (sobre fixture fora da raiz)
 * herdar a raiz de verdade e não gravar nada.
 */
export function registroDeLeituras(env = process.env, { cwd = process.cwd(), git = gitOuNulo } = {}) {
  if (ehCI(env) || env[VARIAVEIS.desliga] === '1') return { setupFiles: [] };
  const raiz = env[VARIAVEIS.raiz] || git(['rev-parse', '--show-toplevel'], cwd);
  const comum = env[VARIAVEIS.dir] ? null : git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  const dir = env[VARIAVEIS.dir] || (comum ? join(comum, PASTA_DO_REGISTRO) : null);
  if (!raiz || !dir) {
    console.error('[registro] não li a raiz e a pasta comum do git — o registro fica desligado nesta rodada');
    return { setupFiles: [] };
  }
  env[VARIAVEIS.raiz] = raiz;
  env[VARIAVEIS.dir] = dir;
  env[VARIAVEIS.commit] = env[VARIAVEIS.commit] || git(['rev-parse', 'HEAD'], raiz) || '';
  return { setupFiles: [SETUP_DO_REGISTRO] };
}

/** A pasta do registro de um repositório (para o seletor). */
export function pastaDoRegistro(cwd = process.cwd(), env = process.env, git = gitOuNulo) {
  if (env[VARIAVEIS.dir]) return env[VARIAVEIS.dir];
  const comum = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd);
  return comum ? join(comum, PASTA_DO_REGISTRO) : null;
}

/**
 * Os módulos que o worker do vitest carregou, como caminho absoluto; `null` quando esta versão do vitest não mostra.
 * API interna, medida em 18/11/2026: vitest 2 e 3 têm `moduleCache` (vite-node); 4 e 5 têm
 * `evaluatedModules.fileToModulesMap` (module runner do Vite). Pela CHAVE, não pelo "avaliado": o `vi.resetModules()`
 * apaga o estado de avaliação e deixa a chave. Módulo a mais (um `vi.mock` que nunca carregou o original) só alarga.
 */
export function modulosDoWorker(estadoDoWorker) {
  const mapa = estadoDoWorker?.moduleCache ?? estadoDoWorker?.evaluatedModules?.fileToModulesMap;
  if (mapa === null || mapa === undefined || typeof mapa.keys !== 'function') return null;
  const caminhos = [];
  for (const chave of mapa.keys()) {
    caminhos.push(String(chave).replace(/^file:\/\//, '').replace(/^\/@fs\//, '/').split(/[?#]/)[0]);
  }
  return caminhos;
}

/** Comandos que, lançados sobre o repositório, rodam código dele: o teste que os usa roda sempre. */
export const COMANDOS_QUE_RODAM_O_REPO = Object.freeze([
  'node', 'tsx', 'ts-node', 'bun', 'deno', 'npm', 'pnpm', 'yarn', 'npx', 'vitest', 'tsc', 'make', 'python', 'python3',
  'bash', 'sh', 'zsh',
]);

const SHELLS = new Set(['bash', 'sh', 'zsh']);
/** Os comandos de shell que rodam o arquivo que recebem no próprio shell (`source x.sh`). */
const QUE_CARREGAM = new Set(['source', '.']);
/** As palavras que só prefixam o comando de verdade (`env X=1 node …`). */
const PREFIXOS = new Set(['env', 'exec', 'command', 'nohup', 'time']);
const ATRIBUICAO = /^[A-Za-z_][A-Za-z0-9_]*=/;

/**
 * Os subcomandos do git que enumeram ou leem a árvore. `le`: o conteúdo também conta (`grep`, `diff`);
 * `pula`: o primeiro argumento solto não é pathspec (o padrão do `grep`, salvo `-e`/`-f`; o tree-ish do `ls-tree`).
 */
const GIT_QUE_VARRE = Object.freeze({
  'ls-files': { le: false, pula: null },
  'ls-tree': { le: false, pula: 'sempre' },
  grep: { le: true, pula: 'padrao' },
  diff: { le: true, pula: null },
});
const GREP_COM_VALOR = new Set(['-e', '-f']);
const GIT_GLOBAL_COM_VALOR = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--super-prefix', '--config-env']);
/** Os que leem o `cwd` mesmo sem script no argumento (`pnpm test`, `npx tsc`). */
const LEEM_O_CWD = new Set(['tsx', 'ts-node', 'bun', 'deno', 'npm', 'pnpm', 'yarn', 'npx', 'vitest', 'tsc', 'make']);
/** Pastas que nunca entram: dependência de terceiros e o próprio git. */
const FORA_DO_REGISTRO = new Set(['node_modules', '.git']);

const posix = (caminho) => caminho.split(sep).join('/');

/**
 * Um caminho absoluto, relativo à raiz e em POSIX; `""` é a própria raiz. `null` se está fora de todas as `raizes`
 * (a crua e a real: `/var` → `/private/var` no macOS) ou dentro de `node_modules` / `.git`.
 */
export function relativoARaiz(absoluto, raizes) {
  if (typeof absoluto !== 'string' || !isAbsolute(absoluto)) return null;
  const limpo = absoluto.length > 1 && absoluto.endsWith(sep) ? absoluto.slice(0, -1) : absoluto;
  for (const raiz of raizes) {
    if (!raiz) continue;
    if (limpo === raiz) return '';
    if (!limpo.startsWith(raiz + sep)) continue;
    const rel = posix(limpo.slice(raiz.length + 1));
    if (rel.split('/').some((parte) => FORA_DO_REGISTRO.has(parte))) return null;
    return rel;
  }
  return null;
}

/** O caminho absoluto de um argumento de `fs`/`child_process`: string, `Buffer` ou `URL` de arquivo; o resto, `null`. */
export function absolutoDe(arg, cwd = process.cwd()) {
  try {
    if (typeof arg === 'string') return arg === '' ? null : resolve(cwd, arg);
    if (arg instanceof Uint8Array) return arg.length === 0 ? null : resolve(cwd, Buffer.from(arg).toString());
    // Pelo formato, não por `instanceof URL`: no ambiente jsdom o `URL` global é outro.
    if (arg !== null && typeof arg === 'object' && typeof arg.href === 'string' && typeof arg.protocol === 'string') {
      return arg.protocol === 'file:' ? fileURLToPath(String(arg.href)) : null;
    }
  } catch {
    /* URL malformada: não é caminho */
  }
  return null;
}

/** O sufixo de uma pasta lida ou listada em profundidade: `src/**` vê qualquer arquivo abaixo dela. */
export const RECURSIVA = '/**';

/** A pasta pai de um caminho relativo; a raiz é `.`. */
export const paiDe = (rel) => (rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '.');

/** A chave `<ancestral>/**` do `mapa` que cobre esta pasta (ela mesma ou acima), ou `null`. */
export function ancestralFundo(mapa, pasta) {
  if (mapa === null || typeof mapa !== 'object') return null;
  for (let atual = pasta; ; atual = paiDe(atual)) {
    const marca = `${atual}${RECURSIVA}`;
    if (Object.hasOwn(mapa, marca)) return marca;
    if (atual === '.') return null;
  }
}

/** A chave de `pastas` que enxerga esta pasta: ela (listada rasa) ou uma ancestral listada funda; `null` se nenhuma. */
export function listaAPasta(pastas, pasta) {
  if (pastas === null || typeof pastas !== 'object') return null;
  if (Object.hasOwn(pastas, pasta)) return pasta;
  return ancestralFundo(pastas, pasta);
}

/** A chave de `caminhos` que diz que o teste leu este arquivo: ele, ou uma pasta acima lida inteira; `null` se nenhuma. */
export function leOCaminho(caminhos, caminho) {
  if (caminhos === null || typeof caminhos !== 'object') return null;
  if (Object.hasOwn(caminhos, caminho)) return caminho;
  return ancestralFundo(caminhos, paiDe(caminho));
}

/** O arquivo de uma entrada: o sha1 do caminho relativo do teste. */
export const arquivoDaEntrada = (dir, teste) => join(dir, `${createHash('sha1').update(teste).digest('hex')}.json`);

function semOVelho(mapa, agora, retencaoMs) {
  const saida = {};
  if (mapa === null || typeof mapa !== 'object') return saida;
  for (const [caminho, iso] of Object.entries(mapa)) {
    const quando = typeof iso === 'string' ? Date.parse(iso) : NaN;
    if (Number.isNaN(quando) || agora - quando > retencaoMs) continue;
    saida[caminho] = iso;
  }
  return saida;
}

function unirMapas(a, b) {
  const saida = { ...a };
  for (const [caminho, iso] of Object.entries(b)) {
    if (saida[caminho] === undefined || Date.parse(iso) > Date.parse(saida[caminho])) saida[caminho] = iso;
  }
  return saida;
}

const marcaRecente = (iso, agora, retencaoMs) => (typeof iso === 'string' && agora - Date.parse(iso) <= retencaoMs ? iso : null);

/**
 * A entrada nova: a união da `anterior` (sem o que passou do prazo) com o que esta rodada viu, datado em `agora`.
 * União e não troca: um teste que lê arquivos diferentes conforme o ambiente acumula todos. `anterior` torta é ignorada.
 */
export function montarEntrada({ teste, commit, caminhos, pastas, sempre, cega = false, anterior = null, agora = Date.now(), retencaoMs = RETENCAO_MS }) {
  const ant = anterior !== null && typeof anterior === 'object' ? anterior : {};
  const iso = new Date(agora).toISOString();
  const deAgora = (itens) => Object.fromEntries([...itens].map((item) => [item, iso]));
  return {
    teste,
    commit,
    caminhos: unirMapas(semOVelho(ant.caminhos, agora, retencaoMs), deAgora(caminhos)),
    pastas: unirMapas(semOVelho(ant.pastas, agora, retencaoMs), deAgora(pastas)),
    sempre: sempre ? iso : marcaRecente(ant.sempre, agora, retencaoMs),
    cega: cega ? iso : marcaRecente(ant.cega, agora, retencaoMs),
  };
}

/** Grava a entrada de forma atômica (temporário + `rename`). Devolve o caminho do arquivo. */
export function gravarEntrada(dir, entrada) {
  mkdirSync(dir, { recursive: true });
  const arquivo = arquivoDaEntrada(dir, entrada.teste);
  const temporario = `${arquivo}.${process.pid}.tmp`;
  try {
    writeFileSync(temporario, JSON.stringify(entrada));
    renameSync(temporario, arquivo);
  } catch (e) {
    rmSync(temporario, { force: true });
    throw e;
  }
  return arquivo;
}

/** A entrada de um teste, ou `null` (não existe ou está ilegível). */
export function lerEntrada(dir, teste) {
  try {
    const entrada = JSON.parse(readFileSync(arquivoDaEntrada(dir, teste), 'utf8'));
    return entrada !== null && typeof entrada === 'object' && entrada.teste === teste ? entrada : null;
  } catch {
    return null;
  }
}

/** Todas as entradas da pasta. Arquivo ilegível é pulado: a próxima rodada o reescreve. */
export function lerEntradas(dir) {
  let nomes;
  try {
    nomes = readdirSync(dir).filter((nome) => nome.endsWith('.json'));
  } catch {
    return [];
  }
  const entradas = [];
  for (const nome of nomes) {
    try {
      const entrada = JSON.parse(readFileSync(join(dir, nome), 'utf8'));
      if (entrada !== null && typeof entrada === 'object' && typeof entrada.teste === 'string') entradas.push(entrada);
    } catch {
      /* gravação pela metade */
    }
  }
  return entradas;
}

/** O nome do programa: `/usr/bin/node` e `node.exe` viram `node`. */
export const programaDe = (comando) => basename(String(comando)).replace(/\.(exe|cmd)$/i, '');

/** A string de `exec` em palavras, respeitando aspas simples e duplas. */
export function palavrasDoComando(texto) {
  const palavras = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  for (let m = re.exec(String(texto)); m !== null; m = re.exec(String(texto))) palavras.push(m[1] ?? m[2] ?? m[3]);
  return palavras;
}

/**
 * O texto de um shell em comandos: `cd x && pnpm test` → `[["cd","x"],["pnpm","test"]]`. Respeita aspas e barra
 * invertida; `;`, `&&`, `||`, `|`, `&`, parênteses, `$(`, crase e quebra de linha separam. Não é um shell: o que este
 * corte não entende continua coberto pela leitura palavra a palavra do texto inteiro.
 */
export function comandosDoShell(texto) {
  const s = String(texto);
  const comandos = [];
  let atual = [];
  let palavra = null;
  const fecharPalavra = () => {
    if (palavra !== null) atual.push(palavra);
    palavra = null;
  };
  const fecharComando = () => {
    fecharPalavra();
    if (atual.length > 0) comandos.push(atual);
    atual = [];
  };
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "'") {
      const fim = s.indexOf(c, i + 1);
      const ate = fim < 0 ? s.length : fim;
      palavra = (palavra ?? '') + s.slice(i + 1, ate);
      i = ate;
    } else if (c === '"') {
      palavra = palavra ?? '';
      for (i++; i < s.length && s[i] !== '"'; i++) {
        if (s[i] === '\\' && i + 1 < s.length && '"\\$`'.includes(s[i + 1])) i++;
        palavra += s[i];
      }
    } else if (c === '\\' && i + 1 < s.length) {
      palavra = (palavra ?? '') + s[++i];
    } else if (c === '$' && s[i + 1] === '(') {
      fecharComando();
      i++;
    } else if (';&|()`\n'.includes(c)) {
      fecharComando();
    } else if (/\s/.test(c)) {
      fecharPalavra();
    } else {
      palavra = (palavra ?? '') + c;
    }
  }
  fecharComando();
  return comandos;
}

function semPrefixo(palavras) {
  let i = 0;
  for (;;) {
    if (i < palavras.length && ATRIBUICAO.test(palavras[i])) i++;
    else if (i < palavras.length && PREFIXOS.has(palavras[i])) {
      i++;
      while (i < palavras.length && palavras[i].startsWith('-')) i++;
    } else break;
  }
  return palavras.slice(i);
}

function opcoesDoGit(textos, base) {
  let i = 0;
  while (i < textos.length && textos[i].startsWith('-')) {
    const t = textos[i];
    const igual = t.startsWith('--') ? t.indexOf('=') : -1;
    const chave = igual > 0 ? t.slice(0, igual) : t;
    const separado = igual < 0 && GIT_GLOBAL_COM_VALOR.has(chave);
    const valor = igual > 0 ? t.slice(igual + 1) : separado ? textos[i + 1] : undefined;
    if ((chave === '-C' || chave === '--work-tree') && valor !== undefined) base = absolutoDe(valor, base) ?? base;
    i += separado ? 2 : 1;
  }
  return { base, inicio: i };
}

function indiceDoTexto(textos) {
  for (let i = 0; i < textos.length && textos[i].startsWith('-') && !textos[i].startsWith('--'); i++) {
    if (/^-[a-zA-Z]*c[a-zA-Z]*$/.test(textos[i])) return i + 1;
  }
  return 0;
}

/**
 * O que um subprocesso diz do repositório: `{ leituras, pastas, sempre }`.
 *
 * - `leituras`: cada argumento que resolve (contra o `cwd`) para um caminho que EXISTE dentro da raiz
 *   (`--config=x.mjs` conta pelo que vem depois do `=`). Pasta dada a qualquer programa vale inteira (`pasta/**`).
 * - `pastas`: o que `git ls-files` / `ls-tree` / `grep` / `diff` varre, em profundidade; padrão de glob ou pathspec
 *   ausente vale o `cwd` inteiro. `grep` e `diff` também leem o que varrem.
 * - `sempre`: o programa roda código do repositório (node, shell, gerenciador de pacote) sobre um argumento ou um
 *   `cwd` dentro da raiz. O programa que é ele mesmo um arquivo do repositório (shebang) é lido e roda sempre.
 * - Shell com `-c`: o texto é cortado em comandos, cada um classificado como subprocesso próprio (sem `FOO=1`, `env`,
 *   `exec`; o `cd` muda o `cwd` dos seguintes; `source`/`.` roda o arquivo como shell).
 *
 * `existe` e `ehPasta` são injetados: o setup passa o `statSync` original; o teste, um dublê.
 */
export function classificarSubprocesso({ programa, args, cwd = null }, ambiente) {
  const { raizes, existe, ehPasta = () => false, cwdDoWorker = process.cwd() } = ambiente;
  const nome = programaDe(programa);
  let base = cwd === null ? cwdDoWorker : (absolutoDe(cwd, cwdDoWorker) ?? cwdDoWorker);
  const textos = args.map((arg) => (typeof arg === 'string' ? arg : String(arg)));
  let inicio = 0;
  if (nome === 'git') ({ base, inicio } = opcoesDoGit(textos, base));
  const sub = nome === 'git' ? textos[inicio] : undefined;
  const soLista = nome === 'git' && Object.hasOwn(GIT_QUE_VARRE, sub ?? '') && GIT_QUE_VARRE[sub].le === false;
  const leituras = new Set();
  const pastas = new Set();
  let sempre = false;

  const lerCaminho = (candidato, { fundo }) => {
    if (candidato === '' || candidato.startsWith('-')) return;
    const abs = absolutoDe(candidato, base);
    if (abs === null) return;
    const rel = relativoARaiz(abs, raizes);
    if (rel === null || !existe(abs)) return;
    if (rel !== '') leituras.add(rel);
    if (fundo && ehPasta(abs)) {
      const marca = `${rel === '' ? '.' : rel}${RECURSIVA}`;
      pastas.add(marca);
      if (!soLista) leituras.add(marca);
    }
  };
  const lerArgumento = (texto, opcoes) => {
    const igual = texto.indexOf('=');
    lerCaminho(texto, opcoes);
    if (texto.startsWith('-') && igual > 0) lerCaminho(texto.slice(igual + 1), opcoes);
  };
  const somar = (outro) => {
    for (const rel of outro.leituras) leituras.add(rel);
    for (const rel of outro.pastas) pastas.add(rel);
    if (outro.sempre) sempre = true;
  };

  if (String(programa).includes('/')) {
    const abs = absolutoDe(String(programa), base);
    const rel = abs === null ? null : relativoARaiz(abs, raizes);
    if (rel !== null && rel !== '' && existe(abs)) {
      leituras.add(rel);
      sempre = true;
    }
  }

  const iTexto = SHELLS.has(nome) ? indiceDoTexto(textos) : 0;
  if (iTexto > 0 && iTexto < textos.length) {
    const texto = textos[iTexto];
    textos.forEach((t, i) => i !== iTexto && lerArgumento(t, { fundo: true }));
    for (const palavra of palavrasDoComando(texto)) lerCaminho(palavra, { fundo: false });
    let baseDoTexto = base;
    let cwdDoTexto = cwd === null ? null : base;
    for (const comando of comandosDoShell(texto)) {
      const [prog, ...resto] = semPrefixo(comando);
      if (prog === undefined) continue;
      if (prog === 'cd') {
        const destino = resto.find((p) => !p.startsWith('-'));
        if (destino !== undefined) baseDoTexto = absolutoDe(destino, baseDoTexto) ?? baseDoTexto;
        cwdDoTexto = baseDoTexto;
        continue;
      }
      const filho = { programa: QUE_CARREGAM.has(prog) ? 'sh' : prog, args: resto, cwd: cwdDoTexto };
      somar(classificarSubprocesso(filho, { ...ambiente, cwdDoWorker: baseDoTexto }));
    }
    // O shell em si roda o repositório: o corte em comandos só soma (`if …; then node x; fi` ele não entende).
    if (leituras.size > 0 || (cwd !== null && relativoARaiz(base, raizes) !== null)) sempre = true;
    return { leituras: [...leituras].sort(), pastas: [...pastas].sort(), sempre };
  }

  for (const texto of textos.slice(inicio)) lerArgumento(texto, { fundo: true });
  if (nome === 'git') {
    const varredura = varreduraDoGit(sub, textos.slice(inicio + 1), { base, raizes, existe, ehPasta });
    for (const rel of varredura.arquivos) leituras.add(rel);
    for (const marca of varredura.marcas) {
      pastas.add(marca);
      if (GIT_QUE_VARRE[sub].le) leituras.add(marca);
    }
  }
  const cwdNaRaiz = relativoARaiz(base, raizes) !== null;
  const rodaORepo = COMANDOS_QUE_RODAM_O_REPO.includes(nome);
  const cwdConta = cwd !== null || LEEM_O_CWD.has(nome);
  if (rodaORepo && (leituras.size > 0 || (cwdConta && cwdNaRaiz))) sempre = true;
  return { leituras: [...leituras].sort(), pastas: [...pastas].sort(), sempre };
}

function varreduraDoGit(sub, resto, { base, raizes, existe, ehPasta }) {
  const regra = Object.hasOwn(GIT_QUE_VARRE, sub ?? '') ? GIT_QUE_VARRE[sub] : undefined;
  const marcas = new Set();
  const arquivos = new Set();
  if (regra === undefined) return { marcas, arquivos };
  const separador = resto.indexOf('--');
  let pathspec = [];
  if (separador >= 0) {
    pathspec = resto.slice(separador + 1);
  } else {
    let padraoPorOpcao = false;
    for (let j = 0; j < resto.length; j++) {
      const t = resto[j];
      if (sub === 'grep' && GREP_COM_VALOR.has(t)) {
        padraoPorOpcao = true;
        j++;
      } else if (t.startsWith('-')) {
        if (sub === 'grep' && /^-[ef]/.test(t)) padraoPorOpcao = true;
      } else pathspec.push(t);
    }
    if (regra.pula === 'sempre' || (regra.pula === 'padrao' && !padraoPorOpcao)) pathspec = pathspec.slice(1);
  }
  const marcar = (abs) => {
    const rel = abs === null ? null : relativoARaiz(abs, raizes);
    if (rel !== null) marcas.add(`${rel === '' ? '.' : rel}${RECURSIVA}`);
  };
  const topo = raizes.find((r) => r && (base === r || base.startsWith(r + sep))) ?? null;
  if (pathspec.length === 0) marcar(base);
  for (const spec of pathspec) {
    let alvo = spec;
    let contra = base;
    if (spec.startsWith(':')) {
      const magica = /^:(?:\(([^)]*)\)|([/!^]*))/.exec(spec);
      const longas = magica[1] !== undefined ? magica[1].split(',').map((p) => p.trim()) : [];
      const curtas = magica[2] ?? '';
      if (longas.includes('top') || curtas.includes('/')) contra = topo;
      if (contra === null) continue;
      if (longas.includes('exclude') || curtas.includes('!') || curtas.includes('^') || longas.some((p) => p.startsWith('glob') || p === 'icase')) {
        marcar(contra);
        continue;
      }
      alvo = spec.slice(magica[0].length);
      if (alvo === '') {
        marcar(contra);
        continue;
      }
    }
    const abs = absolutoDe(alvo, contra);
    if (abs !== null && existe(abs)) {
      if (ehPasta(abs)) marcar(abs);
      else if (alvo !== spec) {
        const rel = relativoARaiz(abs, raizes);
        if (rel !== null && rel !== '') arquivos.add(rel);
      }
      continue;
    }
    marcar(contra); // padrão de glob, ou caminho que não existe: pode casar qualquer coisa abaixo
  }
  return { marcas: [...marcas].sort(), arquivos: [...arquivos].sort() };
}
