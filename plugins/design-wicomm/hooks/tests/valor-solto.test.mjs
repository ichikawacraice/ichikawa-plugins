// O aviso de valor solto na escrita (CONV-04, PRIN-06, MOV-01, CTRL-09). Rodar: npm test na raiz do repositório.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { achados, decidir, textoNovo } from '../valor-solto.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'valor-solto.mjs');
const valores = (t) => achados(t).map((a) => a.valor).sort();

describe('achados — morde e não morde (CONV-16)', () => {
  it('pega cor literal, valor arbitrário, duração e curva soltas, e ícone de fora', () => {
    const t = [
      '<div className="bg-[#F30B42] text-[15px] h-[34px] md:w-[120px] z-[60] -mt-[3px]" />',
      '<p style={{ color: "#fff", background: "rgba(0, 0, 0, .4)" }} className="duration-200 ease-in-out" />',
      "import { FaBeer } from 'react-icons/fa';",
      "import { Check } from '@radix-ui/react-icons';",
    ].join('\n');
    assert.deepEqual(valores(t), ['#F30B42', '#fff', '-mt-[3px]', '@radix-ui/react-icons', 'duration-200', 'ease-in-out', 'h-[34px]', 'md:w-[120px]', 'react-icons/fa', 'rgba(0', 'text-[15px]', 'z-[60]'].sort());
  });
  it('não pega token, var, lucide-react, âncora que não é hex, nem a declaração do token', () => {
    const t = [
      '<div className="bg-primary text-sm h-9 duration-modal-abre ease-abre bg-[var(--marca)] grid-cols-[1fr_2fr]" />',
      "import { Check } from 'lucide-react';",
      '<a href="#topo">voltar</a>',
      '  --marca: #F30B42;',
      '  --sombra: 0 1px 2px rgba(0, 0, 0, .1);',
      'const id = "item#12";',
    ].join('\n');
    assert.deepEqual(valores(t), []);
  });
  it('o mesmo valor repetido vira um achado só', () => {
    assert.equal(achados('h-[34px] h-[34px]\nh-[34px]').length, 1);
  });
  it('textoNovo lê Write, Edit e MultiEdit', () => {
    assert.equal(textoNovo({ content: 'a' }), 'a');
    assert.equal(textoNovo({ old_string: 'x', new_string: 'b' }), 'b');
    assert.equal(textoNovo({ edits: [{ new_string: 'c' }, { new_string: 'd' }] }), 'c\nd');
    assert.equal(textoNovo(null), '');
  });
});

