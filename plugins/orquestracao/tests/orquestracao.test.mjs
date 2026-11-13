import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync, chmodSync, unlinkSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import * as estado from '../lib/estado.mjs';
import { main } from '../lib/cli.mjs';
import { dados, html, servir, criarServidor } from '../lib/pagina.mjs';
import { decidir as orquestradoraNaoEdita } from '../hooks/orquestradora-nao-edita.mjs';
import { decidir as configProtegida } from '../hooks/config-protegida.mjs';
import { decidir as segredoSai } from '../hooks/segredo-sai.mjs';
import { contexto } from '../hooks/inicio.mjs';
import { pedirLimpeza } from '../hooks/orquestradora-limpa.mjs';
import { tokensDoContexto } from '../hooks/comum.mjs';
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

test('a página lista perguntas da mais antiga para a mais nova e os itens em ordem de F', () => {
  const t = (min) => new Date(Date.UTC(2026, 10, 13, 12, min));
  estado.criar('perguntas', 'p', { titulo: 'velha', estado: 'aberta' }, t(1));
  estado.criar('perguntas', 'p', { titulo: 'nova', estado: 'aberta' }, t(9));
  estado.criar('perguntas', 'p', { titulo: 'meio', estado: 'aberta' }, t(5));
  for (let n = 1; n <= 11; n += 1) {
    const entregue = n % 2 === 0;
    estado.criar('itens', 'p', {
      titulo: `i${n}`,
      etapa: entregue ? 'feito' : 'execucao',
      ...(entregue ? { entrega: { desfecho: 'entregue', resultado: 'ok', em: t(60 - n).toISOString() } } : {}),
    }, t(60 - n));
  }
  const d = dados(t(120).getTime());
  assert.deepEqual(d.perguntas.map(({ p }) => p.titulo), ['velha', 'meio', 'nova']);
  assert.deepEqual(d.andamento.map(({ i }) => i.id), ['F1', 'F3', 'F5', 'F7', 'F9', 'F11']);
  assert.deepEqual(d.entregas.map(({ i }) => i.id), ['F2', 'F4', 'F6', 'F8', 'F10']);
});

test('cada pergunta tem "Aceitar recomendação" e "Enviar resposta"; enviar vazio não grava', async () => {
  estado.criar('perguntas', 'p', { titulo: 'A', estado: 'aberta' });
  estado.criar('perguntas', 'p', { titulo: 'B', estado: 'aberta' });
  estado.criar('perguntas', 'p', { titulo: 'C', estado: 'aberta' });
  const h = html();
  assert.equal(h.match(/name="acao" value="aceitar"/g)?.length, 3);
  assert.equal(h.match(/name="acao" value="enviar"/g)?.length, 3);
  assert.match(h, />Aceitar recomendação</);
  assert.match(h, />Enviar resposta</);
  const porta = 5400 + Math.floor(Math.random() * 500);
  const servidor = await servir(porta);
  try {
    const url = `http://127.0.0.1:${porta}`;
    const post = (corpo) => fetch(`${url}/responder`, { method: 'POST', redirect: 'manual', headers: { origin: url, 'content-type': 'application/x-www-form-urlencoded' }, body: corpo });
    assert.equal((await post('projeto=p&id=Q1&acao=aceitar&resposta=')).status, 303);
    assert.equal(estado.ler('perguntas', 'p', 'Q1').resposta, 'Sim, siga a recomendação.');
    assert.equal((await post('projeto=p&id=Q2&acao=enviar&resposta=%20%20')).status, 400);
    assert.equal(estado.ler('perguntas', 'p', 'Q2').estado, 'aberta');
    assert.equal((await post('projeto=p&id=Q3&acao=enviar&resposta=n%C3%A3o')).status, 303);
    assert.equal(estado.ler('perguntas', 'p', 'Q3').resposta, 'não');
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

test('passar-papel leva a orquestradora para o novo id depois do /clear, só na mesma pasta', async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'raiz-'));
  await rodar('papel', 'orquestradora', '--sessao-id', 'sessao-velha-1');
  const antes = process.cwd();
  process.chdir(pasta);
  try { await rodar('passar-papel', '--sessao-id', 'sessao-velha-1'); } finally { process.chdir(antes); }
  assert.match(saida[0], /passagem/);
  assert.doesNotMatch(contexto({ session_id: 'sessao-outra-1', cwd: tmpdir(), source: 'clear' }), /Papel desta sessão/);
  assert.doesNotMatch(contexto({ session_id: 'sessao-nova-1', cwd: pasta, source: 'resume' }), /Papel desta sessão/);
  const ctx = contexto({ session_id: 'sessao-nova-1', cwd: pasta, source: 'clear' });
  assert.match(ctx, /Papel desta sessão: \*\*orquestradora\*\*/);
  assert.match(ctx, /perguntas item listar/);
  assert.equal(orquestradoraNaoEdita({ session_id: 'sessao-velha-1', tool_input: { file_path: '/repo/a.ts' } }), null);
  assert.match(orquestradoraNaoEdita({ session_id: 'sessao-nova-1', tool_input: { file_path: '/repo/a.ts' } }), /Orquestradora/);
  assert.doesNotMatch(contexto({ session_id: 'sessao-nova-2', cwd: pasta, source: 'clear' }), /Papel desta sessão/);
  await assert.rejects(rodar('passar-papel', '--sessao-id', 'sessao-sem-papel'), /sem papel/);
});

