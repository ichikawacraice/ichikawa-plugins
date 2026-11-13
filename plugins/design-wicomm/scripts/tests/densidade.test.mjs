// A densidade por rota: as três fontes (design-system.json / wicomm.json e a seção `densidade` do DESIGN.md),
// a precedência por chave, o casamento de rota, o `--de`, a ambiguidade e a tabela inválida. Tudo em pasta temporária.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { densidadeDaRota, densidadeDoProjeto, lerTabelaDeDensidade } from '../densidade.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(AQUI, '..', 'densidade.mjs');
const temporarias = [];
after(() => { for (const d of temporarias) rmSync(d, { recursive: true, force: true }); });
const pasta = (nome) => { const d = realpathSync(mkdtempSync(join(tmpdir(), `densidade-${nome}-`))); temporarias.push(d); return d; };
const escrever = (raiz, rel, texto) => { mkdirSync(dirname(join(raiz, rel)), { recursive: true }); writeFileSync(join(raiz, rel), texto); };
const json = (raiz, rel, obj) => escrever(raiz, rel, JSON.stringify(obj));

const TABELA = '| Rota | Densidade |\n|---|---|\n| `/builder/*` | site |\n| `*` | instrumento |\n';
const SECAO = `# Design\n\n<a id="densidade"></a>\n## Densidade\n\n${TABELA}`;
const SEM_ANCORA = `# Design\n\n## Densidade\n\n${TABELA}`;

describe('lerTabelaDeDensidade', () => {
  it('lê as linhas na ordem: * vira a densidade do projeto, o resto o mapa', () => {
    const t = lerTabelaDeDensidade(SECAO);
    assert.ok(t, 'a tabela devia ser lida');
    assert.equal(t.densidade, 'instrumento');
    assert.deepEqual(Object.keys(t.densidadePorRota), ['/builder/*']);
    assert.equal(t.densidadePorRota['/builder/*'], 'site');
    assert.deepEqual(t.invalidas, []);
  });

  it('sem a âncora não conta (e o mesmo texto com a âncora conta)', () => {
    assert.ok(lerTabelaDeDensidade(SECAO), 'com a âncora a tabela é lida');
    assert.equal(lerTabelaDeDensidade(SEM_ANCORA), null);
  });

  it('crase opcional, cabeçalho sem diferenciar maiúscula, densidade é a primeira palavra em minúscula', () => {
    const t = lerTabelaDeDensidade('<a id="densidade"></a>\n## D\n\n| ROTA | densidade |\n|---|---|\n| /a | Site (marketing) |\n| * | INSTRUMENTO |\n');
    assert.ok(t);
    assert.equal(t.densidadePorRota['/a'], 'site');
    assert.equal(t.densidade, 'instrumento');
  });

  it('tabela sem linhas ou sem as colunas é null; a seção acaba no próximo heading de nível igual ou maior', () => {
    assert.equal(lerTabelaDeDensidade('<a id="densidade"></a>\n## D\n\n| Rota | Densidade |\n|---|---|\n'), null);
    assert.equal(lerTabelaDeDensidade('<a id="densidade"></a>\n## D\n\n| Rota | Outra |\n|---|---|\n| `*` | site |\n'), null);
    assert.equal(lerTabelaDeDensidade(`<a id="densidade"></a>\n## D\n\ntexto\n\n## Outra\n\n${TABELA}`), null);
    assert.ok(lerTabelaDeDensidade(`<a id="densidade"></a>\n## D\n\n### Sub\n\n${TABELA}`), 'heading de nível menor não encerra');
  });

  it('valor fora de instrumento|site entra assim mesmo e o padrão vai em invalidas', () => {
    const t = lerTabelaDeDensidade('<a id="densidade"></a>\n## D\n\n| Rota | Densidade |\n|---|---|\n| `/x` | denso |\n| `*` | site |\n');
    assert.ok(t);
    assert.equal(t.densidadePorRota['/x'], 'denso');
    assert.deepEqual(t.invalidas, ['/x']);
  });
});

