import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as estado from '../lib/estado.mjs';
import { html } from '../lib/pagina.mjs';
import { esteira, lerSessoesDoApp, projetoDaPasta, sessoesDaPagina } from '../lib/sessoes.mjs';

const AGORA = Date.UTC(2026, 10, 13, 18, 0);
const ha = (min) => new Date(AGORA - min * 60_000).toISOString();
const app = (sessoes, lidoMin = 1) => ({ lidoEm: AGORA - lidoMin * 60_000, sessoes, erro: null });
const s = (id, extra = {}) => ({ sessionId: id, titulo: id, projeto: 'kit', arquivada: false, rodando: false, pr: null, prEstado: null, ultimaAtividade: ha(2), link: null, ...extra });
const item = (id, etapa, sessao, extra = {}) => ({ projeto: 'kit', i: { id, titulo: `t${id}`, etapa, sessao, pr: null, ...extra } });

beforeEach(() => { process.env.ICHIKAWA_HOME = mkdtempSync(join(tmpdir(), 'ichikawa-')); });

test('projetoDaPasta: worktree conta como o repositório', () => {
  assert.equal(projetoDaPasta('/p/ichikawa-plugins/.claude/worktrees/x-1'), 'ichikawa-plugins');
  assert.equal(projetoDaPasta('/p/Izanagi/'), 'Izanagi');
  assert.equal(projetoDaPasta(''), null);
});

test('lerSessoesDoApp: sem arquivo, ilegível e bom; não confia no conteúdo', () => {
  const raiz = process.env.ICHIKAWA_HOME;
  assert.equal(lerSessoesDoApp(raiz).erro, 'sem-arquivo');
  writeFileSync(join(raiz, 'sessoes-do-app.json'), '{');
  assert.equal(lerSessoesDoApp(raiz).erro, 'ilegivel');
  writeFileSync(join(raiz, 'sessoes-do-app.json'), JSON.stringify({ lidoEm: ha(1), sessoes: [
    { sessionId: 'local_a', title: 'A', cwd: '/p/kit/.claude/worktrees/w', isRunning: true, prNumber: 4, prState: 'OPEN', link: 'javascript:alert(1)' },
    { title: 'sem id' },
  ] }));
  const lido = lerSessoesDoApp(raiz);
  assert.equal(lido.erro, null);
  assert.equal(lido.sessoes.length, 1);
  assert.deepEqual({ ...lido.sessoes[0] }, { sessionId: 'local_a', titulo: 'A', projeto: 'kit', arquivada: false, rodando: true, pr: 4, prEstado: 'OPEN', ultimaAtividade: null, link: null });
});

test('esteira: planejamento → execução → revisão → PR → entregue, pela etapa', () => {
  assert.deepEqual(esteira('revisao').map((e) => e.estado), ['feito', 'feito', 'agora', 'falta', 'falta']);
  assert.deepEqual(esteira('pr').map((e) => e.nome), ['planejamento', 'execução', 'revisão', 'PR', 'entregue']);
  assert.equal(esteira(undefined)[0].estado, 'agora');
});