test('a limpeza lê o contexto do transcript e só pede à orquestradora, uma vez por degrau', async () => {
  const transcript = join(mkdtempSync(join(tmpdir(), 'tr-')), 't.jsonl');
  const uso = (n) => JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 2, cache_creation_input_tokens: 0, cache_read_input_tokens: n } } });
  writeFileSync(transcript, `${uso(50_000)}\n{"type":"user"}\n${uso(160_000)}\nlinha quebrada\n`);
  assert.equal(tokensDoContexto(transcript), 160_002);
  const entrada = { session_id: 'sessao-limpa-1', transcript_path: transcript };
  assert.equal(pedirLimpeza(entrada), null);
  await rodar('papel', 'orquestradora', '--sessao-id', 'sessao-limpa-1');
  assert.equal(pedirLimpeza({ ...entrada, stop_hook_active: true }), null);
  const pedido = pedirLimpeza(entrada);
  assert.match(pedido, /"Contexto em 160 mil\. Posso limpar\? O chat desta sessão some\."/);
  assert.match(pedido, /Não rode `clear_session`/);
  assert.match(pedido, /sim explícito do operador/);
  assert.match(pedido, /ok de outra sessão não vale/);
  assert.match(pedido, /perguntas nova/);
  assert.doesNotMatch(pedido, /Limpe-se agora/);
  assert.equal(pedirLimpeza(entrada), null);
  writeFileSync(transcript, `${uso(200_000)}\n`);
  assert.match(pedirLimpeza(entrada), /200 mil/);
  assert.equal(tokensDoContexto(join(tmpdir(), 'nao-existe.jsonl')), null);
});

test('o limite padrão da limpeza é 150 mil: 140 mil não pede, 150 mil pede', async () => {
  delete process.env.ORQUESTRADORA_LIMPA_EM;
  const transcript = join(mkdtempSync(join(tmpdir(), 'tr-')), 't.jsonl');
  const uso = (n) => JSON.stringify({ type: 'assistant', message: { usage: { input_tokens: 0, cache_read_input_tokens: n } } });
  await rodar('papel', 'orquestradora', '--sessao-id', 'sessao-limpa-2');
  const entrada = { session_id: 'sessao-limpa-2', transcript_path: transcript };
  writeFileSync(transcript, `${uso(140_000)}\n`);
  assert.equal(pedirLimpeza(entrada), null);
  writeFileSync(transcript, `${uso(150_000)}\n`);
  assert.match(pedirLimpeza(entrada), /150 mil/);
});

test('a sigla sai das 3 primeiras letras do nome e pode ser configurada, sem repetir a de outro projeto', async () => {
  assert.equal(estado.sigla('Izanagi'), 'IZA');
  assert.equal(estado.sigla('ichikawa-plugins'), 'ICH');
  assert.equal(estado.sigla('WiControl'), 'WIC');
  assert.equal(estado.sigla('a-b'), 'ABX');
  assert.equal(estado.rotulo('Izanagi', 'F3'), 'IZA-F3');
  estado.criar('itens', 'Izanagi', { titulo: 'x' });
  estado.criar('itens', 'Izanagui', { titulo: 'y' });
  await rodar('sigla', '--todas');
  assert.match(saida.join('\n'), /IZA · Izanagi .*coincide/);
  await assert.rejects(rodar('sigla', 'iza', '--projeto', 'Izanagui'), /IZA já é de Izanagi/);
  await assert.rejects(rodar('sigla', 'I2', '--projeto', 'Izanagui'), /3 letras/);
  await rodar('sigla', 'izg', '--projeto', 'Izanagui');
  assert.equal(estado.sigla('Izanagui'), 'IZG');
  await rodar('sigla', '--projeto', 'Izanagui');
  assert.equal(saida[0], 'IZG');
  await rodar('item', 'listar', '--projeto', 'Izanagui');
  assert.match(saida[0], /^IZG-F1 · y/);
});