describe('densidadeDaRota', () => {
  const decl = (porRota, densidade = 'instrumento') => ({ densidade, densidadePorRota: porRota });

  it('a primeira chave que casa vence, na ordem da tabela', () => {
    const d = decl({ '/a/*': 'site', '/a/b': 'instrumento' });
    const r = densidadeDaRota(d, '/a/b');
    assert.equal(r.densidade, 'site');
    assert.equal(r.regra, '/a/*');
    const inverso = densidadeDaRota(decl({ '/a/b': 'instrumento', '/a/*': 'site' }), '/a/b');
    assert.equal(inverso.densidade, 'instrumento');
    assert.equal(inverso.regra, '/a/b');
  });

  it('/x/* casa /x e /x/y/z e não casa /xy', () => {
    const d = decl({ '/x/*': 'site' });
    assert.equal(densidadeDaRota(d, '/x').densidade, 'site');
    assert.equal(densidadeDaRota(d, '/x/y/z').densidade, 'site');
    const fora = densidadeDaRota(d, '/xy');
    assert.equal(fora.densidade, 'instrumento');
    assert.equal(fora.regra, null);
  });

  it('caractere de regex na rota é literal', () => {
    const d = decl({ '/a.b': 'site', '/c(1)': 'site', '/d+': 'site' });
    assert.equal(densidadeDaRota(d, '/a.b').densidade, 'site');
    assert.equal(densidadeDaRota(d, '/aXb').regra, null);
    assert.equal(densidadeDaRota(d, '/c(1)').densidade, 'site');
    assert.equal(densidadeDaRota(d, '/c1').regra, null);
    assert.equal(densidadeDaRota(d, '/d+').regra, '/d+');
    assert.equal(densidadeDaRota(d, '/dd').regra, null);
  });

  it('* no meio casa qualquer sequência, inclusive /', () => {
    const r = densidadeDaRota(decl({ '/a/*/edit': 'site' }), '/a/1/2/edit');
    assert.equal(r.densidade, 'site');
    assert.equal(r.regra, '/a/*/edit');
  });

  it('sem casar ou sem rota, vale a densidade do projeto; sem mapa também', () => {
    assert.deepEqual(densidadeDaRota(decl({ '/a': 'site' }), '/b'), { densidade: 'instrumento', regra: null });
    assert.deepEqual(densidadeDaRota(decl({ '/a': 'site' }), undefined), { densidade: 'instrumento', regra: null });
    assert.deepEqual(densidadeDaRota({ densidade: 'site', densidadePorRota: null }, '/a'), { densidade: 'site', regra: null });
  });
});

