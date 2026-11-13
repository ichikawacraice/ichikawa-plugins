import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync, chmodSync, unlinkSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import * as estado from '../lib/estado.mjs';
import { main } from '../lib/cli.mjs';
import { html, servir } from '../lib/pagina.mjs';
import { decidir as orquestradoraNaoEdita } from '../hooks/orquestradora-nao-edita.mjs';
import { decidir as configProtegida } from '../hooks/config-protegida.mjs';
import { decidir as segredoSai } from '../hooks/segredo-sai.mjs';
import { contexto } from '../hooks/inicio.mjs';
import { decidir as semNoVerify } from '../hooks/sem-no-verify.mjs';
import { decidir as segredoEmArquivo } from '../hooks/segredo-em-arquivo.mjs';
import { decidir as avisoConsoleLog } from '../hooks/aviso-console-log.mjs';
import { formatar, plano as planoDeFormato } from '../hooks/formatar-editado.mjs';

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

const bash = (command) => ({ tool_name: 'Bash', tool_input: { command } });

test('pular os hooks do git pergunta; commit e push normais passam', () => {
  for (const c of [
    'git commit -m "x" --no-verify',
    'git push --no-verify origin develop',
    'git commit -nm "x"',
    'git commit -n -m x',
    'git -c core.hooksPath=/dev/null commit -m x',
    'npm test && git commit --no-verify -m x',
    'bash -c "git commit --no-verify -m x"',
  ]) assert.match(semNoVerify(bash(c)), /pula os hooks|desliga os hooks/, c);
  for (const c of [
    'git commit -m "corrige --no-verify no texto"',
    'git commit -m "n"',
    'git commit -mn',
    'git push -n origin develop',
    'git log -n 5',
    'git status',
    'echo --no-verify',
  ]) assert.equal(semNoVerify(bash(c)), null, c);
  assert.equal(semNoVerify({ tool_name: 'Edit', tool_input: { command: 'git commit --no-verify' } }), null);
});

test('segredo em arquivo pergunta pelo nome do padrão, sem o valor, e deixa o .env.example passar', () => {
  const token = `ghp_${'b2'.repeat(18)}`;
  const grava = (file_path, content) => ({ tool_name: 'Write', tool_input: { file_path, content } });
  const motivo = segredoEmArquivo(grava('/repo/src/api.ts', `const t = '${token}'`));
  assert.match(motivo, /github-token/);
  assert.ok(!motivo.includes(token));
  assert.match(segredoEmArquivo({ tool_name: 'Edit', tool_input: { file_path: '/repo/a.ts', new_string: '-----BEGIN RSA PRIVATE KEY-----' } }), /chave-privada/);
  assert.match(segredoEmArquivo({ tool_name: 'MultiEdit', tool_input: { file_path: '/repo/a.ts', edits: [{ new_string: 'ok' }, { new_string: 'AKIAABCDEFGHIJKLMNOP' }] } }), /aws-key/);
  assert.equal(segredoEmArquivo(grava('/repo/.env.example', `T=${token}`)), null);
  assert.equal(segredoEmArquivo(grava('/repo/a.ts', 'const senha = "abc12345xyz"')), null);
  assert.equal(segredoEmArquivo(grava('/repo/a.ts', 'const t = process.env.GITHUB_TOKEN')), null);
});

test('git add de .env pergunta; .env.example e outros arquivos passam', () => {
  assert.match(segredoEmArquivo(bash('git add .env')), /\.env/);
  assert.match(segredoEmArquivo(bash('git add src/a.ts apps/web/.env.local')), /\.env\.local/);
  assert.match(segredoEmArquivo(bash('git -C app add -f .env && git status')), /\.env/);
  assert.equal(segredoEmArquivo(bash('git add .env.example')), null);
  assert.equal(segredoEmArquivo(bash('git add src/ensure.ts')), null);
  assert.equal(segredoEmArquivo(bash('cat .env')), null);
});

test('console.log novo em código de produto avisa; teste, script, config, bin e cli não', () => {
  const edita = (file_path, new_string) => ({ tool_name: 'Edit', tool_input: { file_path, new_string } });
  assert.match(avisoConsoleLog(edita('/repo/src/app.tsx', 'console.log("x")')), /1 console\.log/);
  assert.match(avisoConsoleLog({ tool_input: { file_path: '/repo/src/a.ts', edits: [{ new_string: 'console.log(1)' }, { new_string: 'console.log(2)' }] } }), /2 console\.log/);
  for (const p of ['/repo/src/app.test.ts', '/repo/a.spec.js', '/repo/scripts/x.mjs', '/repo/vite.config.ts', '/repo/bin/run.js', '/repo/src/cli/main.ts', '/repo/src/cli.ts', '/repo/README.md']) {
    assert.equal(avisoConsoleLog(edita(p, 'console.log(1)')), null, p);
  }
  assert.equal(avisoConsoleLog(edita('/repo/src/a.ts', '// console.log(1)\nconsole.error(2)')), null);
});

test('formatar roda o binário local só no arquivo editado, e só com configuração e sem o desligador', () => {
  const projeto = mkdtempSync(join(tmpdir(), 'fmt-'));
  mkdirSync(join(projeto, 'node_modules', '.bin'), { recursive: true });
  mkdirSync(join(projeto, 'src'));
  const registro = join(projeto, 'chamadas.txt');
  const bin = join(projeto, 'node_modules', '.bin', 'prettier');
  writeFileSync(bin, `#!/bin/sh\necho "$@" >> "${registro}"\n`);
  chmodSync(bin, 0o755);
  writeFileSync(join(projeto, 'src', 'a.ts'), 'x');
  const entrada = { tool_input: { file_path: join(projeto, 'src', 'a.ts') } };

  assert.equal(planoDeFormato(entrada, {}), null, 'sem configuração, não faz nada');
  writeFileSync(join(projeto, '.prettierrc'), '{}');
  assert.equal(planoDeFormato(entrada, { ICHIKAWA_FORMATAR: '0' }), null);
  assert.equal(formatar(entrada, {}), true);
  assert.equal(readFileSync(registro, 'utf8').trim(), '--write src/a.ts');
  assert.equal(planoDeFormato({ tool_input: { file_path: join(projeto, 'src', 'novo.ts') } }, {}), null, 'arquivo inexistente');
  writeFileSync(join(projeto, 'src', 'a.png'), 'x');
  assert.equal(planoDeFormato({ tool_input: { file_path: join(projeto, 'src', 'a.png') } }, {}), null, 'extensão que o formatador não cobre');

  unlinkSync(bin);
  assert.equal(planoDeFormato(entrada, {}), null, 'sem binário local não baixa nada');
});
