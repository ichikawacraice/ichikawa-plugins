// As correções da medida que o piloto WiControl revelou (F271 → F275), uma por teste, sobre um fixture que reproduz
// cada caso em miniatura (`fixtures/wicontrol/frontend`). O número entre parênteses no nome é o da lista em
// `docs/pilotos/wicontrol/correcoes-do-plugin.md`. Rodar: npm test na raiz do repositório.
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, realpathSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { achados } from '../../hooks/valor-solto.mjs';
import { medir, medirProjeto, stack } from '../medir-deriva.mjs';

const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'wicontrol');
const m = medirProjeto(FIXTURE, 'frontend');
const cat = (lista) => Object.fromEntries(lista.map(([k, n]) => [k, n]));
const temporarias = [];
after(() => { for (const d of temporarias) rmSync(d, { recursive: true, force: true }); });
const copia = () => { const d = realpathSync(mkdtempSync(join(tmpdir(), 'wicomm-wicontrol-'))); temporarias.push(d); cpSync(FIXTURE, d, { recursive: true }); return d; };

describe('a medida do piloto WiControl, correção por correção', () => {
  it('(1) rgba dentro de valor arbitrário é cor literal, no script e no aviso', () => {
    assert.ok(achados('<div className="shadow-[0_10px_30px_rgba(15,23,42,0.06)]" />').some((a) => a.regra === 'CONV-04'));
    const r = medir([{ caminho: 'a.tsx', texto: '<i className="shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]" />' }]);
    assert.equal(cat(r.valorSolto.porCategoria)['cor literal (CONV-04)'], 1);
  });

  it('(2) a paleta Tailwind usada direto é medida (COR-05), e o idioma de cor fica à parte', () => {
    assert.equal(m.paleta.total, 5, 'text-zinc-700, bg-emerald-500/10, bg-rose-500/12 e os dois do colors.ts');
    assert.deepEqual(cat(m.paleta.porFamilia), { emerald: 3, rose: 1, zinc: 1 });
    assert.ok(achados('<p className="hover:text-zinc-700" />').some((a) => a.regra === 'COR-05'), 'o aviso na escrita também');
    assert.deepEqual(achados('<p className="text-zinc-700" />', { noIdioma: true }), [], 'no idioma de cor, calado');
    const comIdioma = medirProjeto(FIXTURE, 'frontend', { idioma: 'frontend/src/lib/colors.ts' });
    assert.equal(comIdioma.paleta.total, 3);
    assert.equal(comIdioma.paleta.noIdioma, 2);
    // O idioma do design/wicomm.json é relativo à raiz, como na guarda e no aviso na escrita.
    const d = copia();
    mkdirSync(join(d, 'design'));
    writeFileSync(join(d, 'design/wicomm.json'), JSON.stringify({ guardas: { regras: { 'o-carimbo-tem-forma': { idioma: 'frontend/src/lib/colors.ts' } } } }));
    assert.equal(medirProjeto(d, 'frontend').paleta.noIdioma, 2);
  });

  it('(3) o .ts que monta classe entra na medida; o .ts de lógica, não', () => {
    assert.deepEqual(m.lidos.logicaComClasse, ['frontend/src/lib/colors.ts']);
    assert.ok(m.valorSolto.piores.some(([c]) => c === 'frontend/src/lib/colors.ts'), 'os hex do idioma de cor contam');
    assert.ok(!m.valorSolto.piores.some(([c]) => c.endsWith('integracao.ts')));
  });

  it('(4) cor com alfa que não gera CSS no v3: cor de tema sem <alpha-value> e opacidade fora da escala', () => {
    assert.deepEqual(cat(m.alfaSemCss.porClasse), { 'cor de tema sem <alpha-value>: bg-primary/10': 1, 'opacidade fora da escala v3: /12': 1 });
    assert.equal(medir([{ caminho: 'a.tsx', texto: 'bg-primary/10' }], { tailwind: 4, semAlfa: ['primary'] }).alfaSemCss, null, 'no v4 a cor com alfa gera CSS');
  });

  it('(5) MOV-02 por ocorrência, com transition-colors isento e o escape na mesma string', () => {
    const a = m.animacaoSemEscape;
    assert.equal(a.ocorrencias, 4, 'transition-all (ui), transition-opacity, animate-in com variante sem !, animate-pulse');
    assert.deepEqual(a.arquivos.map(([c]) => c).sort(), ['frontend/src/components/ui/button.tsx', 'frontend/src/pages/Dashboard.tsx', 'frontend/src/pages/Detalhe.tsx']);
    assert.ok(!a.arquivos.some(([c]) => c.endsWith('label.tsx')), 'só transition-colors');
    assert.ok(a.arquivos.some(([c]) => c.endsWith('Detalhe.tsx')), 'o escape em outra string não absolve');
  });

  it('(8) arbitrário composto: sombra, grid e min() contam; data-[…] e var(--…) não', () => {
    assert.equal(cat(m.valorSolto.porCategoria)['arbitrário composto (PRIN-06)'], 3);
    const r = medir([{ caminho: 'a.tsx', texto: '<i className="data-[state=open]:bg-muted bg-[var(--x)] aria-[current]:font-bold" />' }]);
    assert.equal(r.valorSolto.total, 0);
    assert.equal(m.valorSolto.total, 8, 'a cor dentro da sombra conta uma vez no total');
  });

  it('(9) CSS que ninguém importa fica fora, numa lista à parte', () => {
    assert.deepEqual(m.lidos.cssSemImport, ['frontend/src/App.css']);
    assert.ok(!m.valorSolto.piores.some(([c]) => c.endsWith('App.css')));
  });
  it('(9) a folha citada por alias, com sufixo ou por @import sem ./ continua medida', () => {
    for (const citacao of ["import '@/app/globals.css'", "import href from './globals.css?url'"]) {
      const d = copia();
      writeFileSync(join(d, 'frontend/src/globals.css'), ':root { --primary: #ff012e; }\n.x { color: #000; }\n');
      writeFileSync(join(d, 'frontend/src/main.tsx'), `${citacao}\nimport './index.css'\n`);
      const r = medirProjeto(d, 'frontend');
      assert.ok(!r.lidos.cssSemImport.includes('frontend/src/globals.css'), citacao);
    }
    const d = copia();
    writeFileSync(join(d, 'frontend/src/tema.css'), ':root { --x: #fff; }\n');
    writeFileSync(join(d, 'frontend/src/index.css'), '@import "tema.css";\n');
    assert.ok(!medirProjeto(d, 'frontend').lidos.cssSemImport.includes('frontend/src/tema.css'));
  });

  it('(10) os tokens do projeto contra os da Wicomm, os sem uso e o transparent', () => {
    const t = m.tokens;
    assert.ok(t.diferencas.some((d) => d.nome === '--primary' && d.projeto === '#FF012E' && d.wicomm === '#F30B42'));
    assert.ok(t.semUso.includes('--chart-1') && t.semUso.includes('--mention-color'));
    assert.ok(!t.semUso.includes('--radius'), 'usada pelo tailwind.config');
    assert.deepEqual(t.transparentes, ['--input']);
  });

  it('(11) o tema escuro declarado e não alcançável', () => {
    assert.equal(m.tokens.temaEscuro, 'declarado');
    const d = copia();
    writeFileSync(join(d, 'frontend/src/tema.ts'), "export const ligar = () => document.documentElement.classList.toggle('dark', true)\nexport const c = 'bg-muted'\n");
    assert.equal(medirProjeto(d, 'frontend').tokens.temaEscuro, 'alcançável');
  });

  it('(12) altura de controle separada de ícone, com variante de tela e a declaração da variante fora da conta', () => {
    assert.deepEqual(cat(m.alturas.controle), { 'h-10': 1 }, 'o md:h-10 do <Button>');
    assert.deepEqual(cat(m.alturas.quadrado), { 'h-5': 1 }, 'o ícone h-5 w-5');
    assert.deepEqual(m.alturas.outra, [], 'as alturas do cva saem: são declaração, não uso');
    assert.deepEqual(m.alturas.variantes.Button, { default: { px: 40, usos: 1 }, sm: { px: 36, usos: 1 }, icon: { px: 40, usos: 0 } });
  });

  it('(13) o tamanho de cada ícone do lucide, e os fora de 14/16/18', () => {
    assert.equal(m.iconesLucide.distintos, 3);
    assert.deepEqual(cat(m.iconesLucide.tamanhos), { 16: 1, 20: 1, '24 (padrão)': 1 });
    assert.equal(m.iconesLucide.foraDaEscala, 2);
  });

  it('(14) o raio em px resolvido pelo config e pelo --radius, e o raio por lado', () => {
    assert.deepEqual(m.raios, [['rounded-lg', 1, 10], ['rounded-t-2xl', 1, 16]]);
  });

  it('(15) o tailwind.config entra no relatório: fonte, cores sem alfa, movimento solto', () => {
    const c = m.configTailwind;
    assert.deepEqual(Object.keys(c.fontes), ['archivo']);
    assert.deepEqual(c.coresSemAlfa, ['background', 'primary', 'primary-foreground', 'ring']);
    assert.deepEqual(c.movimento.map((x) => `${x.tipo} ${x.valor}`), ['duração 0.2s', 'curva ease-out']);
  });

  it('(16) a versão do Tailwind sai do pacote; o config sozinho é aviso', () => {
    assert.equal(m.stack.tailwindV3, true);
    const d = copia();
    writeFileSync(join(d, 'frontend/package.json'), JSON.stringify({ dependencies: { react: '19' }, devDependencies: { tailwindcss: '^4.1.0', '@tailwindcss/vite': '^4.1.0' } }));
    const s = stack(join(d, 'frontend'));
    assert.equal(s.tailwindV3, false);
    assert.match(s.avisos.join(), /@config/);
  });

  it('(17) a pasta ui e as telas vêm separadas em cada categoria', () => {
    const [, total, lados] = m.animacaoSemEscape.porTipo.find(([k]) => k === 'transition-all');
    assert.deepEqual([total, lados], [1, { ui: 1, tela: 0 }]);
    assert.equal(m.valorSolto.ui + m.valorSolto.tela, m.valorSolto.total);
  });

  it('(18) cada peça da pasta ui com os usos fora dela', () => {
    assert.deepEqual(m.pecasComUso, [['button', 2], ['label', 0]]);
  });

  it('(19) a densidade por rota do design/wicomm.json chega ao relatório', () => {
    const d = copia();
    mkdirSync(join(d, 'design'));
    writeFileSync(join(d, 'design/wicomm.json'), JSON.stringify({ densidade: 'instrumento', densidadePorRota: { '/p/*': 'site' } }));
    assert.deepEqual(medirProjeto(d, 'frontend').wicomm.densidadePorRota, { '/p/*': 'site' });
  });

  it('(20) os piores arquivos mostram o valor que mais se repete', () => {
    const [caminho, n, rep] = m.valorSolto.piores[0];
    assert.equal(caminho, 'frontend/src/pages/Dashboard.tsx');
    assert.equal(n, 6);
    assert.deepEqual(rep, [['min-w-[100px]', 3]]);
  });
});