describe('densidadeDoProjeto: cada fonte sozinha', () => {
  it('design/design-system.json', () => {
    const raiz = pasta('json');
    json(raiz, 'design/design-system.json', { densidade: 'site', densidadePorRota: { '/app/*': 'instrumento' } });
    const p = densidadeDoProjeto(raiz);
    assert.equal(p.densidade, 'site');
    assert.deepEqual(p.densidadePorRota, { '/app/*': 'instrumento' });
    assert.equal(p.fonte.densidade, 'design/design-system.json');
    assert.equal(p.fonte.densidadePorRota, 'design/design-system.json');
    assert.deepEqual(p.avisos, []);
  });

  it('design/wicomm.json antigo', () => {
    const raiz = pasta('wicomm');
    json(raiz, 'design/wicomm.json', { densidade: 'instrumento', densidadePorRota: { '/site/*': 'site' } });
    const p = densidadeDoProjeto(raiz);
    assert.equal(p.densidade, 'instrumento');
    assert.deepEqual(p.densidadePorRota, { '/site/*': 'site' });
    assert.equal(p.fonte.densidade, 'design/wicomm.json');
    assert.equal(p.fonte.densidadePorRota, 'design/wicomm.json');
  });

  it('.claude/kit.json não conta: o plugin não depende do kit antigo', () => {
    const raiz = pasta('kit');
    json(raiz, '.claude/kit.json', { design: { densidade: 'site' } });
    assert.equal(densidadeDoProjeto(raiz).densidade, null);
  });

  it('DESIGN.md na raiz', () => {
    const raiz = pasta('raiz');
    escrever(raiz, 'DESIGN.md', SECAO);
    const p = densidadeDoProjeto(raiz);
    assert.equal(p.densidade, 'instrumento');
    assert.deepEqual(p.densidadePorRota, { '/builder/*': 'site' });
    assert.equal(p.fonte.densidade, 'DESIGN.md#densidade');
    assert.equal(p.fonte.densidadePorRota, 'DESIGN.md#densidade');
  });

  it('DESIGN.md em design/', () => {
    const raiz = pasta('design');
    escrever(raiz, 'design/DESIGN.md', SECAO);
    const p = densidadeDoProjeto(raiz);
    assert.equal(p.densidade, 'instrumento');
    assert.equal(p.fonte.densidade, 'design/DESIGN.md#densidade');
  });

  it('DESIGN.md em pacotes/front/ pela varredura', () => {
    const raiz = pasta('varredura');
    escrever(raiz, 'pacotes/front/DESIGN.md', SECAO);
    escrever(raiz, 'node_modules/x/DESIGN.md', SECAO.replace('instrumento', 'site'));
    escrever(raiz, '.oculta/DESIGN.md', SECAO.replace('instrumento', 'site'));
    const p = densidadeDoProjeto(raiz);
    assert.equal(p.densidade, 'instrumento');
    assert.equal(p.fonte.densidadePorRota, 'pacotes/front/DESIGN.md#densidade');
    assert.deepEqual(p.avisos, []);
  });

  it('a varredura para no nível 3 abaixo da raiz', () => {
    const raiz = pasta('fundo');
    escrever(raiz, 'a/b/c/DESIGN.md', SECAO);
    assert.equal(densidadeDoProjeto(raiz).densidade, 'instrumento', 'nível 3 conta');
    const funda = pasta('fundo4');
    escrever(funda, 'a/b/c/d/DESIGN.md', SECAO);
    const p = densidadeDoProjeto(funda);
    assert.equal(p.densidade, null);
  });

  it('DESIGN.md listado em fontes (vale antes da varredura)', () => {
    const raiz = pasta('fontes');
    json(raiz, 'design/design-system.json', { fontes: ['pacotes/front/DESIGN.md', 'outro.css'] });
    escrever(raiz, 'pacotes/front/DESIGN.md', SECAO);
    escrever(raiz, 'apps/mobile/DESIGN.md', SECAO.replace('instrumento', 'site'));
    const p = densidadeDoProjeto(raiz);
    assert.equal(p.densidade, 'instrumento');
    assert.equal(p.fonte.densidade, 'pacotes/front/DESIGN.md#densidade');
    assert.deepEqual(p.avisos, []);
  });

  it('--de: o primeiro DESIGN.md subindo da pasta do arquivo, inclusive a raiz', () => {
    const raiz = pasta('de');
    escrever(raiz, 'pacotes/front/DESIGN.md', SECAO);
    escrever(raiz, 'pacotes/front/src/pages/a.tsx', '');
    escrever(raiz, 'DESIGN.md', SECAO.replace('instrumento', 'site'));
    const p = densidadeDoProjeto(raiz, { de: 'pacotes/front/src/pages/a.tsx' });
    assert.equal(p.densidade, 'instrumento');
    assert.equal(p.fonte.densidade, 'pacotes/front/DESIGN.md#densidade');
    const abs = densidadeDoProjeto(raiz, { de: join(raiz, 'pacotes/front/src/pages/a.tsx') });
    assert.equal(abs.fonte.densidade, 'pacotes/front/DESIGN.md#densidade');
    const naRaiz = densidadeDoProjeto(raiz, { de: 'outra/pasta/b.tsx' });
    assert.equal(naRaiz.densidade, 'site');
    assert.equal(naRaiz.fonte.densidade, 'DESIGN.md#densidade');
  });

  it('o DESIGN.md de fontes vale mesmo sem tabela, não cai na varredura e avisa', () => {
    const raiz = pasta('fontes-sem-tabela');
    json(raiz, 'design/design-system.json', { fontes: ['pacotes/front/DESIGN.md'] });
    escrever(raiz, 'pacotes/front/DESIGN.md', '# Só texto\n');
    escrever(raiz, 'apps/mobile/DESIGN.md', SECAO);
    const p = densidadeDoProjeto(raiz);
    assert.equal(p.densidade, null);
    assert.equal(p.densidadePorRota, null);
    assert.equal(p.avisos.length, 1);
    assert.match(p.avisos[0], /pacotes\/front\/DESIGN\.md.*não tem a seção densidade/);
  });

  it('--de: DESIGN.md sem a seção no caminho não encerra a busca; sobe até o que tem a tabela', () => {
    const raiz = pasta('de-sombra');
    escrever(raiz, 'DESIGN.md', SECAO);
    escrever(raiz, 'pacotes/front/DESIGN.md', '# Só as cores\n');
    const p = densidadeDoProjeto(raiz, { de: 'pacotes/front/src/b.tsx' });
    assert.equal(p.densidade, 'instrumento');
    assert.equal(p.fonte.densidade, 'DESIGN.md#densidade');
    assert.deepEqual(p.avisos, []);
  });

  it('--de: sem DESIGN.md com tabela subindo, vale a varredura', () => {
    const raiz = pasta('de-varre');
    escrever(raiz, 'pacotes/front/DESIGN.md', '# Só texto\n');
    escrever(raiz, 'apps/mobile/DESIGN.md', SECAO);
    const p = densidadeDoProjeto(raiz, { de: 'pacotes/front/a.tsx' });
    assert.equal(p.densidade, 'instrumento');
    assert.equal(p.fonte.densidade, 'apps/mobile/DESIGN.md#densidade');
  });

  it('--de absoluto pelo caminho real vale com a raiz passada por link simbólico', () => {
    const real = pasta('link-real');
    escrever(real, 'pacotes/front/DESIGN.md', SECAO);
    escrever(real, 'pacotes/admin/DESIGN.md', SECAO.replace('instrumento', 'site'));
    const link = join(pasta('link-pai'), 'projeto');
    symlinkSync(real, link);
    const p = densidadeDoProjeto(link, { de: join(real, 'pacotes/front/a.tsx') });
    assert.equal(p.densidade, 'instrumento');
    assert.equal(p.fonte.densidade, 'pacotes/front/DESIGN.md#densidade');
    assert.deepEqual(p.avisos, []);
  });

  it('sem nada declarado: tudo null', () => {
    const raiz = pasta('nada');
    escrever(raiz, 'DESIGN.md', SEM_ANCORA);
    const p = densidadeDoProjeto(raiz);
    assert.equal(p.densidade, null);
    assert.equal(p.densidadePorRota, null);
    assert.deepEqual(p.fonte, { densidade: null, densidadePorRota: null });
  });
});

