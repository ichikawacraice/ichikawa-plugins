import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as estado from '../lib/estado.mjs';
import { html } from '../lib/pagina.mjs';
import { duracao, esteira, lerSessoesDoApp, projetoDaPasta, sessoesDaPagina, temposDasEtapas } from '../lib/sessoes.mjs';

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

test('id gravado que não bate: acha a dona aberta pelo código do item no título (ICH-F38)', () => {
  const r = sessoesDaPagina({
    itens: [
      item('F33', 'execucao', 'b82d761a-df18-4096-9c8a-362d942e037a'), // id do transcript, não do app
      item('F48', 'revisao', 'local_trocada'), // a dona foi reaberta e o item ficou com a antiga
      item('F4', 'execucao', 'local_sumiu'), // F4 não pode casar com KIT-F48
      item('F7', 'execucao', null),
    ],
    perguntas: [],
    app: app([
      s('local_33', { titulo: 'KIT-F33 · Laço do modo', rodando: true }),
      s('local_48', { titulo: 'KIT-F48 · Builder acorda' }),
      s('local_48_velha', { titulo: 'KIT-F48 · Builder acorda', arquivada: true }),
      s('local_outro', { titulo: 'KIT-F7 · De outro projeto', projeto: 'outro' }),
    ]),
    projetos: ['kit', 'outro'],
    sigla: () => 'KIT',
    agora: AGORA,
  });
  const porItem = Object.fromEntries(r.grupos.find((g) => g.projeto === 'kit').sessoes.map((x) => [x.item, x]));
  assert.deepEqual([porItem.F33.estado, porItem.F33.rodando], ['trabalhando', true]);
  assert.equal(porItem.F48.estado, 'revisando');
  assert.equal(porItem.F4.estado, 'parada');
  assert.equal(porItem.F7, undefined, 'sem sessão gravada nem achada pelo título, não é cartão');
  assert.deepEqual(r.grupos.find((g) => g.projeto === 'kit').fila.map((x) => x.item), ['F7']);
  assert.deepEqual(r.grupos.find((g) => g.projeto === 'kit').outras, [], 'a dona achada pelo título não se repete em "outras"');
});

test('item sem dona vai para a fila: não conta como trabalhando; com pergunta aberta, segue esperando você (ICH-F52)', () => {
  const r = sessoesDaPagina({
    itens: [item('F9', 'planejamento', null), item('F2', 'planejamento', undefined), item('F3', 'planejamento', null), item('F1', 'execucao', 'local_1')],
    perguntas: [{ projeto: 'kit', p: { id: 'Q1', item: 'F3', titulo: 'Qual tela?' } }],
    app: app([s('local_1', { rodando: true })]),
    projetos: ['kit'],
    agora: AGORA,
  });
  const [g] = r.grupos;
  assert.deepEqual(g.sessoes.map((x) => `${x.item}:${x.estado}`), ['F3:esperando', 'F1:trabalhando']);
  assert.deepEqual(g.fila.map((x) => [x.item, x.titulo]), [['F2', 'tF2'], ['F9', 'tF9']], 'em ordem de F');
  assert.equal(r.emAndamento, 2, 'o selo do topo não conta a fila');
  const soFila = sessoesDaPagina({ itens: [item('F5', 'planejamento', null)], perguntas: [], app: app([]), projetos: ['kit'], agora: AGORA });
  assert.deepEqual([soFila.grupos[0].sessoes.length, soFila.grupos[0].fila.length, soFila.total, soFila.emAndamento], [0, 1, 1, 0]);
});

