import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import * as estado from '../lib/estado.mjs';
import { main } from '../lib/cli.mjs';
import { html, servir } from '../lib/pagina.mjs';
import { decidir as orquestradoraNaoEdita } from '../hooks/orquestradora-nao-edita.mjs';
import { decidir as configProtegida } from '../hooks/config-protegida.mjs';
import { decidir as segredoSai } from '../hooks/segredo-sai.mjs';
import { contexto } from '../hooks/inicio.mjs';

const SESSAO_DO_APP = 'local_12345678-1234-1234-1234-123456789abc';
let saida;
const rodar = (...args) => { saida = []; return main(args, (s) => saida.push(s)); };

beforeEach(() => { process.env.ICHIKAWA_HOME = mkdtempSync(join(tmpdir(), 'ichikawa-')); });

test('criar numera em sequência por projeto e listar devolve do mais novo ao mais velho', () => {
  estado.criar('perguntas', 'p', { titulo: 'a' });
  estado.criar('perguntas', 'p', { titulo: 'b' });
  estado.criar('perguntas', 'outro', { titulo: 'c' });
  assert.deepEqual(estado.listar('perguntas', 'p').map((q) => q.id), ['Q2', 'Q1']);
  assert.equal(estado.listar('perguntas', 'outro')[0].id, 'Q1');
});

test('criar pula o número que outra sessão já pegou', () => {
  const pasta = estado.pastaDe('itens', 'p');
  mkdirSync(pasta, { recursive: true });
  writeFileSync(join(pasta, 'F1.json'), '{"id":"F1"}');
  assert.equal(estado.criar('itens', 'p', { titulo: 'x' }).id, 'F2');
});

test('atualizar junta os campos, mantém o id e não deixa arquivo temporário', () => {
  estado.criar('itens', 'p', { titulo: 'x', etapa: 'planejamento' });
  const novo = estado.atualizar('itens', 'p', 'f1', { etapa: 'execucao', id: 'F9' });
  assert.equal(novo.id, 'F1');
  assert.equal(novo.etapa, 'execucao');
  assert.deepEqual(readdirSync(estado.pastaDe('itens', 'p')), ['F1.json']);
  assert.equal(estado.atualizar('itens', 'p', 'F5', {}), null);
});

test('pergunta nova exige caso, consequência e recomendação', async () => {
  await assert.rejects(rodar('nova', '--projeto', 'p', '--titulo', 'T'), /--caso, --se-nao, --recomendacao/);
});

test('pergunta herda a sessão do item quando não diz a sua', async () => {
  await rodar('item', 'nova', 'Login', '--projeto', 'p', '--sessao', SESSAO_DO_APP);
  await rodar('nova', '--projeto', 'p', '--titulo', 'T', '--caso', 'c', '--se-nao', 's', '--recomendacao', 'r', '--item', 'F1');
  assert.equal(estado.ler('perguntas', 'p', 'Q1').sessao, SESSAO_DO_APP);
});

test('entregar grava a entrega e leva a etapa a feito ou parado', async () => {
  await rodar('item', 'nova', 'A', '--projeto', 'p');
  await rodar('item', 'nova', 'B', '--projeto', 'p');
  await rodar('item', 'entregar', 'F1', '--projeto', 'p', '--desfecho', 'parcial', '--resultado', 'metade', '--proximo', 'resto', '--pr', '7');
  await rodar('item', 'entregar', 'F2', '--projeto', 'p', '--desfecho', 'parado', '--resultado', 'sem acesso');
  const [b, a] = estado.listar('itens', 'p');
  assert.equal(a.etapa, 'feito');
  assert.equal(a.pr, 7);
  assert.deepEqual(a.entrega.proximos, ['resto']);
  assert.equal(b.etapa, 'parado');
  await assert.rejects(rodar('item', 'entregar', 'F1', '--projeto', 'p', '--desfecho', 'talvez', '--resultado', 'x'), /desfecho/);
});

test('novidades lista só as respostas da página e as marca lidas', async () => {
  estado.criar('perguntas', 'p', { titulo: 'T', estado: 'respondida', resposta: 'sim', lida: false });
  await rodar('novidades', '--projeto', 'p');
  assert.match(saida[0], /Q1 · T → sim/);
  await rodar('novidades', '--projeto', 'p');
  assert.equal(saida[0], 'nenhuma resposta nova');
});

