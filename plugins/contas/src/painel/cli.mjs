#!/usr/bin/env node
// `painel-de-contas [--porta N] [--sem-abrir]`: sobe o painel em 127.0.0.1 e abre o navegador.
// Porta ocupada pelo painel desta versão: só abre o navegador nele. Pelo painel de outra versão do plugin: troca-o
// pelo desta (ICH-F23). Porta ocupada por outro programa: recusa.
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as esperar } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { criarServidor } from './servidor.mjs';

export const PORTA_PADRAO = 4791;
const PUBLICO = fileURLToPath(new URL('./publico', import.meta.url));
const USO = 'uso: painel-de-contas [--porta N] [--sem-abrir]';
/** A pasta deste plugin (no cache, uma por versão): é o que distingue o servidor desta versão do de outra. */
export const PASTA_DO_PLUGIN = resolve(fileURLToPath(new URL('../..', import.meta.url)));
// `node <pasta do plugin>/src/painel/cli.mjs …`: a linha de comando com que o painel sobe.
const COMANDO_DO_PAINEL = /^\S*\bnode\s+(\/\S*\/contas(?:\/[^/\s]+)?)\/src\/painel\/cli\.mjs(?:\s|$)/;
const PRAZO_PARA_SAIR_MS = 5000;
const INTERVALO_MS = 100;

const versao = () => { try { return JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).version; } catch { return '0.0.0'; } };

export function lerArgumentos(argv, env = process.env) {
  const doEnv = Number.parseInt(env.PAINEL_DE_CONTAS_PORTA ?? '', 10);
  let porta = Number.isInteger(doEnv) && doEnv >= 0 && doEnv <= 65535 ? doEnv : PORTA_PADRAO;
  let abrir = true;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--sem-abrir') abrir = false;
    else if (argv[i] === '--porta') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < 0 || n > 65535) return { erro: '--porta pede um número de 0 a 65535' };
      porta = n;
    } else if (argv[i] === '--ajuda' || argv[i] === '-h' || argv[i] === '--help') return { ajuda: true };
    else return { erro: `argumento desconhecido: ${argv[i]}` };
  }
  return { porta, abrir };
}

export function abrirNavegador(url) {
  const filho = spawn('open', [url], { stdio: 'ignore', detached: true });
  filho.on('error', () => { /* sem navegador: o endereço já foi impresso */ });
  filho.unref();
}

/** O painel na porta: `null` se não é ele; `{ pasta }` (`pasta: null` na versão anterior ao ICH-F23, que não a dizia). */
export async function saudeDoPainel(porta) {
  try {
    const r = await fetch(`http://127.0.0.1:${porta}/api/saude`, { signal: AbortSignal.timeout(2000) });
    const j = r.ok ? await r.json() : null;
    return j?.painel === 'contas' ? { pasta: typeof j.pasta === 'string' ? j.pasta : null } : null;
  } catch { return null; }
}

/** A pasta do plugin de quem rodou `node <pasta>/src/painel/cli.mjs`; `null` se a linha não é a do painel. */
export function pastaDoServidorDoPainel(comando) {
  return COMANDO_DO_PAINEL.exec(comando ?? '')?.[1] ?? null;
}

/** Processos escutando na porta, com a linha de comando de cada um (`lsof` + `ps`); vazio se não der para saber. */
export function processosNaPorta(porta) {
  const ler = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  try {
    const pids = ler('lsof', ['-nP', `-iTCP:${porta}`, '-sTCP:LISTEN', '-t']).split('\n').map(Number).filter((n) => Number.isInteger(n) && n > 0);
    return pids.map((pid) => { try { return { pid, comando: ler('ps', ['-o', 'command=', '-p', String(pid)]).trim() }; } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

const real = (p) => { try { return realpathSync(p); } catch { return resolve(p); } };

export const encerrarProcesso = (pid) => process.kill(pid, 'SIGTERM');

/**
 * Se a porta tem o painel de outra pasta do plugin (outra versão), encerra-o, espera a porta soltar e devolve `true`.
 * Só encerra o que a linha de comando prova ser o painel; outro programa na porta fica como está (com aviso).
 */
export async function trocarPainelDeOutraVersao(porta, {
  pasta = PASTA_DO_PLUGIN, saude = saudeDoPainel, processos = processosNaPorta, encerrar = encerrarProcesso,
  prazoMs = PRAZO_PARA_SAIR_MS, aviso = (t) => console.error(t),
} = {}) {
  const dono = processos(porta).find((p) => pastaDoServidorDoPainel(p.comando));
  if (!dono) { aviso(`painel: a porta ${porta} responde como o painel, mas não consegui provar qual processo é; deixei como está`); return false; }
  if (real(pastaDoServidorDoPainel(dono.comando)) === real(pasta)) return false;
  encerrar(dono.pid);
  const ate = Date.now() + prazoMs;
  while (await saude(porta)) {
    if (Date.now() >= ate) { aviso(`painel: o servidor antigo (pid ${dono.pid}) não saiu da porta ${porta}`); return false; }
    await esperar(INTERVALO_MS);
  }
  return true;
}

/** Devolve `{ codigo, servidor }`; o servidor fica ouvindo até o processo sair. */
export async function principal({ argv = [], env = process.env, saida = (t) => console.log(t), erro = (t) => console.error(t), abrir = abrirNavegador, troca = {} } = {}) {
  const a = lerArgumentos(argv, env);
  if (a.ajuda) { saida(USO); return { codigo: 0, servidor: null }; }
  if (a.erro) { erro(`${a.erro}\n${USO}`); return { codigo: 2, servidor: null }; }
  const servidor = criarServidor({ publico: PUBLICO, versao: versao(), pasta: PASTA_DO_PLUGIN, contas: { env } });
  const ouvir = () => new Promise((resolve) => {
    servidor.once('error', resolve);
    servidor.listen(a.porta, '127.0.0.1', () => { servidor.off('error', resolve); resolve(null); });
  });
  let ouviu = await ouvir();
  if (ouviu?.code === 'EADDRINUSE') {
    const noAr = await saudeDoPainel(a.porta);
    if (noAr && noAr.pasta !== PASTA_DO_PLUGIN && await trocarPainelDeOutraVersao(a.porta, { aviso: erro, ...troca })) ouviu = await ouvir();
  }
  if (ouviu === null) {
    const url = `http://127.0.0.1:${servidor.address().port}`;
    saida(`Painel de contas em ${url} (Ctrl-C para sair)`);
    if (a.abrir) abrir(url);
    return { codigo: 0, servidor };
  }
  if (ouviu.code === 'EADDRINUSE' && await saudeDoPainel(a.porta)) {
    const url = `http://127.0.0.1:${a.porta}`;
    saida(`O painel já está aberto em ${url}`);
    if (a.abrir) abrir(url);
    return { codigo: 0, servidor: null };
  }
  erro(ouviu.code === 'EADDRINUSE' ? `porta ${a.porta} ocupada por outro programa; use --porta` : `não consegui abrir a porta ${a.porta}: ${ouviu.message}`);
  return { codigo: 1, servidor: null };
}

const comoPrograma = (() => { try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (comoPrograma) {
  const r = await principal({ argv: process.argv.slice(2) });
  process.exitCode = r.codigo;
}
