// O tema do painel: a escolha do botão de tema, no `tema.json` do kit (ICHIKAWA_HOME, padrão ~/.claude/ichikawa) — o
// mesmo arquivo que a barra e o Painel leem e gravam (docs/contratos.md). Claro é o céu de dia; escuro, a noite.
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const TEMAS = ['claro', 'escuro'];
/** Sem escolha gravada (ou arquivo ilegível), o escuro. */
export const TEMA_PADRAO = 'escuro';

const pastaDoKit = (env) => env.ICHIKAWA_HOME || join(env.HOME || homedir(), '.claude', 'ichikawa');

export async function lerTema(env) {
  try {
    return JSON.parse(await readFile(join(pastaDoKit(env), 'tema.json'), 'utf8'))?.tema === 'claro' ? 'claro' : TEMA_PADRAO;
  } catch { return TEMA_PADRAO; }
}

/** O céu (`data-ceu`) de cada escolha. */
export const ceuDoTema = (tema) => (tema === 'claro' ? 'dia' : 'noite');

/** Grava a escolha sem deixar arquivo pela metade (escreve ao lado e renomeia). Outro valor lança e nada se grava. */
export async function gravarTema(env, tema, agora = new Date()) {
  if (!TEMAS.includes(tema)) throw new Error(`tema desconhecido: ${tema}`);
  const pasta = pastaDoKit(env);
  await mkdir(pasta, { recursive: true });
  const destino = join(pasta, 'tema.json');
  const temp = `${destino}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify({ tema, em: agora.toISOString(), por: 'cotas' }, null, 2)}\n`);
  await rename(temp, destino);
  return tema;
}