test('papel grava e remove o marcador; a trava só vale para a orquestradora fora da ~/.claude', async () => {
  const entrada = { session_id: 'sessao-teste-1', tool_input: { file_path: '/repo/src/app.ts' } };
  assert.equal(orquestradoraNaoEdita(entrada), null);
  await rodar('papel', 'orquestradora', '--sessao-id', 'sessao-teste-1');
  assert.match(orquestradoraNaoEdita(entrada), /Orquestradora editando/);
  assert.equal(orquestradoraNaoEdita({ ...entrada, tool_input: { file_path: join(homedir(), '.claude', 'x.md') } }), null);
  await rodar('papel', 'nenhum', '--sessao-id', 'sessao-teste-1');
  assert.equal(orquestradoraNaoEdita(entrada), null);
  await assert.rejects(rodar('papel', 'orquestradora', '--sessao-id', '../../x'), /uso/);
});

test('config protegida pergunta só quando a configuração já existe', () => {
  const pasta = mkdtempSync(join(tmpdir(), 'repo-'));
  writeFileSync(join(pasta, 'eslint.config.mjs'), 'export default []');
  assert.match(configProtegida({ tool_input: { file_path: join(pasta, 'eslint.config.mjs') } }), /eslint\.config\.mjs/);
  assert.equal(configProtegida({ tool_input: { file_path: join(pasta, '.prettierrc') } }), null);
  assert.equal(configProtegida({ tool_input: { file_path: join(pasta, 'index.ts') } }), null);
});

test('segredo que sai para outra sessão é recusado pelo nome do padrão, sem o valor', () => {
  const token = `ghp_${'a1'.repeat(18)}`;
  const motivo = segredoSai({ tool_name: 'mcp__ccd_session__start_session', tool_input: { brief: { contexto: `use ${token}` } } });
  assert.match(motivo, /github-token/);
  assert.ok(!motivo.includes(token));
  assert.equal(segredoSai({ tool_name: 'SendMessage', tool_input: { message: 'use a variável GITHUB_TOKEN' } }), null);
  assert.equal(segredoSai({ tool_name: 'Bash', tool_input: { command: token } }), null);
});

test('o início traz as regras, o ausente e o id da sessão', () => {
  writeFileSync(join(process.env.ICHIKAWA_HOME, 'ausente.json'), '{"ligado":true,"desde":"agora"}');
  const ctx = contexto({ session_id: 'sessao-teste-2', cwd: tmpdir() });
  assert.match(ctx, /Regras do kit/);
  assert.match(ctx, /AUSENTE/);
  assert.match(ctx, /sessao-teste-2/);
});

test('a página escapa o texto e separa perguntas, andamento e entregas', () => {
  estado.criar('perguntas', 'p', { titulo: '<script>x</script>', estado: 'aberta', sessao: SESSAO_DO_APP, item: 'F1' });
  estado.criar('itens', 'p', { titulo: 'vivo', etapa: 'execucao' });
  estado.criar('itens', 'p', { titulo: 'feito', etapa: 'feito', entrega: { desfecho: 'entregue', resultado: 'ok', em: new Date().toISOString() } });
  const h = html();
  assert.ok(!h.includes('<script>x'));
  assert.match(h, /&lt;script&gt;x/);
  assert.match(h, /Abrir sessão/);
  assert.match(h, /Em andamento/);
  assert.match(h, /selo-entregue/);
});

test('a página só aceita POST da própria origem e grava o pedido de resposta', async () => {
  estado.criar('perguntas', 'p', { titulo: 'T', estado: 'aberta', sessao: SESSAO_DO_APP });
  const porta = 4800 + Math.floor(Math.random() * 500);
  const servidor = await servir(porta);
  try {
    const url = `http://127.0.0.1:${porta}`;
    const corpo = 'projeto=p&id=Q1&resposta=pode';
    const fora = await fetch(`${url}/responder`, { method: 'POST', headers: { origin: 'http://evil.test' }, body: corpo });
    assert.equal(fora.status, 403);
    const dentro = await fetch(`${url}/responder`, { method: 'POST', redirect: 'manual', headers: { origin: url, 'content-type': 'application/x-www-form-urlencoded' }, body: corpo });
    assert.equal(dentro.status, 303);
    const q = estado.ler('perguntas', 'p', 'Q1');
    assert.equal(q.estado, 'respondida');
    assert.equal(q.lida, false);
    const pasta = join(process.env.ICHIKAWA_HOME, 'pedidos');
    const pedido = JSON.parse(readFileSync(join(pasta, readdirSync(pasta)[0]), 'utf8'));
    assert.equal(pedido.tipo, 'responder');
    assert.equal(pedido.sessao, SESSAO_DO_APP);
  } finally {
    servidor.close();
  }
});