describe('densidadeDoProjeto: precedência e ambiguidade', () => {
  it('por chave: o json diz a densidade e o DESIGN.md diz as rotas, cada uma com a sua fonte', () => {
    const raiz = pasta('chave');
    json(raiz, 'design/design-system.json', { densidade: 'site' });
    escrever(raiz, 'pacotes/front/DESIGN.md', SECAO);
    const p = densidadeDoProjeto(raiz);
    assert.equal(p.densidade, 'site');
    assert.equal(p.fonte.densidade, 'design/design-system.json');
    assert.deepEqual(p.densidadePorRota, { '/builder/*': 'site' });
    assert.equal(p.fonte.densidadePorRota, 'pacotes/front/DESIGN.md#densidade');
  });

  it('o json com densidadePorRota vence a tabela', () => {
    const raiz = pasta('vence');
    json(raiz, 'design/design-system.json', { densidadePorRota: { '/builder/*': 'instrumento' } });
    escrever(raiz, 'DESIGN.md', SECAO);
    const p = densidadeDoProjeto(raiz);
    assert.deepEqual(p.densidadePorRota, { '/builder/*': 'instrumento' });
    assert.equal(p.fonte.densidadePorRota, 'design/design-system.json');
    assert.equal(p.densidade, 'instrumento');
    assert.equal(p.fonte.densidade, 'DESIGN.md#densidade');
  });

  it('o novo vence o antigo; a fonte é o arquivo que disse', () => {
    const raiz = pasta('ordem');
    json(raiz, 'design/design-system.json', { densidade: 'site' });
    json(raiz, 'design/wicomm.json', { densidade: 'instrumento', densidadePorRota: { '/a': 'site' } });
    const p = densidadeDoProjeto(raiz);
    assert.equal(p.densidade, 'site');
    assert.equal(p.fonte.densidade, 'design/design-system.json');
    assert.deepEqual(p.densidadePorRota, { '/a': 'site' });
    assert.equal(p.fonte.densidadePorRota, 'design/wicomm.json');
  });

  it('dois DESIGN.md com tabela: nada vale e o aviso lista os dois caminhos; com `de` resolve', () => {
    const raiz = pasta('dois');
    escrever(raiz, 'pacotes/front/DESIGN.md', SECAO);
    escrever(raiz, 'apps/admin/DESIGN.md', SECAO.replace('instrumento', 'site'));
    const p = densidadeDoProjeto(raiz);
    assert.equal(p.densidade, null);
    assert.equal(p.densidadePorRota, null);
    assert.ok(p.avisos.length > 0, 'devia avisar');
    const aviso = p.avisos.join('\n');
    assert.match(aviso, /pacotes\/front\/DESIGN\.md/);
    assert.match(aviso, /apps\/admin\/DESIGN\.md/);
    assert.match(aviso, /--de/);
    const r = densidadeDoProjeto(raiz, { de: 'apps/admin/src/x.tsx' });
    assert.equal(r.densidade, 'site');
    assert.deepEqual(r.avisos, []);
  });

  it('DESIGN.md sem a âncora não conta na varredura, e o mesmo arquivo com a âncora conta', () => {
    const raiz = pasta('ancora');
    escrever(raiz, 'pacotes/front/DESIGN.md', SECAO);
    escrever(raiz, 'apps/admin/DESIGN.md', SEM_ANCORA.replace('instrumento', 'site'));
    const p = densidadeDoProjeto(raiz);
    assert.equal(p.densidade, 'instrumento', 'o sem âncora não gera ambiguidade');
    assert.deepEqual(p.avisos, []);
    escrever(raiz, 'apps/admin/DESIGN.md', SECAO.replace('instrumento', 'site'));
    const q = densidadeDoProjeto(raiz);
    assert.equal(q.densidade, null, 'com a âncora, o mesmo arquivo conta e gera a ambiguidade');
    assert.ok(q.avisos.length > 0);
  });

  it('valor inválido na tabela vira aviso, sem quebrar', () => {
    const raiz = pasta('invalida');
    escrever(raiz, 'DESIGN.md', '<a id="densidade"></a>\n## D\n\n| Rota | Densidade |\n|---|---|\n| `/x/*` | denso |\n| `*` | instrumento |\n');
    const p = densidadeDoProjeto(raiz);
    assert.equal(p.densidadePorRota['/x/*'], 'denso');
    assert.ok(p.avisos.length > 0, 'devia avisar');
    assert.match(p.avisos.join('\n'), /\/x\/\*/);
  });
});

