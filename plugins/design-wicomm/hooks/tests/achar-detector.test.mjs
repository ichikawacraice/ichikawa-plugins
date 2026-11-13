// O crítico acha o detector do Impeccable instalado. Rodar: npm test na raiz do repositório.
// Nada aqui toca ~/.claude: HOME e o projeto ficam em pasta temporária.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(AQUI, '..', '..');
const SCRIPT = join(PLUGIN, 'skills', 'critica-de-ui', 'scripts', 'achar-detector.mjs');
const temporarias = [];
after(() => { for (const d of temporarias) rmSync(d, { recursive: true, force: true }); });

// Cenário: HOME e projeto (com .git) temporários; devolve helpers.
function cenario() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'achar-detector-')));
  temporarias.push(base);
  const home = join(base, 'home');
  const projeto = join(base, 'proj');
  const front = join(projeto, 'web');
  mkdirSync(join(home, '.claude', 'plugins'), { recursive: true });
  mkdirSync(join(projeto, '.git'), { recursive: true });
  mkdirSync(front, { recursive: true });
  const detector = (raiz) => {
    const f = join(raiz, 'skills', 'impeccable', 'scripts', 'detect.mjs');
    mkdirSync(dirname(f), { recursive: true });
    writeFileSync(f, '// detector falso\n');
    return f;
  };
  const registrar = (...entradas) => writeFileSync(join(home, '.claude', 'plugins', 'installed_plugins.json'),
    JSON.stringify({ version: 2, plugins: { 'impeccable@impeccable': entradas } }));
  const rodar = (cwd = front) => {
    const r = spawnSync('node', [SCRIPT], { cwd, env: { ...process.env, HOME: home }, encoding: 'utf8', timeout: 10_000, killSignal: 'SIGKILL' });
    assert.notEqual(r.status, null, `o script não terminou: ${r.stderr}`);
    return r;
  };
  return { base, home, projeto, front, detector, registrar, rodar };
}

describe('achar-detector (F66)', () => {
  it('o script existe (senão todos os casos abaixo medem um erro de arquivo ausente)', () => {
    assert.ok(existsSync(SCRIPT), `falta ${SCRIPT}`);
  });

  it('plugin de escopo user: imprime o detect.mjs do installPath e sai 0', () => {
    const c = cenario();
    const alvo = c.detector(join(c.base, 'cache', 'user'));
    assert.ok(existsSync(alvo));
    c.registrar({ scope: 'user', installPath: join(c.base, 'cache', 'user') });
    const r = c.rodar();
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), alvo);
  });

  it('escopo project cujo projectPath contém o cwd ganha o de user', () => {
    const c = cenario();
    const user = c.detector(join(c.base, 'cache', 'user'));
    const proj = c.detector(join(c.base, 'cache', 'proj'));
    assert.notEqual(user, proj);
    c.registrar({ scope: 'user', installPath: join(c.base, 'cache', 'user') },
      { scope: 'project', projectPath: c.projeto, installPath: join(c.base, 'cache', 'proj') });
    const r = c.rodar();
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), proj);
  });

  it('escopo project de outro projeto é ignorado', () => {
    const c = cenario();
    const user = c.detector(join(c.base, 'cache', 'user'));
    const outro = c.detector(join(c.base, 'cache', 'outro'));
    assert.notEqual(user, outro);
    c.registrar({ scope: 'project', projectPath: join(c.base, 'outro-projeto'), installPath: join(c.base, 'cache', 'outro') },
      { scope: 'user', installPath: join(c.base, 'cache', 'user') });
    const r = c.rodar();
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), user);
  });

  it('sem plugin, usa .claude/skills/impeccable/scripts/detect.mjs da raiz do projeto', () => {
    const c = cenario();
    const alvo = join(c.projeto, '.claude', 'skills', 'impeccable', 'scripts', 'detect.mjs');
    mkdirSync(dirname(alvo), { recursive: true });
    writeFileSync(alvo, '// detector falso\n');
    const r = c.rodar();
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), alvo);
  });

  it('installPath registrado sem o detect.mjs no disco e nada mais: sai 1 e lista os lugares conferidos', () => {
    const c = cenario();
    mkdirSync(join(c.base, 'cache', 'vazio'), { recursive: true });
    c.registrar({ scope: 'user', installPath: join(c.base, 'cache', 'vazio') });
    const r = c.rodar();
    assert.equal(r.status, 1);
    assert.equal(r.stdout.trim(), '');
    assert.match(r.stderr, /Impeccable n[ãa]o foi encontrado/);
    assert.ok(r.stderr.includes(join(c.base, 'cache', 'vazio')), `stderr sem o installPath conferido: ${r.stderr}`);
    assert.ok(r.stderr.includes(join(c.projeto, '.claude', 'skills', 'impeccable')), `stderr sem a pasta do projeto: ${r.stderr}`);
  });

  it('installed_plugins.json ilegível não lança e segue para os outros lugares', () => {
    const c = cenario();
    writeFileSync(join(c.home, '.claude', 'plugins', 'installed_plugins.json'), '{ não é json');
    const alvo = join(c.home, '.claude', 'skills', 'impeccable', 'scripts', 'detect.mjs');
    mkdirSync(dirname(alvo), { recursive: true });
    writeFileSync(alvo, '// detector falso\n');
    const r = c.rodar();
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.stdout.trim(), alvo);
  });

  it('concordância: o caminho do script citado na skill e no agente existe no plugin', () => {
    for (const f of [join(PLUGIN, 'skills', 'critica-de-ui', 'SKILL.md'), join(PLUGIN, 'agents', 'critico-de-ui.md')]) {
      const texto = readFileSync(f, 'utf8');
      const m = /\$\{CLAUDE_PLUGIN_ROOT\}\/([\w./-]*achar-detector\.mjs)/.exec(texto);
      assert.ok(m, `${f} não cita o achar-detector.mjs`);
      assert.ok(existsSync(join(PLUGIN, m[1])), `${f} cita ${m[1]}, que não existe`);
    }
  });
});
