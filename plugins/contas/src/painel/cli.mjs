#!/usr/bin/env node
// `painel-de-contas [--porta N] [--sem-abrir]`: sobe o painel em 127.0.0.1 e abre o navegador.
// Porta ocupada pelo próprio painel: só abre o navegador nele. Porta ocupada por outro programa: recusa.
import { spawn } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { criarServidor } from './servidor.mjs';

export const PORTA_PADRAO = 4791;
const PUBLICO = fileURLToPath(new URL('./publico', import.meta.url));
const USO = 'uso: painel-de-contas [--porta N] [--sem-abrir]';

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

export async function ehOPainel(porta) {
  try {
    const r = await fetch(`http://127.0.0.1:${porta}/api/saude`, { signal: AbortSignal.timeout(2000) });
    return r.ok && (await r.json())?.painel === 'contas';
  } catch { return false; }
}

/** Devolve `{ codigo, servidor }`; o servidor fica ouvindo até o processo sair. */
export async function principal({ argv = [], env = process.env, saida = (t) => console.log(t), erro = (t) => console.error(t), abrir = abrirNavegador } = {}) {
  const a = lerArgumentos(argv, env);
  if (a.ajuda) { saida(USO); return { codigo: 0, servidor: null }; }
  if (a.erro) { erro(`${a.erro}\n${USO}`); return { codigo: 2, servidor: null }; }
  const servidor = criarServidor({ publico: PUBLICO, versao: versao(), contas: { env } });
  const ouviu = await new Promise((resolve) => {
    servidor.once('error', resolve);
    servidor.listen(a.porta, '127.0.0.1', () => resolve(null));
  });
  if (ouviu === null) {
    const url = `http://127.0.0.1:${servidor.address().port}`;
    saida(`Painel de contas em ${url} (Ctrl-C para sair)`);
    if (a.abrir) abrir(url);
    return { codigo: 0, servidor };
  }
  if (ouviu.code === 'EADDRINUSE' && await ehOPainel(a.porta)) {
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