describe('CLI', () => {
  const rodar = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf-8', timeout: 20000, killSignal: 'SIGKILL' });

  it('--json imprime o resultado do projeto, a rota e o daRota', () => {
    const raiz = pasta('cli-json');
    escrever(raiz, 'pacotes/front/DESIGN.md', SECAO);
    const r = rodar(raiz, '/builder/novo', '--json');
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.length > 0);
    const j = JSON.parse(r.stdout);
    assert.equal(j.densidade, 'instrumento');
    assert.equal(j.rota, '/builder/novo');
    assert.deepEqual(j.daRota, { densidade: 'site', regra: '/builder/*' });
    assert.equal(j.fonte.densidadePorRota, 'pacotes/front/DESIGN.md#densidade');
    const sem = JSON.parse(rodar(raiz, '--json').stdout);
    assert.equal('daRota' in sem, false);
  });

  it('--de seleciona o DESIGN.md', () => {
    const raiz = pasta('cli-de');
    escrever(raiz, 'pacotes/front/DESIGN.md', SECAO);
    escrever(raiz, 'apps/admin/DESIGN.md', SECAO.replace('instrumento', 'site'));
    const j = JSON.parse(rodar(raiz, '--de', 'apps/admin/x.tsx', '--json').stdout);
    assert.equal(j.densidade, 'site');
  });

  it('markdown: densidade, fonte, rotas e a linha da rota', () => {
    const raiz = pasta('cli-md');
    escrever(raiz, 'pacotes/front/DESIGN.md', SECAO);
    const r = rodar(raiz, '/builder/novo');
    assert.equal(r.status, 0, r.stderr);
    assert.ok(r.stdout.length > 0);
    assert.match(r.stdout, /instrumento/);
    assert.match(r.stdout, /pacotes\/front\/DESIGN\.md#densidade/);
    assert.match(r.stdout, /Rota `\/builder\/novo`: site \(regra `\/builder\/\*`\)/);
    const resto = rodar(raiz, '/outra');
    assert.match(resto.stdout, /Rota `\/outra`: instrumento \(densidade do projeto\)/);
  });

  it('markdown sem nada declarado diz a frase de decidir por rota', () => {
    const raiz = pasta('cli-nada');
    const r = rodar(raiz);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Densidade não declarada \(nem design\/design-system\.json, nem a seção `densidade` de um DESIGN\.md\): decida por rota e marque \*assumida, a confirmar\*\./);
  });

  it('avisos vão no fim do markdown', () => {
    const raiz = pasta('cli-aviso');
    escrever(raiz, 'a/DESIGN.md', SECAO);
    escrever(raiz, 'b/DESIGN.md', SECAO);
    const r = rodar(raiz);
    assert.match(r.stdout, /a\/DESIGN\.md/);
    assert.match(r.stdout, /--de/);
  });

  it('sem raiz, ou com raiz que não existe, sai com status 2 e uso no stderr', () => {
    const sem = rodar();
    assert.equal(sem.status, 2);
    assert.ok(sem.stderr.length > 0);
    assert.match(sem.stderr, /uso: node densidade\.mjs/);
    const falta = rodar(join(tmpdir(), 'densidade-nao-existe-xyz'));
    assert.equal(falta.status, 2);
  });
});
