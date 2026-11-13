// A pasta de dados do app desktop do Claude no Mac: caminhos, config.json com conferência de formato e o controle do app.
// Port da lógica de desktop.go e platform_darwin.go do Claude Account Switcher (ver NOTICE).
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';

/** As chaves do config.json que pertencem à conta logada; o resto é estado do app, comum a todas. */
export const CHAVES_LOGIN = ['oauth:tokenCache', 'oauth:tokenCacheV2', 'lastKnownAccountUuid'];

export const pastaDoApp = (env = process.env) => env.CLAUDE_APP_DIR || join(homedir(), 'Library', 'Application Support', 'Claude');
export const pastaDeDados = (env = process.env) => env.TROCA_DE_CONTA_DIR || join(homedir(), '.claude-account-switcher');
export const pastaDeProjetos = (env = process.env) => join(env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'projects');

const ID_VALIDO = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
/** O uuid da conta vira nome de pasta: só caracteres seguros. */
export const idSeguro = (id) => typeof id === 'string' && ID_VALIDO.test(id);

export function criarPasta(dir) {
  mkdirSync(dir, { recursive: true, mode: 0o700 });
}

/** Grava por arquivo temporário + rename; o arquivo fica 0600. */
export function escreverAtomico(caminho, dados) {
  criarPasta(dirname(caminho));
  const tmp = `${caminho}.troca-tmp`;
  writeFileSync(tmp, dados, { mode: 0o600 });
  chmodSync(tmp, 0o600);
  renameSync(tmp, caminho);
}

/**
 * Clona o arquivo no APFS (`cp -c`, clonefile): o conteúdo igual em várias contas divide os mesmos blocos e não ocupa
 * disco de novo, e cada cópia segue independente — escrever numa não mexe nas outras. Devolve false quando não deu
 * (outro sistema de arquivos, outro sistema operacional, `TROCA_SEM_CLONE=1`), e aí a cópia comum resolve.
 * O Node não serve: `COPYFILE_FICLONE` é ioctl do Linux e sai ENOSYS no macOS. O caminho do `cp` é absoluto: com o
 * PATH mexido o clone cairia na cópia comum em silêncio, gastando disco sem ninguém saber.
 */
export function clonarArquivo(src, dst, env = process.env) {
  if (process.platform !== 'darwin' || env.TROCA_SEM_CLONE === '1') return false;
  return spawnSync('/bin/cp', ['-c', src, dst], { stdio: 'ignore' }).status === 0;
}

/** Copia src para dst (atômico, 0600, mesma data; clonado no APFS). Origem ausente apaga o destino: o instantâneo restaura exatamente os arquivos que tinha. */
export function copiarArquivo(src, dst) {
  if (!existsSync(src)) { rmSync(dst, { force: true }); return; }
  criarPasta(dirname(dst));
  const tmp = `${dst}.troca-tmp`;
  rmSync(tmp, { force: true });
  if (!clonarArquivo(src, tmp)) copyFileSync(src, tmp);
  chmodSync(tmp, 0o600);
  const info = statSync(src);
  utimesSync(tmp, info.atime, info.mtime);
  renameSync(tmp, dst);
}

/** Texto de um objeto JSON no formato do app: tabulação, sem `\n` final. */
export const serializarObjeto = (obj) => JSON.stringify(obj, null, '\t');

/** Lê um JSON de objeto e confere o formato: relido e re-serializado tem de ser idêntico ao original, senão recusa. */
export function lerObjetoConferido(caminho) {
  const texto = readFileSync(caminho, 'utf8');
  let obj;
  try { obj = JSON.parse(texto); } catch { throw new Error(`${basename(caminho)} não é um JSON válido`); } // a mensagem do parser cita trecho do texto: não repassa
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) throw new Error(`${basename(caminho)} não é um objeto JSON`);
  if (serializarObjeto(obj) !== texto) throw Object.assign(new Error(`${basename(caminho)} está num formato que a troca não conhece (a releitura não é idêntica); nada foi gravado`), { codigo: 'formato' });
  return obj;
}

export function gravarObjeto(caminho, obj) {
  escreverAtomico(caminho, serializarObjeto(obj));
}

/**
 * O controle do app em produção. Nos testes entra um objeto falso com a mesma forma: { rodando, fechar, abrir }.
 * `-a` no pgrep e no pkill: sem ele os dois pulam o próprio processo e todos os ancestrais. A troca lançada de dentro do
 * app (terminal do app, painel aberto por ele) descende do Claude, então o pgrep dizia "não está rodando", a troca não
 * fechava o app e gravava o login com ele aberto (13/11/2026). `executar` e `dormir` existem para o teste.
 */
export function controleReal({ esperaFechar = 20_000, esperaMatar = 10_000, executar = spawnSync, dormir = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const rodando = () => executar('pgrep', ['-a', '-x', 'Claude'], { stdio: 'ignore' }).status === 0;
  const esperarSair = async (limite) => {
    for (const fim = Date.now() + limite; Date.now() < fim; await dormir(300)) {
      if (!rodando()) { await dormir(700); return true; }
    }
    return false;
  };
  return {
    rodando: async () => rodando(),
    async fechar() {
      if (!rodando()) return;
      executar('osascript', ['-e', 'tell application "Claude" to quit'], { stdio: 'ignore' });
      if (await esperarSair(esperaFechar)) return;
      executar('pkill', ['-9', '-a', '-x', 'Claude'], { stdio: 'ignore' }); // o sinal vem antes das opções, senão o pkill recusa
      if (await esperarSair(esperaMatar)) return;
      throw new Error('o Claude não fechou');
    },
    async abrir() {
      const r = executar('open', ['-a', 'Claude'], { stdio: 'ignore' });
      if (r.status !== 0) throw new Error('não consegui abrir o Claude');
    },
  };
}

/** A pasta de dados do app. `controle` é o controle do app (padrão: o real). */
export function criarApp({ dir = pastaDoApp(), controle = controleReal() } = {}) {
  const app = {
    dir,
    controle,
    configPath: () => join(dir, 'config.json'),
    sessoesDir: () => join(dir, 'claude-code-sessions'),
    /** Os cookies da sessão web; `Network/Cookies*` se a pasta existe, senão `Cookies*` na raiz. */
    arquivosDeCookie() {
      const base = existsSync(join(dir, 'Network')) ? join(dir, 'Network') : dir;
      return [join(base, 'Cookies'), join(base, 'Cookies-journal')];
    },
    lerConfig: () => lerObjetoConferido(join(dir, 'config.json')),
    gravarConfig: (obj) => gravarObjeto(join(dir, 'config.json'), obj),
    /** A conta logada no app, ou '' sem login. Recusa uuid que não serve de nome de pasta. */
    contaAtiva() {
      const cfg = app.lerConfig();
      if (!('oauth:tokenCacheV2' in cfg)) return '';
      const id = cfg.lastKnownAccountUuid;
      if (id === undefined || id === '') return '';
      if (!idSeguro(id)) throw new Error('lastKnownAccountUuid com caracteres que não servem de nome de pasta');
      return id;
    },
  };
  return app;
}