test('o CLI aceita F3 e IZA-F3; a sigla escolhe o projeto e não deixa mexer no de outro', async () => {
  await rodar('item', 'nova', 'Login', '--projeto', 'Izanagi');
  assert.equal(saida[0], 'IZA-F1');
  await rodar('item', 'nova', 'Busca', '--projeto', 'Izanagi');
  await rodar('item', 'etapa', 'F1', 'execucao', '--projeto', 'Izanagi');
  assert.equal(saida[0], 'IZA-F1 · Login — execucao');
  await rodar('item', 'etapa', 'iza-f2', 'revisao');
  assert.equal(estado.ler('itens', 'Izanagi', 'F2').etapa, 'revisao');
  await assert.rejects(rodar('item', 'etapa', 'IZA-F1', 'pr', '--projeto', 'WiControl'), /IZA-F1 é de Izanagi/);
  await assert.rejects(rodar('item', 'etapa', 'ZZZ-F1', 'pr'), /nenhum projeto com a sigla ZZZ/);
  await rodar('nova', '--titulo', 'T', '--caso', 'c', '--se-nao', 's', '--recomendacao', 'r', '--item', 'IZA-F1');
  assert.equal(saida[0], 'IZA-Q1');
  assert.equal(estado.ler('perguntas', 'Izanagi', 'Q1').item, 'F1');
  await rodar('responder', 'IZA-Q1', 'pode');
  assert.match(saida[0], /^IZA-Q1 · T \(IZA-F1\) — respondida/);
  await rodar('item', 'entregar', 'IZA-F2', '--desfecho', 'entregue', '--resultado', 'ok');
  assert.equal(saida[0], 'IZA-F2 · Busca — entregue');
  await rodar('item', 'listar', '--projeto', 'Izanagi');
  assert.deepEqual(saida, ['IZA-F1 · Login — execucao']);
});

