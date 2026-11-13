// O login de cada conta (3 chaves do config.json + cookies, ainda cifrados pelo app), o backup e a volta do backup.
// Port de profiles.go (ver NOTICE). Nada aqui decifra token.
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { CHAVES_LOGIN, copiarArquivo, criarPasta, gravarObjeto, lerObjetoConferido } from './app-do-claude.mjs';

export const BACKUPS_GUARDADOS = 10;

/** Copia o login ativo para `dir`. O app tem de estar fechado. */
export function salvarPerfil(app, dir) {
  const cfg = app.lerConfig();
  const salvo = {};
  for (const k of CHAVES_LOGIN) if (k in cfg) salvo[k] = cfg[k];
  criarPasta(dir);
  gravarObjeto(join(dir, 'config.json'), salvo);
  for (const f of app.arquivosDeCookie()) copiarArquivo(f, join(dir, basename(f)));
}

/** Põe de volta um login salvo. O app tem de estar fechado. O config.json é gravado por último. */
export function restaurarPerfil(app, dir) {
  const salvo = lerObjetoConferido(join(dir, 'config.json'));
  const cfg = app.lerConfig();
  for (const k of CHAVES_LOGIN) {
    if (k in salvo) cfg[k] = salvo[k];
    else delete cfg[k];
  }
  for (const f of app.arquivosDeCookie()) copiarArquivo(join(dir, basename(f)), f);
  app.gravarConfig(cfg);
}

/** Tira o login daqui para o app mostrar a tela de entrada. Não faz Sign out (revogaria o token salvo). */
export function limparLogin(app) {
  const cfg = app.lerConfig();
  for (const k of CHAVES_LOGIN) delete cfg[k];
  for (const f of app.arquivosDeCookie()) rmSync(f, { force: true });
  app.gravarConfig(cfg);
}

const dois = (n) => String(n).padStart(2, '0');
const carimbo = (d) => `${d.getFullYear()}${dois(d.getMonth() + 1)}${dois(d.getDate())}-${dois(d.getHours())}${dois(d.getMinutes())}${dois(d.getSeconds())}-${String(d.getMilliseconds()).padStart(3, '0')}`;

/** Copia config.json e cookies antes de a troca mexer neles; devolve a pasta do backup. */
export function backup(app, raiz, agora = new Date()) {
  const dir = join(raiz, carimbo(agora));
  criarPasta(dir);
  for (const f of [app.configPath(), ...app.arquivosDeCookie()]) copiarArquivo(f, join(dir, basename(f)));
  podarBackups(raiz);
  return dir;
}

/** Desfaz uma troca que falhou no meio. */
export function restaurarBackup(app, dir) {
  for (const f of [app.configPath(), ...app.arquivosDeCookie()]) copiarArquivo(join(dir, basename(f)), f);
}

export function podarBackups(raiz, guardar = BACKUPS_GUARDADOS) {
  if (!existsSync(raiz)) return;
  const nomes = readdirSync(raiz).filter((n) => statSync(join(raiz, n)).isDirectory()).sort();
  while (nomes.length > guardar) rmSync(join(raiz, nomes.shift()), { recursive: true, force: true });
}
