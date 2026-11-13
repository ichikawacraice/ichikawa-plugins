import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { criarApp } from '../app-do-claude.mjs';
import { backup, limparLogin, podarBackups, restaurarBackup, restaurarPerfil, salvarPerfil } from '../perfis.mjs';
import { CONTA_A, CONTA_B, configDe, controleFalso, montar, textoDeConfig } from './fabrica.mjs';

const novo = (opts) => { const m = montar(opts); return { m, app: criarApp({ dir: m.appDir, controle: controleFalso() }) }; };
const modo = (p) => statSync(p).mode & 0o777;

describe('perfis: salvar e restaurar', () => {
  it('salva só as 3 chaves e os cookies, em pasta 0700 e arquivos 0600', () => {
    const { m, app } = novo();
    const dir = join(m.dados, 'contas', CONTA_A);
    salvarPerfil(app, dir);
    const salvo = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'));
    assert.deepEqual(Object.keys(salvo).sort(), ['lastKnownAccountUuid', 'oauth:tokenCache', 'oauth:tokenCacheV2']);
    assert.equal(salvo['oauth:tokenCacheV2'], 'SENTINELA-V2-A');
    assert.equal(readFileSync(join(dir, 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-A');
    assert.equal(modo(dir), 0o700);
    for (const f of readdirSync(dir)) assert.equal(modo(join(dir, f)), 0o600, f);
  });

  it('ida e volta deixa o config.json idêntico byte a byte e os cookies de cada conta no lugar', () => {
    const { m, app } = novo();
    const original = m.lerConfig();
    assert.ok(original.length > 0);
    const dirA = join(m.dados, 'contas', CONTA_A);
    const dirB = join(m.dados, 'contas', CONTA_B);
    // a conta B salva, vinda de outro config com as mesmas chaves nas mesmas posições
    mkdirSync(dirB, { recursive: true });
    const cfgB = configDe(CONTA_B);
    writeFileSync(join(dirB, 'config.json'), textoDeConfig({ 'oauth:tokenCache': cfgB['oauth:tokenCache'], 'oauth:tokenCacheV2': cfgB['oauth:tokenCacheV2'], lastKnownAccountUuid: CONTA_B }));
    writeFileSync(join(dirB, 'Cookies'), 'SENTINELA-COOKIE-B');

    salvarPerfil(app, dirA);
    restaurarPerfil(app, dirB);
    const noMeio = JSON.parse(m.lerConfig());
    assert.equal(noMeio.lastKnownAccountUuid, CONTA_B);
    assert.equal(noMeio['oauth:tokenCacheV2'], 'SENTINELA-V2-B');
    assert.equal(noMeio.theme, 'dark', 'o resto do config não muda');
    assert.equal(readFileSync(join(m.appDir, 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-B');
    assert.ok(!existsSync(join(m.appDir, 'Cookies-journal')), 'conta sem journal: o do outro não fica');

    salvarPerfil(app, dirB);
    restaurarPerfil(app, dirA);
    assert.equal(m.lerConfig(), original);
    assert.equal(readFileSync(join(m.appDir, 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-A');
    assert.equal(readFileSync(join(m.appDir, 'Cookies-journal'), 'utf8'), 'diario-A');
  });

  it('restaurar tira do config a chave que o perfil salvo não tem', () => {
    const { m, app } = novo();
    const dir = join(m.dados, 'contas', 'x');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), textoDeConfig({ lastKnownAccountUuid: CONTA_B }));
    restaurarPerfil(app, dir);
    const cfg = JSON.parse(m.lerConfig());
    assert.ok(!('oauth:tokenCacheV2' in cfg) && !('oauth:tokenCache' in cfg));
    assert.equal(cfg.lastKnownAccountUuid, CONTA_B);
  });

  it('config.json em formato desconhecido recusa sem gravar nada (nem perfil, nem cookies)', () => {
    const { m, app } = novo();
    const estranho = JSON.stringify(JSON.parse(m.lerConfig()), null, 2);
    assert.ok(estranho.length > 0);
    writeFileSync(join(m.appDir, 'config.json'), estranho);
    const dir = join(m.dados, 'contas', CONTA_A);
    assert.throws(() => salvarPerfil(app, dir), /formato/);
    assert.ok(!existsSync(dir));
    assert.throws(() => limparLogin(app), /formato/);
    assert.equal(m.lerConfig(), estranho);
    assert.ok(existsSync(join(m.appDir, 'Cookies')), 'limpar não apagou o cookie antes de falhar');
  });

  it('limparLogin tira as 3 chaves e os cookies e deixa o resto', () => {
    const { m, app } = novo();
    limparLogin(app);
    const cfg = JSON.parse(m.lerConfig());
    assert.deepEqual(Object.keys(cfg), ['theme', 'locale', 'zoom']);
    assert.ok(!existsSync(join(m.appDir, 'Cookies')) && !existsSync(join(m.appDir, 'Cookies-journal')));
    assert.equal(app.contaAtiva(), '');
  });

  it('cookies em Network/ são salvos e restaurados lá', () => {
    const { m, app } = novo({ cookiesEmNetwork: true });
    const dir = join(m.dados, 'contas', CONTA_A);
    salvarPerfil(app, dir);
    assert.equal(readFileSync(join(dir, 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-A');
    writeFileSync(join(m.appDir, 'Network', 'Cookies'), 'outro');
    restaurarPerfil(app, dir);
    assert.equal(readFileSync(join(m.appDir, 'Network', 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-A');
  });
});

describe('perfis: backup', () => {
  it('copia config.json e cookies, e restaurar desfaz o que mudou, inclusive cookie apagado', () => {
    const { m, app } = novo();
    const original = m.lerConfig();
    const raiz = join(m.dados, 'backups');
    const bk = backup(app, raiz, new Date(2026, 10, 7, 10, 0, 0));
    assert.ok(readdirSync(bk).includes('config.json') && readdirSync(bk).includes('Cookies'));
    assert.equal(modo(bk), 0o700);
    limparLogin(app);
    assert.notEqual(m.lerConfig(), original);
    restaurarBackup(app, bk);
    assert.equal(m.lerConfig(), original);
    assert.equal(readFileSync(join(m.appDir, 'Cookies'), 'utf8'), 'SENTINELA-COOKIE-A');
  });

  it('guarda só os 10 últimos', () => {
    const { m, app } = novo();
    const raiz = join(m.dados, 'backups');
    for (let i = 0; i < 13; i++) backup(app, raiz, new Date(2026, 10, 7, 10, 0, i));
    const nomes = readdirSync(raiz).sort();
    assert.equal(nomes.length, 10);
    assert.match(nomes[0], /^20261107-100003/, 'os 3 mais velhos saíram');
    podarBackups(join(m.dados, 'nao-existe'));
  });
});