test('estado por urgência: esperando › parada › no PR › em revisão › trabalhando; PR e rodando vêm do app', () => {
  const r = sessoesDaPagina({
    itens: [
      item('F1', 'execucao', 'local_1'),
      item('F2', 'pr', 'local_2', { pr: 9 }),
      item('F3', 'execucao', 'local_3'),
      item('F4', 'revisao', 'local_4'),
      item('F5', 'execucao', 'local_sumiu'),
      item('F6', 'execucao', 'local_6'),
    ],
    perguntas: [{ projeto: 'kit', p: { id: 'Q1', item: 'F3', titulo: 'Apagar?' } }, { projeto: 'outro', p: { id: 'Q2', item: 'F1' } }],
    app: app([
      s('local_1', { rodando: true }), s('local_2', { pr: 9, prEstado: 'MERGED' }), s('local_3'), s('local_4'),
      s('local_6', { ultimaAtividade: ha(45) }), s('local_orq', { titulo: 'orquestradora' }), s('local_fora', { projeto: 'desconhecido' }),
    ]),
    projetos: ['kit'],
    agora: AGORA,
  });
  const [g] = r.grupos;
  assert.deepEqual(g.sessoes.map((x) => `${x.item}:${x.estado}`), ['F3:esperando', 'F5:parada', 'F6:parada', 'F2:no-pr', 'F4:revisando', 'F1:trabalhando']);
  const porItem = Object.fromEntries(g.sessoes.map((x) => [x.item, x]));
  assert.deepEqual(porItem.F3.perguntas, [{ id: 'Q1', titulo: 'Apagar?' }], 'a pergunta de outro projeto não conta');
  assert.match(porItem.F5.motivo, /não está aberta/);
  assert.match(porItem.F6.motivo, /Sem movimento/);
  assert.deepEqual([porItem.F2.pr, porItem.F2.prEstado], [9, 'MERGED']);
  assert.equal(porItem.F1.rodando, true);
  assert.deepEqual(g.outras.map((o) => o.titulo), ['orquestradora'], 'sem item só do projeto conhecido');
  assert.equal(r.total, 7);
});

test('leitura do app velha: não decide parada nem rodando', () => {
  const r = sessoesDaPagina({ itens: [item('F1', 'execucao', 'local_sumiu'), item('F2', 'execucao', 'local_2')], perguntas: [], app: app([s('local_2', { rodando: true })], 10), projetos: ['kit'], agora: AGORA });
  assert.equal(r.fresca, false);
  assert.deepEqual(r.grupos[0].sessoes.map((x) => [x.estado, x.rodando]), [['trabalhando', false], ['trabalhando', false]]);
});

test('a página mostra as sessões: marcador, esteira, pergunta com âncora, PR e o link do app; avisa sem status do app', () => {
  const agora = Date.now();
  estado.criar('itens', 'kit', { titulo: 'Login', etapa: 'execucao', sessao: 'local_1' });
  estado.criar('perguntas', 'kit', { titulo: 'Apagar?', estado: 'aberta', item: 'F1' });
  assert.match(html(agora), /sem o status do app/);
  writeFileSync(join(process.env.ICHIKAWA_HOME, 'sessoes-do-app.json'), JSON.stringify({ lidoEm: new Date(agora - 30_000).toISOString(), sessoes: [
    { sessionId: 'local_1', title: 'KIT-F1 · Login', cwd: '/p/kit/.claude/worktrees/w', isRunning: true, prNumber: 3, prState: 'OPEN', link: 'claude://claude.ai/epitaxy/local_1' },
    { sessionId: 'local_orq', title: '🎛 orquestradora', cwd: '/p/kit', lastActivityAt: new Date(agora - 5 * 60_000).toISOString() },
  ] }));
  const h = html(agora);
  const sec = h.slice(h.indexOf('id="h-sessoes"'), h.indexOf('id="h-entregas"'));
  assert.match(sec, /status do app há 30 s/);
  assert.match(sec, /marcador marcador-esperando girando/);
  assert.match(sec, /selo-sessao-esperando">esperando você/);
  assert.match(sec, /<li class="passo passo-agora" aria-current="step"><span class="so-leitor">agora: <\/span>execução<\/li>/);
  assert.match(sec, /href="#pergunta-kit-Q1">KIT-Q1<\/a>/);
  assert.match(h, /<li id="pergunta-kit-Q1">/);
  assert.match(sec, /PR #3 aberto · rodando agora · <a class="abrir-app" href="claude:\/\/claude.ai\/epitaxy\/local_1">Abrir no app<\/a>/);
  assert.match(sec, /🎛 orquestradora<\/span><span class="quando">última atividade há 5 min/);
  assert.match(h, /<span class="so-leitor">1 pergunta esperando você<\/span>/);
  assert.match(h, /<span class="so-leitor">1 item em andamento<\/span>/);
});