describe('decidir — só arquivo de tela, só aviso', () => {
  const CONFIG = { visual: ['web/src/**/*.tsx', 'web/src/**/*.css', '!web/src/**/*.test.tsx'] };
  const ctx = (projeto = {}) => ({ raiz: () => '/r', config: () => CONFIG, projeto: () => projeto });
  const ev = (file_path, content) => ({ hook_event_name: 'PreToolUse', tool_name: 'Write', cwd: '/r', tool_input: { file_path, content } });

  it('tela com valor solto: aviso em additionalContext, sem decisão de permissão', () => {
    const d = decidir(ev('/r/web/src/Tela.tsx', '<div className="h-[34px]" />'), ctx());
    assert.equal(d.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.match(d.hookSpecificOutput.additionalContext, /h-\[34px\].*PRIN-06/);
    assert.equal(d.hookSpecificOutput.permissionDecision, undefined, 'avisa, não nega nem libera');
    assert.equal(d.decision, undefined);
  });
  it('tela limpa, doc, teste de tela e arquivo fora do front: calado', () => {
    assert.equal(decidir(ev('/r/web/src/Tela.tsx', '<div className="h-9" />'), ctx()), null);
    assert.equal(decidir(ev('/r/docs/x.md', 'h-[34px]'), ctx()), null);
    assert.equal(decidir(ev('/r/web/src/Tela.test.tsx', 'h-[34px]'), ctx()), null);
    assert.equal(decidir(ev('/r/scripts/x.tsx', 'h-[34px]'), ctx()), null);
  });
  it('valorSolto: false desliga; valorSolto.ignorar lista a exceção local', () => {
    assert.equal(decidir(ev('/r/web/src/Tela.tsx', 'h-[34px]'), ctx({ valorSolto: false })), null);
    assert.equal(decidir(ev('/r/web/src/grafico/Eixo.tsx', 'h-[34px]'), ctx({ valorSolto: { ignorar: ['web/src/grafico/**'] } })), null);
    assert.notEqual(decidir(ev('/r/web/src/Tela.tsx', 'h-[34px]'), ctx({ valorSolto: { ignorar: ['web/src/grafico/**'] } })), null);
  });
  it('sem configuração (projeto sem front) ou fora de repositório: calado', () => {
    assert.equal(decidir(ev('/r/web/src/Tela.tsx', 'h-[34px]'), { ...ctx(), config: () => null }), null);
    assert.equal(decidir(ev('/r/web/src/Tela.tsx', 'h-[34px]'), { ...ctx(), raiz: () => null }), null);
  });
  it('paleta direto (COR-05) avisa fora do idioma de cor e cala dentro dele', () => {
    const projeto = { guardas: { regras: { 'o-carimbo-tem-forma': { idioma: './web/src/lib/idioma-de-cor.ts' } } } };
    const CONFIG_TS = { visual: ['web/src/**/*.ts', 'web/src/**/*.tsx'] };
    const c = { raiz: () => '/r', config: () => CONFIG_TS, projeto: () => projeto };
    assert.match(decidir(ev('/r/web/src/Tela.tsx', '<p className="text-zinc-700" />'), c).hookSpecificOutput.additionalContext, /text-zinc-700.*COR-05/);
    assert.equal(decidir(ev('/r/web/src/lib/idioma-de-cor.ts', "export const OK = 'text-emerald-700'"), c), null);
    assert.match(decidir(ev('/r/web/src/lib/idioma-de-cor.ts', "export const X = 'text-[#000]'"), c).hookSpecificOutput.additionalContext, /#000/, 'no idioma, o resto continua avisando');
  });
  it('mais de 8 achados: mostra 8 e conta o resto', () => {
    const muitos = Array.from({ length: 11 }, (_, i) => `h-[${i + 10}px]`).join(' ');
    assert.match(decidir(ev('/r/web/src/Tela.tsx', muitos), ctx()).hookSpecificOutput.additionalContext, /e mais 3/);
  });
});

describe('o script de ponta a ponta, num projeto com design/wicomm.json', () => {
  const proj = realpathSync(mkdtempSync(join(tmpdir(), 'wicomm-valor-solto-')));
  const casa = realpathSync(mkdtempSync(join(tmpdir(), 'wicomm-valor-solto-casa-')));
  after(() => { for (const d of [proj, casa]) rmSync(d, { recursive: true, force: true }); });
  execFileSync('git', ['-C', proj, 'init', '-q']);
  mkdirSync(join(proj, 'design'), { recursive: true });
  writeFileSync(join(proj, 'design', 'wicomm.json'), JSON.stringify({ pasta: 'web' }));
  const rodar = (evento) => spawnSync('node', [SCRIPT], { input: typeof evento === 'string' ? evento : JSON.stringify({ cwd: proj, ...evento }), encoding: 'utf-8', timeout: 15_000, killSignal: 'SIGKILL', env: { ...process.env, HOME: casa } });

  it('avisa no Write de tela com cor literal', () => {
    const r = rodar({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(proj, 'web', 'src', 'A.tsx'), content: '<b className="text-[#000]" />' } });
    assert.equal(r.status, 0, r.stderr);
    assert.match(JSON.parse(r.stdout).hookSpecificOutput.additionalContext, /#000/);
  });
  it('evento ilegível e config quebrada saem 0 sem decisão', () => {
    const r = rodar('{ não é json');
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    writeFileSync(join(proj, 'design', 'wicomm.json'), '{ quebrado');
    const q = rodar({ hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: { file_path: join(proj, 'web', 'A.tsx'), content: 'h-[3px]' } });
    assert.equal(q.status, 0);
    assert.equal(q.stdout, '');
    assert.match(q.stderr, /ilegível/);
  });
});
