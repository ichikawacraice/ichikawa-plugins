// Ambiente falso para os testes da troca de conta: tudo em pasta temporária, o app é um objeto falso.
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const CONTA_A = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
export const CONTA_B = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
export const ORG = 'org-0001';
export const SENTINELAS = ['SENTINELA-V2-A', 'SENTINELA-V1-A', 'SENTINELA-V2-B', 'SENTINELA-V1-B', 'SENTINELA-COOKIE-A', 'SENTINELA-COOKIE-B'];

/** O config.json do app como ele grava: tabulação, sem `\n` final. */
export const textoDeConfig = (obj) => JSON.stringify(obj, null, '\t');

export function configDe(conta) {
  const x = conta === CONTA_A ? 'A' : 'B';
  return {
    theme: 'dark',
    'oauth:tokenCacheV2': `SENTINELA-V2-${x}`,
    locale: 'pt-BR',
    'oauth:tokenCache': `SENTINELA-V1-${x}`,
    lastKnownAccountUuid: conta,
    zoom: 1,
  };
}

/** Controle do app falso: registra as chamadas e deixa injetar falhas. */
export function controleFalso({ rodando = true, falhaAoFechar = null, falhaAoAbrir = null, aoFechar = () => {} } = {}) {
  const c = {
    chamadas: [],
    rodandoAgora: rodando,
    rodando: async () => c.rodandoAgora,
    async fechar() { c.chamadas.push('fechar'); if (falhaAoFechar) throw falhaAoFechar; c.rodandoAgora = false; aoFechar(); },
    async abrir() { c.chamadas.push('abrir'); if (falhaAoAbrir) throw falhaAoAbrir; c.rodandoAgora = true; },
  };
  return c;
}

/** Monta app, dados e projetos temporários com a conta A logada e a B salva ou não. */
export function montar({ cookiesEmNetwork = false } = {}) {
  const raiz = mkdtempSync(join(tmpdir(), 'claude-account-switcher-'));
  const appDir = join(raiz, 'app');
  const dados = join(raiz, 'dados');
  const claude = join(raiz, 'claude');
  const home = join(raiz, 'home');
  for (const d of [appDir, dados, claude, home, join(claude, 'projects')]) mkdirSync(d, { recursive: true });
  const cookieDir = cookiesEmNetwork ? join(appDir, 'Network') : appDir;
  if (cookiesEmNetwork) mkdirSync(cookieDir);
  writeFileSync(join(appDir, 'config.json'), textoDeConfig(configDe(CONTA_A)));
  writeFileSync(join(cookieDir, 'Cookies'), 'SENTINELA-COOKIE-A');
  writeFileSync(join(cookieDir, 'Cookies-journal'), 'diario-A');
  const env = { HOME: home, CLAUDE_APP_DIR: appDir, TROCA_DE_CONTA_DIR: dados, CLAUDE_CONFIG_DIR: claude };
  return {
    raiz, appDir, dados, claude, home, cookieDir, env,
    projetos: join(claude, 'projects'),
    sessoes: join(appDir, 'claude-code-sessions'),
    lerConfig: () => readFileSync(join(appDir, 'config.json'), 'utf8'),
  };
}

/** Escreve uma entrada da lista: claude-code-sessions/<conta>/<org>/local_<id>.json. */
export function entrada(sessoes, conta, org, id, campos = {}) {
  const dir = join(sessoes, conta, org);
  mkdirSync(dir, { recursive: true });
  const obj = { sessionId: `local_${id}`, cliSessionId: `cli-${id}`, lastActivityAt: 1000, title: `conversa ${id}`, ...campos };
  const caminho = join(dir, `local_${id}.json`);
  writeFileSync(caminho, JSON.stringify(obj, null, 2));
  return caminho;
}

export const lerJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
