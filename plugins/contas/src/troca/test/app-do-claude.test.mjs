import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, statSync, statfsSync, utimesSync, writeFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { clonarArquivo, copiarArquivo, criarApp, escreverAtomico, idSeguro, lerObjetoConferido, pastaDeDados, pastaDoApp } from '../app-do-claude.mjs';
import { CONTA_A, controleFalso, montar, textoDeConfig } from './fabrica.mjs';

describe('app-do-claude: caminhos', () => {
  it('CLAUDE_APP_DIR e TROCA_DE_CONTA_DIR trocam as pastas; o padrão fica na pasta pessoal', () => {
    assert.equal(pastaDoApp({ CLAUDE_APP_DIR: '/tmp/x-app' }), '/tmp/x-app');
    assert.equal(pastaDeDados({ TROCA_DE_CONTA_DIR: '/tmp/x-dados' }), '/tmp/x-dados');
    assert.match(pastaDoApp({}), /Library\/Application Support\/Claude$/);
    assert.match(pastaDeDados({}), /\.claude-account-switcher$/);
  });

  it('cookies ficam em Network/ se a pasta existe; senão na raiz', () => {
    const raiz = montar();
    const rede = montar({ cookiesEmNetwork: true });
    const a = criarApp({ dir: raiz.appDir, controle: controleFalso() }).arquivosDeCookie();
    const b = criarApp({ dir: rede.appDir, controle: controleFalso() }).arquivosDeCookie();
    assert.deepEqual(a, [join(raiz.appDir, 'Cookies'), join(raiz.appDir, 'Cookies-journal')]);
    assert.deepEqual(b, [join(rede.appDir, 'Network', 'Cookies'), join(rede.appDir, 'Network', 'Cookies-journal')]);
  });
});

describe('app-do-claude: config.json', () => {
  it('lê o formato do app (tabulação, sem \\n final) e acha a conta ativa', () => {
    const m = montar();
    const app = criarApp({ dir: m.appDir, controle: controleFalso() });
    const cfg = app.lerConfig();
    assert.ok(Object.keys(cfg).length > 0);
    assert.equal(app.contaAtiva(), CONTA_A);
  });

  it('sem oauth:tokenCacheV2 não há conta ativa', () => {
    const m = montar();
    const cfg = JSON.parse(m.lerConfig());
    delete cfg['oauth:tokenCacheV2'];
    writeFileSync(join(m.appDir, 'config.json'), textoDeConfig(cfg));
    assert.equal(criarApp({ dir: m.appDir, controle: controleFalso() }).contaAtiva(), '');
  });

  it('uuid com barra ou ponto-ponto é recusado (viraria nome de pasta)', () => {
    assert.equal(idSeguro('abc-123'), true);
    for (const ruim of ['../x', 'a/b', '', '.oculto', null, 5]) assert.equal(idSeguro(ruim), false, String(ruim));
    const m = montar();
    const cfg = JSON.parse(m.lerConfig());
    cfg.lastKnownAccountUuid = '../fora';
    writeFileSync(join(m.appDir, 'config.json'), textoDeConfig(cfg));
    assert.throws(() => criarApp({ dir: m.appDir, controle: controleFalso() }).contaAtiva(), /nome de pasta/);
  });

  it('formato que a releitura não repete (2 espaços, \\n final) recusa', () => {
    const m = montar();
    const p = join(m.appDir, 'config.json');
    const obj = JSON.parse(m.lerConfig());
    assert.ok(Object.keys(obj).length > 0);
    writeFileSync(p, JSON.stringify(obj, null, 2));
    assert.throws(() => lerObjetoConferido(p), /formato que a troca não conhece/);
    writeFileSync(p, `${textoDeConfig(obj)}\n`);
    assert.throws(() => lerObjetoConferido(p), /formato que a troca não conhece/);
  });

  it('o erro de formato leva o código formato; JSON inválido não', () => {
    const m = montar();
    const p = join(m.appDir, 'config.json');
    const obj = JSON.parse(m.lerConfig());
    assert.ok(Object.keys(obj).length > 0);
    writeFileSync(p, JSON.stringify(obj, null, 2));
    assert.throws(() => lerObjetoConferido(p), (e) => e.codigo === 'formato');
    writeFileSync(p, '{quebrado');
    assert.throws(() => lerObjetoConferido(p), (e) => e instanceof Error && e.codigo === undefined);
  });

  it('JSON inválido e não-objeto recusam, e a mensagem não cita trecho do arquivo', () => {
    const m = montar();
    const p = join(m.appDir, 'config.json');
    writeFileSync(p, '{"oauth:tokenCacheV2": "SENTINELA-V2-A" quebrado');
    assert.throws(() => lerObjetoConferido(p), (e) => /não é um JSON válido/.test(e.message) && !e.message.includes('SENTINELA'));
    writeFileSync(p, '[1]');
    assert.throws(() => lerObjetoConferido(p), /não é um objeto/);
  });

  it('gravação é atômica, 0600, e não deixa temporário', () => {
    const m = montar();
    const app = criarApp({ dir: m.appDir, controle: controleFalso() });
    const cfg = app.lerConfig();
    cfg.theme = 'light';
    app.gravarConfig(cfg);
    assert.equal(statSync(join(m.appDir, 'config.json')).mode & 0o777, 0o600);
    assert.equal(existsSync(join(m.appDir, 'config.json.troca-tmp')), false);
    assert.equal(JSON.parse(m.lerConfig()).theme, 'light');
    escreverAtomico(join(m.dados, 'sub', 'a.txt'), 'x');
    assert.equal(statSync(join(m.dados, 'sub')).mode & 0o777, 0o700);
    assert.equal(readFileSync(join(m.dados, 'sub', 'a.txt'), 'utf8'), 'x');
  });
});

