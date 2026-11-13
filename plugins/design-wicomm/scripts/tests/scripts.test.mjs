// Os scripts das skills: deriva (auditar-projeto), base estampada (novo-projeto, atualizar-sistema) e estado.
// Rodar: npm test na raiz do repositório. Tudo em pasta temporária.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { ARQUIVOS, BASE_DO_PLUGIN, atualizar, estampar, gitMergeFile, hash, versaoDaBase, versaoDe } from '../base-do-projeto.mjs';
import { emMarkdown as estadoMd, estado, notas } from '../estado.mjs';
import { medir, medirProjeto } from '../medir-deriva.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const temporarias = [];
after(() => { for (const d of temporarias) rmSync(d, { recursive: true, force: true }); });
const pasta = (nome) => { const d = realpathSync(mkdtempSync(join(tmpdir(), `wicomm-${nome}-`))); temporarias.push(d); return d; };
const escrever = (raiz, rel, texto) => { mkdirSync(dirname(join(raiz, rel)), { recursive: true }); writeFileSync(join(raiz, rel), texto); };

describe('medir-deriva', () => {
  it('conta valor solto por categoria, ícones, tamanhos, raios, alturas e animação sem escape', () => {
    const m = medir([
      { caminho: 'a.tsx', texto: "import { X } from 'lucide-react';\nimport { FaB } from 'react-icons/fa';\n<div className=\"text-[15px] text-sm h-[34px] h-9 rounded-lg bg-[#fff] animate-spin\" />" },
      { caminho: 'b.tsx', texto: '<div className="text-sm rounded transition-colors motion-reduce:transition-none" />' },
      { caminho: 'c.css', texto: ':root {\n  --marca: #F30B42;\n}\n.x { color: #000; }' },
    ]);
    assert.equal(m.arquivos, 3);
    const cat = Object.fromEntries(m.valorSolto.porCategoria);
    assert.equal(cat['valor arbitrário (PRIN-06)'], 2);
    assert.equal(cat['cor literal (CONV-04)'], 2, 'o #fff da classe e o #000 da regra; o token declarado não conta');
    assert.equal(cat['ícone de outra biblioteca (CTRL-09)'], 1);
    assert.deepEqual(Object.fromEntries(m.icones), { 'lucide-react': 1, 'react-icons': 1 });
    assert.deepEqual(Object.fromEntries(m.tamanhosDeFonte), { 'text-sm': 2, 'text-[15px]': 1 });
    assert.deepEqual(m.raios, [['rounded', 1, 4], ['rounded-lg', 1, 8]], 'o raio em px, pela escala padrão do v3');
    assert.deepEqual(Object.fromEntries(m.alturas.outra), { 'h-[34px]': 1, 'h-9': 1 });
    assert.deepEqual(m.animacaoSemEscape.arquivos, [['a.tsx', 1]], 'b.tsx tem o escape');
    assert.deepEqual(m.valorSolto.piores[0], ['a.tsx', 4, []]);
  });
  it('o projeto inteiro: stack, peças da pasta ui, e larga node_modules, dist e testes', () => {
    const raiz = pasta('deriva');
    escrever(raiz, 'web/package.json', JSON.stringify({ dependencies: { react: '^19.0.0', next: '15.5.0' }, devDependencies: { tailwindcss: '^3.4.1' } }));
    escrever(raiz, 'web/tailwind.config.ts', 'export default {}');
    escrever(raiz, 'web/components.json', JSON.stringify({ style: 'new-york' }));
    escrever(raiz, 'web/src/components/ui/button.tsx', '<button className="h-[30px]" />');
    escrever(raiz, 'web/src/components/ui/button.test.tsx', 'h-[1px]');
    escrever(raiz, 'web/src/node_modules/x/y.tsx', 'h-[2px]');
    escrever(raiz, 'web/src/dist/z.tsx', 'h-[3px]');
    const m = medirProjeto(raiz, 'web');
    assert.equal(m.arquivos, 1);
    assert.equal(m.valorSolto.total, 1);
    assert.equal(m.stack.framework, 'next 15.5.0');
    assert.equal(m.stack.tailwindV3, true);
    assert.equal(m.stack.loja, false);
    assert.deepEqual(m.stack.shadcn, { estilo: 'new-york', registries: [] });
    assert.deepEqual(m.stack.pecas, ['button']);
  });
  it('loja (FastStore, VTEX, Wake) é reconhecida, para a skill parar (fora do escopo)', () => {
    const raiz = pasta('loja');
    escrever(raiz, 'package.json', JSON.stringify({ dependencies: { react: '18', '@faststore/core': '3' } }));
    assert.equal(medirProjeto(raiz).stack.loja, true);
  });
});

