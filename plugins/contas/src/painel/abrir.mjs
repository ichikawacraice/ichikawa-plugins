#!/usr/bin/env node
// `abrir-painel-de-contas [--porta N] [--sem-abrir]`: abre o painel no navegador do sistema e sai. Se o painel
// não está no ar, sobe-o desacoplado (sobrevive a quem chamou, inclusive ao app do Claude fechar na troca) e
// espera ele responder. Com `--sem-abrir`, só garante o painel no ar: é o `comando` do botão "Contas" da barra
// (barra.json), que declara `url` e abre a página no navegador do app depois que o comando termina.
import { spawn } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { setTimeout as esperar } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { PORTA_PADRAO, abrirNavegador, ehOPainel } from './cli.mjs';

const CLI = fileURLToPath(new URL('./cli.mjs', import.meta.url));
const PRAZO_MS = 8000;
const INTERVALO_MS = 200;
const USO = 'uso: abrir-painel-de-contas [--porta N] [--sem-abrir]';

export function lerPorta(argv, env = process.env) {
  const doEnv = Number.parseInt(env.PAINEL_DE_CONTAS_PORTA ?? '', 10);
  let porta = Number.isInteger(doEnv) && doEnv > 0 && doEnv <= 65535 ? doEnv : PORTA_PADRAO;
  let semAbrir = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--porta') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n <= 0 || n > 65535) return { erro: '--porta pede um número de 1 a 65535' };
      porta = n;
    } else if (argv[i] === '--sem-abrir') semAbrir = true;
    else if (['--ajuda', '-h', '--help'].includes(argv[i])) return { ajuda: true };
    else return { erro: `argumento desconhecido: ${argv[i]}` };
  }
  return { porta, semAbrir };
}

/** Sobe o painel num processo à parte, sem abrir navegador, desligado deste processo. */
function subirDesacoplado(porta) {
  const filho = spawn(process.execPath, [CLI, '--porta', String(porta), '--sem-abrir'], { stdio: 'ignore', detached: true });
  filho.on('error', () => { /* a espera abaixo dá o erro */ });
  filho.unref();
}

/** Devolve o código de saída. Dependências trocáveis no teste. */
export async function abrirPainel({
  argv = [], env = process.env, saida = (t) => console.log(t), erro = (t) => console.error(t),
  noAr = ehOPainel, subir = subirDesacoplado, abrir = abrirNavegador, prazoMs = PRAZO_MS,
} = {}) {
  const a = lerPorta(argv, env);
  if (a.ajuda) { saida(USO); return 0; }
  if (a.erro) { erro(`${a.erro}\n${USO}`); return 2; }
  const url = `http://127.0.0.1:${a.porta}`;
  if (!(await noAr(a.porta))) {
    subir(a.porta);
    const limite = Date.now() + prazoMs;
    while (!(await noAr(a.porta))) {
      if (Date.now() >= limite) {
        erro(`o painel não respondeu em ${url}; rode \`painel-de-contas --porta ${a.porta}\` num terminal para ver o erro`);
        return 1;
      }
      await esperar(INTERVALO_MS);
    }
  }
  if (!a.semAbrir) abrir(url);
  saida(`Painel de contas em ${url}`);
  return 0;
}

const comoPrograma = (() => { try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (comoPrograma) process.exitCode = await abrirPainel({ argv: process.argv.slice(2) });