test('a página separa Em andamento por projeto e põe o projeto na primeira linha de Perguntas e Entregues', () => {
  const agora = new Date().toISOString();
  estado.criar('itens', 'WiControl', { titulo: 'painel', etapa: 'execucao' });
  estado.criar('itens', 'Izanagi', { titulo: 'login', etapa: 'execucao' });
  estado.criar('itens', 'Izanagi', { titulo: 'busca', etapa: 'pr', pr: 9 });
  estado.criar('itens', 'Izanagi', { titulo: 'feito', etapa: 'feito', entrega: { desfecho: 'entregue', resultado: 'ok', em: agora } });
  estado.criar('perguntas', 'WiControl', { titulo: 'apagar?', estado: 'aberta', item: 'F1' });
  const h = html();
  const andamento = h.slice(h.indexOf('id="h-andamento"'), h.indexOf('id="h-entregas"'));
  const grupos = [...andamento.matchAll(/<h3 class="grupo">([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(grupos, ['Izanagi', 'WiControl']);
  assert.ok(andamento.indexOf('IZA-F2') < andamento.indexOf('WiControl'), 'os itens ficam sob o próprio projeto');
  assert.doesNotMatch(andamento, /cartao-projeto/, 'em andamento não repete o projeto no cartão');
  const pergunta = /<li><p class="cartao-projeto">([^<]+)<\/p><div class="cartao-cab"><span class="id">([^<]+)<\/span>/.exec(h);
  assert.deepEqual([pergunta[1], pergunta[2]], ['WiControl', 'WIC-Q1']);
  assert.match(h, /WIC-F1/);
  const entregues = h.slice(h.indexOf('id="h-entregas"'));
  assert.match(entregues, /<summary><p class="cartao-projeto">Izanagi<\/p><div class="cartao-cab"><span class="id">IZA-F3<\/span>/);
});

test('o início diz a sigla do projeto', () => {
  assert.match(contexto({ session_id: 'sessao-teste-3', cwd: join(tmpdir(), 'Izanagi') }), /Sigla do projeto: \*\*IZA\*\*/);
});

const entregar = (projeto, titulo, em, extra = {}) => estado.criar('itens', projeto, {
  titulo, etapa: 'feito', entrega: { desfecho: 'entregue', resultado: `r-${titulo}`, medido: 'm', naoMedido: 'n', proximos: ['p'], em: em.toISOString() }, ...extra,
}, em);

test('cada entrega abre e fecha: o resumo traz projeto, id, título e desfecho; o resto fica dentro', () => {
  entregar('Izanagi', 'busca', new Date());
  const h = html();
  const entregues = h.slice(h.indexOf('id="h-entregas"'));
  const cartao = /<details class="entrega" id="([^"]+)">(<summary>[\s\S]*?<\/summary>)([\s\S]*?)<\/details>/.exec(entregues);
  assert.ok(cartao, 'a entrega é um <details> fechado');
  const [, id, resumo, corpo] = cartao;
  assert.equal(id, 'entrega-Izanagi-F1');
  for (const t of ['Izanagi', 'IZA-F1', 'busca', 'selo-entregue']) assert.match(resumo, new RegExp(t));
  assert.doesNotMatch(resumo, /r-busca/, 'o resultado fica dentro');
  for (const t of ['O que mudou', 'r-busca', 'Medido', 'Sem medir', 'Próximos']) assert.match(corpo, new RegExp(t));
  assert.match(h, /sessionStorage/, 'o recarregamento guarda os cartões abertos');
});

test('Entregues mostra as 10 mais recentes e guarda o resto em "Ver mais"', () => {
  const t = (dia) => new Date(Date.UTC(2026, 10, dia, 12));
  // F1 é a mais recente; F2…F12 vão ficando mais velhas.
  entregar('p', 'nova', t(13));
  for (let n = 2; n <= 12; n += 1) entregar('p', `e${n}`, t(13 - n));
  const agora = t(14).getTime();
  const d = dados(agora);
  assert.equal(d.entregas.length, 10);
  assert.deepEqual(d.entregas.map(({ i }) => i.id), ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10']);
  assert.deepEqual(d.maisEntregas.map(({ i }) => i.id), ['F11', 'F12']);
  const h = html(agora);
  const entregues = h.slice(h.indexOf('id="h-entregas"'));
  assert.match(entregues, /<details class="ver-mais"><summary>Ver mais \(2\)<\/summary>/);
  const antes = entregues.slice(0, entregues.indexOf('ver-mais'));
  assert.doesNotMatch(antes, /entrega-p-F11|entrega-p-F12/);
});

test('sem mais de 10 entregas não há "Ver mais"', () => {
  entregar('p', 'uma', new Date());
  assert.doesNotMatch(html(), /class="ver-mais"/);
});

test('arquivar move a entrega que saiu da página para arquivo/, sem apagar e sem reusar o número', () => {
  const agora = Date.UTC(2026, 10, 13, 12);
  const dias = (n) => new Date(agora - n * 24 * 60 * 60 * 1000);
  entregar('p', 'velha', dias(31));
  entregar('p', 'recente', dias(2));
  estado.criar('itens', 'p', { titulo: 'viva antiga', etapa: 'execucao' }, dias(90));
  estado.criar('itens', 'p', { titulo: 'sem etapa final', etapa: 'pr', entrega: { desfecho: 'parcial', resultado: 'x', em: dias(40).toISOString() } }, dias(40));
  const movidos = estado.arquivar('p', agora);
  assert.deepEqual(movidos, ['F1']);
  assert.deepEqual(readdirSync(estado.pastaDe('itens', 'p')).sort(), ['F2.json', 'F3.json', 'F4.json', 'arquivo']);
  assert.equal(JSON.parse(readFileSync(join(estado.pastaDe('itens', 'p'), 'arquivo', 'F1.json'), 'utf8')).titulo, 'velha');
  assert.deepEqual(estado.listar('itens', 'p').map((i) => i.id), ['F4', 'F3', 'F2']);
  assert.deepEqual(estado.arquivar('p', agora), [], 'rodar de novo não faz nada');
});

test('o número novo pula o maior arquivado', () => {
  const pasta = join(estado.pastaDe('itens', 'p'), 'arquivo');
  mkdirSync(pasta, { recursive: true });
  writeFileSync(join(pasta, 'F9.json'), '{"id":"F9"}');
  assert.equal(estado.criar('itens', 'p', { titulo: 'x' }).id, 'F10');
});

test('perguntas arquivar move de todos os projetos e diz o que moveu', async () => {
  const velha = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  entregar('Izanagi', 'a', velha);
  entregar('WiControl', 'b', velha);
  await rodar('arquivar');
  assert.deepEqual(saida, ['arquivados: IZA-F1, WIC-F1']);
  await rodar('arquivar');
  assert.deepEqual(saida, ['nada para arquivar']);
});

test('abrir a página arquiva no máximo uma vez por dia', async () => {
  const velha = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
  entregar('p', 'a', velha);
  const porta = 4800 + Math.floor(Math.random() * 500);
  const servidor = criarServidor(porta);
  await new Promise((ok) => servidor.listen(porta, '127.0.0.1', ok));
  try {
    await fetch(`http://127.0.0.1:${porta}/`);
    assert.ok(readdirSync(join(estado.pastaDe('itens', 'p'), 'arquivo')).includes('F1.json'));
    entregar('p', 'b', velha);
    await fetch(`http://127.0.0.1:${porta}/`);
    assert.ok(readdirSync(estado.pastaDe('itens', 'p')).includes('F2.json'), 'no mesmo dia não roda de novo');
  } finally {
    servidor.close();
  }
});