describe('base-do-projeto', () => {
  it('a base do plugin tem uma versão só nos três arquivos', () => {
    assert.match(versaoDaBase(), /^\d+\.\d+\.\d+$/);
    assert.equal(versaoDe('---\nname: x\nversao: 1.2.3\n---\ncorpo'), '1.2.3');
    assert.equal(versaoDe('sem frontmatter'), null);
  });
  it('estampar copia os três, guarda o ancestral e escreve o design/design-system.json', () => {
    const raiz = pasta('estampar');
    const r = estampar(raiz, { densidade: 'site', pasta: 'web' });
    assert.deepEqual(r.copiados, ARQUIVOS);
    const c = JSON.parse(readFileSync(join(raiz, 'design', 'design-system.json'), 'utf-8'));
    assert.equal(c.versao, versaoDaBase());
    assert.equal(c.densidade, 'site');
    assert.equal(c.pasta, 'web');
    for (const f of ARQUIVOS) {
      assert.equal(readFileSync(join(raiz, 'design', f), 'utf-8'), readFileSync(join(BASE_DO_PLUGIN, f), 'utf-8'));
      assert.equal(c.base[f], hash(readFileSync(join(raiz, 'design', '.base', f), 'utf-8')));
    }
  });
  it('estampar não sobrescreve documento que o projeto já tem, e mantém as chaves dele — no nome antigo, design/wicomm.json, gravando nele mesmo', () => {
    const raiz = pasta('estampar-existente');
    escrever(raiz, 'design/DESIGN.md', 'do projeto');
    escrever(raiz, 'design/wicomm.json', JSON.stringify({ kit: 'src/ui', densidade: 'site' }));
    const r = estampar(raiz);
    assert.deepEqual(r.mantidos, ['DESIGN.md']);
    assert.equal(readFileSync(join(raiz, 'design', '.base', 'DESIGN.md'), 'utf-8'), readFileSync(join(BASE_DO_PLUGIN, 'DESIGN.md'), 'utf-8'), 'o documento mantido ganha a base como ancestral');
    assert.equal(estado(raiz, versaoDaBase()).base[0].situacao, 'editado no projeto');
    assert.deepEqual(atualizar(raiz).conflitos, [], 'o atualizar não fica sem saída');
    assert.equal(readFileSync(join(raiz, 'design', 'DESIGN.md'), 'utf-8'), 'do projeto');
    const c = JSON.parse(readFileSync(join(raiz, 'design', 'wicomm.json'), 'utf-8'));
    assert.equal(c.kit, 'src/ui');
    assert.equal(c.densidade, 'site');
    assert.equal(existsSync(join(raiz, 'design', 'design-system.json')), false, 'o projeto que tem o nome antigo não ganha um segundo arquivo');
    assert.throws(() => estampar(raiz, { densidade: 'outra' }), /densidade/);
  });
  it('atualizar mescla a base nova com o que o projeto acrescentou e sobe a versão', () => {
    const raiz = pasta('atualizar');
    const base = pasta('base-nova');
    cpSync(BASE_DO_PLUGIN, base, { recursive: true });
    estampar(raiz, {}, base);
    // o projeto acrescenta uma nota no fim; a base nova muda a versão e a primeira regra
    const doProjeto = join(raiz, 'design', 'ANATOMIA.md');
    writeFileSync(doProjeto, readFileSync(doProjeto, 'utf-8') + '\n<!-- acréscimo do projeto -->\n');
    for (const f of ARQUIVOS) {
      const t = readFileSync(join(base, f), 'utf-8').replace(/^versao: .+$/m, 'versao: 9.9.9');
      writeFileSync(join(base, f), f === 'ANATOMIA.md' ? t.replace('### PRIN-01 · Uma tela, uma tarefa', '### PRIN-01 · Uma tela, uma tarefa só') : t);
    }
    const r = atualizar(raiz, base);
    assert.deepEqual(r.conflitos, []);
    assert.deepEqual(r.limpos.sort(), [...ARQUIVOS].sort());
    const final = readFileSync(doProjeto, 'utf-8');
    assert.match(final, /uma tarefa só/);
    assert.match(final, /acréscimo do projeto/);
    assert.equal(JSON.parse(readFileSync(join(raiz, 'design', 'design-system.json'), 'utf-8')).versao, '9.9.9');
  });
  it('atualizar com conflito grava os marcadores e não sobe a versão', () => {
    const raiz = pasta('conflito');
    const base = pasta('base-conflito');
    cpSync(BASE_DO_PLUGIN, base, { recursive: true });
    estampar(raiz, {}, base);
    const antes = JSON.parse(readFileSync(join(raiz, 'design', 'design-system.json'), 'utf-8')).versao;
    const alvo = '### PRIN-01 · Uma tela, uma tarefa';
    const doProjeto = join(raiz, 'design', 'ANATOMIA.md');
    writeFileSync(doProjeto, readFileSync(doProjeto, 'utf-8').replace(alvo, `${alvo} (projeto)`));
    for (const f of ARQUIVOS) {
      const t = readFileSync(join(base, f), 'utf-8').replace(/^versao: .+$/m, 'versao: 9.9.9');
      writeFileSync(join(base, f), f === 'ANATOMIA.md' ? t.replace(alvo, `${alvo} (base)`) : t);
    }
    const r = atualizar(raiz, base);
    assert.equal(r.conflitos.length, 1);
    assert.match(readFileSync(doProjeto, 'utf-8'), /<<<<<<< projeto/);
    assert.equal(JSON.parse(readFileSync(join(raiz, 'design', 'design-system.json'), 'utf-8')).versao, antes);
    // --resolvido recusa enquanto houver marcador
    assert.throws(() => atualizar(raiz, base, undefined, { resolvido: true }), /marcadores/);
    // a pessoa fica com o lado do projeto: tira os marcadores e o lado da base
    const resolvido = readFileSync(doProjeto, 'utf-8').replace(/<<<<<<< projeto\n([\s\S]*?)=======\n[\s\S]*?>>>>>>> base nova\n/, '$1');
    writeFileSync(doProjeto, resolvido);
    assert.match(resolvido, /\(projeto\)/);
    atualizar(raiz, base, undefined, { resolvido: true });
    assert.equal(JSON.parse(readFileSync(join(raiz, 'design', 'design-system.json'), 'utf-8')).versao, '9.9.9');
    assert.equal(JSON.parse(readFileSync(join(raiz, 'design', 'design-system.json'), 'utf-8')).atualizacaoPendente, undefined, 'a pendência fecha');
    assert.throws(() => atualizar(raiz, base, undefined, { resolvido: true }), /não há atualização pendente/);
    const depois = atualizar(raiz, base);
    assert.deepEqual(depois.conflitos, [], 'rodar de novo não conflita para sempre');
    assert.deepEqual(depois.iguais.sort(), [...ARQUIVOS].sort());
    assert.match(readFileSync(doProjeto, 'utf-8'), /\(projeto\)/, 'o lado do projeto ficou');
  });
  it('--resolvido não pula versão: sem pendência, ou com a base andando, recusa; marcador barra o atualizar normal', () => {
    const raiz = pasta('pula');
    const base = pasta('base-pula');
    cpSync(BASE_DO_PLUGIN, base, { recursive: true });
    estampar(raiz, {}, base);
    const versao = (n) => { for (const f of ARQUIVOS) writeFileSync(join(base, f), readFileSync(join(base, f), 'utf-8').replace(/^versao: .+$/m, `versao: ${n}`)); };
    versao('0.2.0');
    assert.throws(() => atualizar(raiz, base, undefined, { resolvido: true }), /não há atualização pendente/, 'caso A: --resolvido direto');
    const alvo = '### PRIN-01 · Uma tela, uma tarefa';
    const doProjeto = join(raiz, 'design', 'ANATOMIA.md');
    writeFileSync(doProjeto, readFileSync(doProjeto, 'utf-8').replace(alvo, `${alvo} (projeto)`));
    writeFileSync(join(base, 'ANATOMIA.md'), readFileSync(join(base, 'ANATOMIA.md'), 'utf-8').replace(alvo, `${alvo} (base)`));
    assert.equal(atualizar(raiz, base).conflitos.length, 1);
    assert.deepEqual(JSON.parse(readFileSync(join(raiz, 'design', 'design-system.json'), 'utf-8')).atualizacaoPendente, { para: '0.2.0', arquivos: ['ANATOMIA.md'] });
    assert.throws(() => atualizar(raiz, base), /marcadores/, 'o atualizar normal não aninha marcadores');
    versao('0.3.0');
    writeFileSync(doProjeto, readFileSync(doProjeto, 'utf-8').replace(/<<<<<<< projeto\n([\s\S]*?)=======\n[\s\S]*?>>>>>>> base nova\n/, '$1'));
    assert.throws(() => atualizar(raiz, base, undefined, { resolvido: true }), /era para 0\.2\.0/, 'caso B: a base andou');
  });
  it('erro do git merge-file (status acima de 127) não vira conflito nem grava', () => {
    const p = pasta('merge-erro');
    assert.throws(() => gitMergeFile(join(p, 'nao-existe-1'), join(p, 'nao-existe-2'), join(p, 'nao-existe-3')));
  });
  it('o script tira o ./ da pasta', () => {
    const raiz = pasta('cli-pasta');
    const r = spawnSync('node', [join(AQUI, '..', 'base-do-projeto.mjs'), 'estampar', raiz, '--pasta', './web/'], { encoding: 'utf-8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(JSON.parse(readFileSync(join(raiz, 'design', 'design-system.json'), 'utf-8')).pasta, 'web');
  });
  it('o script sai 2 com uso errado e 0 no estampar', () => {
    const script = join(AQUI, '..', 'base-do-projeto.mjs');
    assert.equal(spawnSync('node', [script, 'outro', pasta('cli')], { encoding: 'utf-8' }).status, 2);
    const r = spawnSync('node', [script, 'estampar', pasta('cli2'), '--densidade', 'instrumento'], { encoding: 'utf-8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /estampada/);
  });
});

describe('estado', () => {
  it('projeto sem design/design-system.json diz como entrar', () => {
    const e = estado(pasta('vazio'), '0.1.0');
    assert.equal(e.configurado, false);
    assert.match(estadoMd(e), /design-wicomm:novo/);
  });
  it('versão atrasada, base editada, peça editada e média das notas', () => {
    const raiz = pasta('estado');
    estampar(raiz, { densidade: 'instrumento' });
    escrever(raiz, 'design/DESIGN.md', 'editado');
    escrever(raiz, 'src/ui/botao.tsx', 'original');
    escrever(raiz, 'src/ui/campo.tsx', 'mudado no projeto');
    const c = JSON.parse(readFileSync(join(raiz, 'design', 'design-system.json'), 'utf-8'));
    c.versao = '0.0.1';
    c.pecas = { botao: { arquivo: 'src/ui/botao.tsx', hash: hash('original'), versao: '0.0.1' }, campo: { arquivo: 'src/ui/campo.tsx', hash: hash('original') }, menu: { arquivo: 'src/ui/menu.tsx', hash: 'x' } };
    writeFileSync(join(raiz, 'design', 'design-system.json'), JSON.stringify(c));
    escrever(raiz, 'docs/design/revisoes/2026-10-01-a.md', '# Crítica\nNota: 18/30\n...\nNota: 24/30\n');
    escrever(raiz, 'docs/design/revisoes/2026-10-02-b.md', 'Nota: 28/35');
    escrever(raiz, 'docs/design/revisoes/2026-10-03-c.md', 'sem nota');
    const e = estado(raiz, '0.1.0');
    assert.equal(e.atrasado, true);
    assert.deepEqual(e.base.map((b) => b.situacao), ['editado no projeto', 'igual à base', 'igual à base']);
    assert.deepEqual(Object.fromEntries(e.pecas.map((p) => [p.nome, p.situacao])), { botao: 'como instalada', campo: 'editada no projeto', menu: 'arquivo ausente' });
    assert.deepEqual(e.notas.map((n) => `${n.nota}/${n.de}`), ['24/30', '28/35'], 'a última nota de cada revisão');
    assert.equal(e.mediaPct, 80);
    assert.equal(e.acimaDoTeto, true);
    const md = estadoMd(e);
    assert.match(md, /atrasado/);
    assert.match(md, /2 com deriva/);
  });
  it('densidade por rota (app misto) aparece, e o valor inválido é apontado', () => {
    const raiz = pasta('por-rota');
    estampar(raiz, { densidade: 'instrumento' });
    const c = JSON.parse(readFileSync(join(raiz, 'design', 'design-system.json'), 'utf-8'));
    c.densidadePorRota = { '/p/*': 'site', '/qa/*': 'denso' };
    writeFileSync(join(raiz, 'design', 'design-system.json'), JSON.stringify(c));
    const e = estado(raiz, versaoDaBase());
    assert.deepEqual(e.densidadePorRota, { '/p/*': 'site', '/qa/*': 'denso' });
    assert.match(estadoMd(e), /`\/p\/\*` site, `\/qa\/\*` \*\*denso\*\* \(inválida/);
  });
  it('notas lê só .md e aceita nota em negrito', () => {
    const p = pasta('notas');
    escrever(p, 'x.md', 'Nota: **21/30**');
    escrever(p, 'y.txt', 'Nota: 30/30');
    assert.deepEqual(notas(p), [{ arquivo: 'x.md', nota: 21, de: 30 }]);
  });
});

describe('evals de disparo', async () => {
  const { SKILLS, conferir } = await import('../../evals/casos.mjs');
  const { readdirSync } = await import('node:fs');
  it('toda skill do plugin tem casos, e todo caso é de uma skill que existe', () => {
    assert.deepEqual(Object.keys(SKILLS).sort(), readdirSync(join(AQUI, '..', '..', 'skills')).sort());
  });
  it('cada skill tem ao menos 10 positivos e 10 negativos, sem pedido repetido', () => {
    for (const [skill, { sim, nao }] of Object.entries(SKILLS)) {
      assert.ok(sim.length >= 10, `${skill}: ${sim.length} positivos`);
      assert.ok(nao.length >= 10, `${skill}: ${nao.length} negativos`);
      assert.equal(new Set([...sim, ...nao]).size, sim.length + nao.length, `${skill}: pedido repetido`);
    }
  });
  it('as pastas de caso batem com a lista (node evals/casos.mjs regera)', () => {
    assert.deepEqual(conferir(), []);
  });
});
