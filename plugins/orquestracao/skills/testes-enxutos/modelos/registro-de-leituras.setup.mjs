// O setup do registro de leituras: o que este arquivo de teste carregou, leu, listou e lançou.
// Degrau 2 da skill `orquestracao:testes-enxutos` (kit ichikawa-plugins); extraído do Izanagi em 18/11/2026.
// Quem o liga é `registroDeLeituras()` (registro-de-leituras.mjs), no config do vitest. Não importe direto.
//
// Como: envolve `fs`, `fs/promises` e `child_process` uma vez por processo (guardado por `Symbol.for`: com
// `isolate: false` o setup roda de novo a cada arquivo, e envelope sobre envelope contaria dobrado) e chama
// `syncBuiltinESMExports()` — sem isso o `import { readFileSync } from 'node:fs'` não vê o envelope. Os módulos vêm
// do estado do worker do vitest (`modulosDoWorker`); versão que não os mostra grava a entrada como `cega`.
//
// Zera AQUI, quando o setup roda — antes de o arquivo de teste ser importado —, nunca no `beforeAll`: o que o teste
// lê no topo do módulo e na coleta (`it.each(listaLidaDoDisco)`) acontece antes de qualquer `beforeAll`. Grava no
// `afterAll`.
//
// Nunca reprova o teste: toda falha do registro vira aviso no stderr, e o envelope repassa a chamada intacta.
// Arquivo de teste fora da raiz (vitest aninhado sobre fixture temporária) não grava nada.
import childProcess from 'node:child_process';
import fs, { realpathSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { afterAll } from 'vitest';
import {
  RECURSIVA, VARIAVEIS, absolutoDe, classificarSubprocesso, gravarEntrada, lerEntrada, modulosDoWorker, montarEntrada,
  relativoARaiz,
} from './registro-de-leituras.mjs';

/** Direto no stderr: o console do teste o vitest captura e às vezes descarta. */
const aviso = (texto) => process.stderr.write(`${texto}\n`);

// O `Date` de verdade, guardado antes de qualquer teste: um `vi.setSystemTime` sem restaurar até o `afterAll`
// gravaria a entrada com data falsa, e a marca já nasceria vencida.
const DataReal = Date;

const CHAVE = Symbol.for('kit.registro-de-leituras.estado');
const ESTE_SETUP = fileURLToPath(import.meta.url);
// Por `fileURLToPath` do `import.meta.url` com texto, nunca `new URL(...)`: no jsdom o `URL` global é outro.
const O_FORMATO = ESTE_SETUP.replace(/registro-de-leituras\.setup\.mjs$/, 'registro-de-leituras.mjs');

const raizDada = process.env[VARIAVEIS.raiz];
const dir = process.env[VARIAVEIS.dir];

if (raizDada && dir) {
  try {
    preparar(raizDada, dir);
  } catch (e) {
    aviso(`[registro] não preparei o registro (${e?.message ?? e}) — o teste não muda`);
  }
}

function preparar(raizDada, dir) {
  let estado = globalThis[CHAVE];
  if (estado === undefined) {
    const raizes = [raizDada];
    try {
      const real = realpathSync(raizDada);
      if (real !== raizDada) raizes.push(real);
    } catch {
      /* fica só a crua */
    }
    estado = globalThis[CHAVE] = { raizes, leituras: new Set(), pastas: new Set(), sempre: false };
    instalar(estado);
  }
  estado.leituras.clear();
  estado.pastas.clear();
  estado.sempre = false;

  // Sem parâmetro: no vitest 4 e 5 um `afterAll((suite) => …)` é lido como fixture e derruba o arquivo de teste.
  // O arquivo vem do estado do worker (`filepath`, em todas as versões medidas: 2 a 5).
  afterAll(() => {
    const filepath = globalThis.__vitest_worker__?.filepath;
    try {
      gravar(estado, filepath, dir);
    } catch (e) {
      aviso(`[registro] não gravei a entrada de ${filepath} (${e?.message ?? e}) — o teste não muda`);
    }
  });
}

let avisouCega = false;

function gravar(estado, filepath, dir) {
  if (typeof filepath !== 'string') return;
  const teste = relativoARaiz(filepath, estado.raizes);
  if (teste === null || teste === '') return;
  const caminhos = new Set(estado.leituras);
  const modulos = modulosDoWorker(globalThis.__vitest_worker__);
  if (modulos === null && !avisouCega) {
    avisouCega = true;
    aviso('[registro] esta versão do vitest não mostra os módulos carregados — as entradas saem "cegas" e o seletor roda esses testes sempre; ajuste `modulosDoWorker`');
  }
  for (const absoluto of modulos ?? []) {
    if (absoluto === ESTE_SETUP || absoluto === O_FORMATO) continue;
    const rel = relativoARaiz(absoluto, estado.raizes);
    if (rel !== null && rel !== '') caminhos.add(rel);
  }
  caminhos.delete(teste); // o próprio teste já entra por estar no diff
  gravarEntrada(dir, montarEntrada({
    teste,
    commit: process.env[VARIAVEIS.commit] ?? '',
    caminhos,
    pastas: estado.pastas,
    sempre: estado.sempre,
    cega: modulos === null,
    anterior: lerEntrada(dir, teste),
    agora: DataReal.now(),
  }));
}

/** Troca `alvo[nome]` por uma função que registra e repassa, preservando propriedades e o `promisify.custom`. */
function envolver(alvo, nome, registrar) {
  const original = alvo[nome];
  if (typeof original !== 'function') return;
  const envelope = function (...args) {
    try {
      registrar(args);
    } catch {
      /* o registro nunca derruba a chamada */
    }
    return Reflect.apply(original, this, args);
  };
  for (const chave of Reflect.ownKeys(original)) {
    if (chave === 'length' || chave === 'name' || chave === 'prototype' || chave === promisify.custom) continue;
    const descritor = Object.getOwnPropertyDescriptor(original, chave);
    if (descritor !== undefined) Object.defineProperty(envelope, chave, descritor);
  }
  Object.defineProperty(envelope, 'name', { value: original.name, configurable: true });
  const custom = original[promisify.custom];
  if (typeof custom === 'function') {
    Object.defineProperty(envelope, promisify.custom, {
      configurable: true,
      writable: true,
      value: function (...args) {
        try {
          registrar(args);
        } catch {
          /* idem */
        }
        return Reflect.apply(custom, this, args);
      },
    });
  }
  alvo[nome] = envelope;
}

function instalar(estado) {
  // O `statSync` ORIGINAL, capturado antes do envelope: o registro não se lê a si mesmo.
  const statOriginal = fs.statSync;
  const dentro = (absoluto) => relativoARaiz(absoluto, estado.raizes);
  const lerCaminho = (arg) => {
    const abs = absolutoDe(arg);
    if (abs === null) return;
    const rel = dentro(abs);
    if (rel !== null && rel !== '') estado.leituras.add(rel);
  };
  const listarPasta = (arg, funda = false) => {
    const abs = absolutoDe(arg);
    if (abs === null) return;
    const rel = dentro(abs);
    if (rel !== null) estado.pastas.add(`${rel === '' ? '.' : rel}${funda ? RECURSIVA : ''}`);
  };
  const ehOpcoes = (a) => a !== null && typeof a === 'object' && !Array.isArray(a) && typeof a.href !== 'string' && !(a instanceof Uint8Array);
  const doPrimeiro = (fn) => (args) => fn(args[0]);
  const daListagem = (args) => listarPasta(args[0], args.find(ehOpcoes)?.recursive === true);
  const doCwdDasOpcoes = (args) => listarPasta(args.find(ehOpcoes)?.cwd ?? process.cwd(), true);
  const existe = (absoluto) => {
    try {
      return statOriginal(absoluto, { throwIfNoEntry: false }) !== undefined;
    } catch {
      return false;
    }
  };
  const ehPasta = (absoluto) => {
    try {
      return statOriginal(absoluto, { throwIfNoEntry: false })?.isDirectory() === true;
    } catch {
      return false;
    }
  };
  /** A ORIGEM de uma cópia é lida: arquivo vale ele mesmo; pasta vale `pasta/**` (conteúdo e listagem). */
  const daOrigemDaCopia = (args) => {
    const abs = absolutoDe(args[0]);
    if (abs === null) return;
    const rel = dentro(abs);
    if (rel === null) return;
    if (!ehPasta(abs)) {
      if (rel !== '') estado.leituras.add(rel);
      return;
    }
    const marca = `${rel === '' ? '.' : rel}${RECURSIVA}`;
    estado.leituras.add(marca);
    estado.pastas.add(marca);
  };

  // `access`/`open`/`stat` contam como leitura: quem pergunta se existe depende do arquivo.
  // `realpath` fica de fora: o resolvedor do Vite o chama em todo import, e o módulo já entra pelo worker.
  const leitoras = [
    'readFileSync', 'readFile', 'createReadStream', 'existsSync', 'statSync', 'lstatSync', 'stat', 'lstat', 'exists',
    'accessSync', 'access', 'openSync', 'open',
  ];
  for (const nome of leitoras) envolver(fs, nome, doPrimeiro(lerCaminho));
  for (const nome of ['readdirSync', 'readdir', 'opendir', 'opendirSync']) envolver(fs, nome, daListagem);
  for (const nome of ['glob', 'globSync']) envolver(fs, nome, doCwdDasOpcoes);
  for (const nome of ['copyFileSync', 'copyFile', 'cpSync', 'cp']) envolver(fs, nome, daOrigemDaCopia);
  for (const nome of ['readFile', 'stat', 'lstat', 'access', 'open']) envolver(fs.promises, nome, doPrimeiro(lerCaminho));
  for (const nome of ['readdir', 'opendir']) envolver(fs.promises, nome, daListagem);
  for (const nome of ['copyFile', 'cp']) envolver(fs.promises, nome, daOrigemDaCopia);
  envolver(fs.promises, 'glob', doCwdDasOpcoes);

  const registrarFilho = (programa, args, opcoes) => {
    const cwd = opcoes?.cwd === undefined || opcoes?.cwd === null ? null : opcoes.cwd;
    const r = classificarSubprocesso({ programa, args, cwd }, { raizes: estado.raizes, existe, ehPasta });
    for (const rel of r.leituras) estado.leituras.add(rel);
    for (const rel of r.pastas) estado.pastas.add(rel);
    if (r.sempre) estado.sempre = true;
  };
  /** `spawn(cmd, args?, opcoes?)`; com `shell`, a linha vai a um shell. */
  const comArgumentos = (args) => {
    const [programa, segundo, terceiro] = args;
    const lista = Array.isArray(segundo) ? segundo : [];
    const opcoes = Array.isArray(segundo) ? terceiro : segundo;
    if (opcoes?.shell) return registrarFilho('sh', ['-c', [programa, ...lista].map(String).join(' ')], opcoes);
    return registrarFilho(programa, lista, opcoes);
  };
  /** `exec(cmd, opcoes?)`: a string inteira vai a um shell. */
  const comoTexto = (args) => {
    const opcoes = args[1] !== null && typeof args[1] === 'object' ? args[1] : undefined;
    registrarFilho('sh', ['-c', String(args[0])], opcoes);
  };
  /** `fork(modulo, args?, opcoes?)`: `node` sobre o módulo. */
  const comoFork = (args) => {
    const [modulo, segundo, terceiro] = args;
    if (Array.isArray(segundo)) return registrarFilho('node', [modulo, ...segundo], terceiro);
    return registrarFilho('node', [modulo], segundo);
  };
  for (const nome of ['spawn', 'spawnSync', 'execFile', 'execFileSync']) envolver(childProcess, nome, comArgumentos);
  for (const nome of ['exec', 'execSync']) envolver(childProcess, nome, comoTexto);
  envolver(childProcess, 'fork', comoFork);

  syncBuiltinESMExports();
}