test('dona arquivada com o PR mergeado: falta fechar, no fim; arquivada sem PR mergeado: parada; ausente: a barra procura (ICH-F52)', () => {
  const r = sessoesDaPagina({
    itens: [
      item('F1', 'execucao', 'local_1'),
      item('F2', 'pr', 'local_2', { pr: 7 }),
      item('F3', 'execucao', 'local_3'),
      item('F4', 'execucao', 'local_00000000-0000-4000-8000-000000000004'),
      item('F5', 'execucao', 'b82d761a-df18-4096-9c8a-362d942e037a'),
    ],
    perguntas: [],
    app: app([
      s('local_1', { rodando: true }),
      s('local_2', { arquivada: true, pr: 7, prEstado: 'MERGED', ultimaAtividade: ha(600) }),
      s('local_3', { arquivada: true, pr: 8, prEstado: 'OPEN', ultimaAtividade: ha(600) }),
    ]),
    projetos: ['kit'],
    agora: AGORA,
  });
  const [g] = r.grupos;
  assert.deepEqual(g.sessoes.map((x) => `${x.item}:${x.estado}`), ['F3:parada', 'F4:parada', 'F5:parada', 'F1:trabalhando', 'F2:falta-fechar']);
  const porItem = Object.fromEntries(g.sessoes.map((x) => [x.item, x]));
  assert.match(porItem.F2.motivo, /arquivada com o PR #7 mergeado/);
  assert.match(porItem.F3.motivo, /arquivada sem gravar a entrega/);
  assert.match(porItem.F4.motivo, /não está aberta/);
  assert.equal(r.emAndamento, 4, 'falta fechar não conta como em andamento');
  assert.deepEqual(r.procuradas, ['local_00000000-0000-4000-8000-000000000004'], 'só o id do app que não está no arquivo');
  const velha = sessoesDaPagina({ itens: [item('F2', 'pr', 'local_2')], perguntas: [], app: app([s('local_2', { arquivada: true, pr: 7, prEstado: 'MERGED' })], 10), projetos: ['kit'], agora: AGORA });
  assert.equal(velha.grupos[0].sessoes[0].estado, 'no-pr', 'com a leitura velha não decide');
});

test('duracao: minutos, horas e dias, sem segundos', () => {
  assert.equal(duracao(20_000), 'menos de 1 min');
  assert.equal(duracao(7 * 60_000), '7 min');
  assert.equal(duracao(65 * 60_000), '1 h 5 min');
  assert.equal(duracao(2 * 3_600_000), '2 h');
  assert.equal(duracao(26 * 3_600_000), '1 d 2 h');
});

test('temposDasEtapas soma a etapa que volta e conta a atual até agora; sem histórico, diz que não há registro (ICH-F39)', () => {
  const historico = [
    { etapa: 'planejamento', em: ha(100) }, { etapa: 'execucao', em: ha(90) }, { etapa: 'revisao', em: ha(60) },
    { etapa: 'execucao', em: ha(50) }, { etapa: 'pr', em: ha(20) },
  ];
  const t = temposDasEtapas({ historico, criadoEm: ha(100) }, AGORA);
  assert.deepEqual(t.etapas.map((e) => [e.etapa, e.ms / 60_000, e.agora]), [['planejamento', 10, false], ['execucao', 60, false], ['revisao', 10, false], ['pr', 20, true]]);
  assert.equal(t.totalMs, 100 * 60_000);
  assert.equal(t.semRegistro, false);
  const velho = temposDasEtapas({ etapa: 'execucao', criadoEm: ha(30) }, AGORA);
  assert.deepEqual([velho.semRegistro, velho.etapas.length, velho.totalMs], [true, 0, 30 * 60_000]);
});

test('a sessão leva o andamento e os tempos do item para a página', () => {
  const r = sessoesDaPagina({
    itens: [item('F1', 'execucao', 'local_1', { andamento: { feito: 'plano', falta: 'testes', em: ha(5) }, historico: [{ etapa: 'planejamento', em: ha(30) }, { etapa: 'execucao', em: ha(10) }], criadoEm: ha(30) })],
    perguntas: [], app: app([s('local_1', { rodando: true })]), projetos: ['kit'], agora: AGORA,
  });
  const [x] = r.grupos[0].sessoes;
  assert.deepEqual([x.andamento.feito, x.andamento.falta], ['plano', 'testes']);
  assert.deepEqual(x.tempos.etapas.map((e) => e.etapa), ['planejamento', 'execucao']);
});

test('leitura do app velha: não decide parada nem rodando', () => {
  const r = sessoesDaPagina({ itens: [item('F1', 'execucao', 'local_sumiu'), item('F2', 'execucao', 'local_2')], perguntas: [], app: app([s('local_2', { rodando: true })], 10), projetos: ['kit'], agora: AGORA });
  assert.equal(r.fresca, false);
  assert.deepEqual(r.grupos[0].sessoes.map((x) => [x.estado, x.rodando]), [['trabalhando', false], ['trabalhando', false]]);
});

test('o cartão da sessão abre e fecha: feito, falta e o tempo de cada etapa só aparecem ao abrir (ICH-F39)', () => {
  const agora = Date.now();
  const antes = (min) => new Date(agora - min * 60_000).toISOString();
  estado.criar('itens', 'kit', { titulo: 'Login', etapa: 'revisao', sessao: 'local_1', andamento: { feito: 'tela & testes', falta: 'PR', em: antes(2) }, historico: [{ etapa: 'planejamento', em: antes(70) }, { etapa: 'execucao', em: antes(60) }, { etapa: 'revisao', em: antes(5) }] });
  estado.criar('itens', 'kit', { titulo: 'Velho', etapa: 'execucao', sessao: 'local_2' });
  const h = html(agora);
  const sec = h.slice(h.indexOf('id="h-sessoes"'), h.indexOf('id="h-entregas"'));
  assert.match(sec, /<li class="sessao sessao-[\w-]+"><details class="sessao-detalhe" id="sessao-kit-F1"><summary>/);
  const aberto = sec.slice(sec.indexOf('id="sessao-kit-F1"'), sec.indexOf('id="sessao-kit-F2"'));
  const corpo = aberto.slice(aberto.indexOf('</summary>'));
  assert.match(corpo, /<dt>Feito<\/dt><dd>tela &amp; testes<\/dd>/);
  assert.match(corpo, /<dt>Falta<\/dt><dd>PR<\/dd>/);
  assert.match(corpo, /<li><span class="tempo-etapa">planejamento<\/span><span class="tempo-valor">10 min<\/span><\/li>/);
  assert.match(corpo, /<li><span class="tempo-etapa">execução<\/span><span class="tempo-valor">55 min<\/span><\/li>/);
  assert.match(corpo, /<li class="tempo-agora"><span class="tempo-etapa">revisão<\/span><span class="tempo-valor">5 min, até agora<\/span><\/li>/);
  assert.match(corpo, /Total: 1 h 10 min/);
  const velho = sec.slice(sec.indexOf('id="sessao-kit-F2"'));
  assert.match(velho, /Sem registro das etapas: o item é anterior ao registro\./);
  assert.match(velho, /A dona ainda não contou o que fez/);
  assert.match(h, /details\.entrega\[open\], details\.sessao-detalhe\[open\]/, 'o recarregamento reabre o cartão da sessão também');
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
  assert.match(h, /<li class="pergunta" id="pergunta-kit-Q1">/);
  assert.match(sec, /PR #3 aberto · rodando agora<\/p>/);
  assert.match(sec, /🎛 orquestradora<\/span><span class="quando">última atividade há 5 min/);
  assert.match(h, /<span class="so-leitor">1 pergunta esperando você<\/span>/);
  assert.match(h, /<span class="so-leitor">1 item em andamento<\/span>/);
});

test('sessão sem item rodando vira cartão como as ativas; no pontilhado ficam só as paradas', () => {
  const agora = Date.now();
  estado.criar('itens', 'kit', { titulo: 'Login', etapa: 'execucao', sessao: 'local_1' });
  writeFileSync(join(process.env.ICHIKAWA_HOME, 'sessoes-do-app.json'), JSON.stringify({ lidoEm: new Date(agora - 30_000).toISOString(), sessoes: [
    { sessionId: 'local_1', title: 'KIT-F1 · Login', cwd: '/p/kit', isRunning: true },
    { sessionId: 'local_doc', title: 'Documentação do kit', cwd: '/p/kit', isRunning: true, link: 'claude://claude.ai/epitaxy/local_doc' },
    { sessionId: 'local_orq', title: '🎛 orquestradora', cwd: '/p/kit', lastActivityAt: new Date(agora - 5 * 60_000).toISOString() },
  ] }));
  const h = html(agora);
  const sec = h.slice(h.indexOf('id="h-sessoes"'), h.indexOf('id="h-entregas"'));
  const pontilhado = sec.slice(sec.indexOf('class="sem-item"'));
  assert.match(sec, /<li class="sessao sessao-trabalhando sessao-sem-item"><div class="cartao-cab"><span class="marcador marcador-trabalhando girando"[^>]*><svg viewBox="0 0 16 16"[^>]*><path d="M8 2a6 6 0 1 1-6 6"[^>]*\/><\/svg><\/span><span class="cartao-titulo">Documentação do kit<\/span><span class="selo selo-sessao-trabalhando">trabalhando<\/span><\/div>/);
  assert.match(sec, /Documentação do kit[\s\S]*rodando agora<\/p>/);
  assert.doesNotMatch(pontilhado, /Documentação do kit/);
  assert.match(pontilhado, /Sessões paradas[\s\S]*🎛 orquestradora/);
});

test('a página: fila recolhida abaixo das sessões vivas, falta fechar com o motivo e o arquivo das procuradas (ICH-F52)', () => {
  const agora = Date.now();
  const casa = process.env.ICHIKAWA_HOME;
  estado.criar('itens', 'kit', { titulo: 'Login', etapa: 'execucao', sessao: 'local_1' });
  estado.criar('itens', 'kit', { titulo: 'Backlog <1>', etapa: 'planejamento' });
  estado.criar('itens', 'kit', { titulo: 'Entregou', etapa: 'pr', sessao: 'local_3' });
  estado.criar('itens', 'kit', { titulo: 'Sumida', etapa: 'execucao', sessao: 'local_00000000-0000-4000-8000-000000000004' });
  writeFileSync(join(casa, 'sessoes-do-app.json'), JSON.stringify({ lidoEm: new Date(agora - 30_000).toISOString(), sessoes: [
    { sessionId: 'local_1', title: 'KIT-F1 · Login', cwd: '/p/kit', isRunning: true },
    { sessionId: 'local_3', title: 'KIT-F3 · Entregou', cwd: '/p/kit', isArchived: true, prNumber: 12, prState: 'MERGED' },
  ] }));
  const h = html(agora);
  const sec = h.slice(h.indexOf('id="h-sessoes"'), h.indexOf('id="h-entregas"'));
  assert.match(sec, /selo-sessao-falta-fechar">falta fechar</);
  assert.match(sec, /A dona foi arquivada com o PR #12 mergeado, sem gravar a entrega/);
  const fila = sec.slice(sec.indexOf('class="sem-item fila"'));
  assert.ok(sec.indexOf('class="sem-item fila"') > sec.lastIndexOf('class="sessao '), 'a fila fica abaixo dos cartões');
  assert.match(fila, /^class="sem-item fila"><details class="fila-detalhe" id="fila-kit"><summary>Na fila · sem dona \(1\)<\/summary>/);
  assert.match(fila, /KIT-F2<\/span><span class="titulo-sem-item">Backlog &lt;1&gt;/);
  assert.doesNotMatch(sec.slice(0, sec.indexOf('class="sem-item fila"')), /Backlog/);
  assert.match(h, /<span class="so-leitor">2 itens em andamento<\/span>/, 'Login e Sumida; nem a fila nem o falta fechar');
  const procuradas = JSON.parse(readFileSync(join(casa, 'sessoes-procuradas.json'), 'utf8'));
  assert.deepEqual(procuradas.sessoes, ['local_00000000-0000-4000-8000-000000000004']);
  assert.match(h, /details\.fila-detalhe\[open\]/, 'o recarregamento reabre a fila também');
  const antes = statSync(join(casa, 'sessoes-procuradas.json')).mtimeMs;
  html(agora + 1000);
  assert.equal(statSync(join(casa, 'sessoes-procuradas.json')).mtimeMs, antes, 'sem mudança na lista, não regrava');
});