describe('app-do-claude: cópia clonada (F560)', () => {
  it('a cópia é clonada no APFS, idêntica, com a data da origem e independente na escrita', () => {
    const m = montar();
    const src = join(m.dados, 'origem.json');
    writeFileSync(src, '{"a":1}');
    utimesSync(src, new Date(1_700_000_000_000), new Date(1_700_000_000_000));
    const dst = join(m.dados, 'sub', 'copia.json');
    copiarArquivo(src, dst);
    assert.equal(readFileSync(dst, 'utf8'), '{"a":1}');
    assert.equal(statSync(dst).mtimeMs, statSync(src).mtimeMs);
    assert.equal(statSync(dst).mode & 0o777, 0o600);
    assert.equal(existsSync(`${dst}.troca-tmp`), false);
    // Clone de verdade divide blocos, mas não é hardlink: inode diferente e escrita que não vaza.
    assert.notEqual(statSync(dst).ino, statSync(src).ino);
    writeFileSync(dst, '{"a":2}');
    assert.equal(readFileSync(src, 'utf8'), '{"a":1}');
  });

  it('no APFS o clone acontece; com TROCA_SEM_CLONE=1 a cópia comum dá o mesmo arquivo', () => {
    const m = montar();
    const src = join(m.dados, 'origem.json');
    writeFileSync(src, '{"a":1}');
    assert.equal(clonarArquivo(src, join(m.dados, 'clonado.json')), process.platform === 'darwin');
    assert.equal(clonarArquivo(src, join(m.dados, 'x.json'), { TROCA_SEM_CLONE: '1' }), false);
    assert.equal(clonarArquivo(join(m.dados, 'nao-existe'), join(m.dados, 'y.json')), false);
    if (process.platform === 'darwin') assert.equal(readFileSync(join(m.dados, 'clonado.json'), 'utf8'), '{"a":1}');
    // Sem clone o resultado é o mesmo: a cópia comum entra no lugar.
    const antes = process.env.TROCA_SEM_CLONE;
    process.env.TROCA_SEM_CLONE = '1';
    try { copiarArquivo(src, join(m.dados, 'sem-clone.json')); } finally {
      if (antes === undefined) delete process.env.TROCA_SEM_CLONE; else process.env.TROCA_SEM_CLONE = antes;
    }
    assert.equal(readFileSync(join(m.dados, 'sem-clone.json'), 'utf8'), '{"a":1}');
  });
});

describe('app-do-claude: a cópia clona de verdade (medido no volume)', () => {
  const gravar = (caminho, texto) => {
    const fd = openSync(caminho, 'w');
    try { writeSync(fd, texto); fsyncSync(fd); } finally { closeSync(fd); }
  };

  it('a cópia clonada quase não gasta disco; sem clone gasta o arquivo inteiro', (t) => {
    if (process.platform !== 'darwin') { t.skip('o clone de blocos é do APFS'); return; }
    const m = montar();
    const src = join(m.dados, 'grande.json');
    gravar(src, `{"t":"${'x'.repeat(24 * 1024 * 1024)}"}`);
    const livre = () => { const s = statfsSync(m.dados); return s.bavail * s.bsize; };
    // Primeiro a presença: a cópia comum gasta o tamanho do arquivo. Sem isso a medição não provaria nada.
    const antesSemClone = livre();
    const salvo = process.env.TROCA_SEM_CLONE;
    process.env.TROCA_SEM_CLONE = '1';
    try { copiarArquivo(src, join(m.dados, 'comum.json')); } finally {
      if (salvo === undefined) delete process.env.TROCA_SEM_CLONE; else process.env.TROCA_SEM_CLONE = salvo;
    }
    const semClone = antesSemClone - livre();
    if (semClone < 12 * 1024 * 1024) { t.skip(`o espaço livre do volume não mostra o gasto da cópia comum (${semClone} bytes): a medição não detectaria a economia`); return; }
    const antesComClone = livre();
    copiarArquivo(src, join(m.dados, 'clonada.json'));
    const comClone = antesComClone - livre();
    assert.ok(comClone < semClone / 4, `a cópia gastou ${comClone} bytes contra ${semClone} da cópia comum: não clonou`);
    assert.equal(readFileSync(join(m.dados, 'clonada.json'), 'utf8'), readFileSync(src, 'utf8'));
  });
});
