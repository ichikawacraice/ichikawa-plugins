import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cpSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abrirPainel, lerPorta } from '../abrir.mjs';
import { PORTA_PADRAO, PASTA_DO_PLUGIN, pastaDoServidorDoPainel, saudeDoPainel } from '../cli.mjs';

const ESTA = { pasta: PASTA_DO_PLUGIN };

const coletor = () => {
  const r = { saida: [], erro: [], abertos: [], subidas: [] };
  return { r, deps: { saida: (t) => r.saida.push(t), erro: (t) => r.erro.push(t), abrir: (u) => r.abertos.push(u), subir: (p) => r.subidas.push(p) } };
};

test('painel já no ar: só abre o navegador, não sobe outro', async () => {
  const { r, deps } = coletor();
  const codigo = await abrirPainel({ ...deps, env: {}, saude: async () => ESTA });
  assert.equal(codigo, 0);
  assert.deepEqual(r.subidas, []);
  assert.deepEqual(r.abertos, [`http://127.0.0.1:${PORTA_PADRAO}`]);
});

test('painel fora do ar: sobe desacoplado, espera responder e abre', async () => {
  const { r, deps } = coletor();
  let chamadas = 0;
  const codigo = await abrirPainel({ ...deps, argv: ['--porta', '4999'], env: {}, saude: async () => (++chamadas > 2 ? ESTA : null) });
  assert.equal(codigo, 0);
  assert.deepEqual(r.subidas, [4999]);
  assert.deepEqual(r.abertos, ['http://127.0.0.1:4999']);
});

test('painel que não responde no prazo: sai 1 com o caminho para ver o erro, sem abrir', async () => {
  const { r, deps } = coletor();
  const codigo = await abrirPainel({ ...deps, env: {}, saude: async () => null, prazoMs: 50 });
  assert.equal(codigo, 1);
  assert.deepEqual(r.abertos, []);
  assert.match(r.erro.join(), /painel-de-contas --porta/);
});

test('--sem-abrir (botão da barra): sobe o painel e sai 0 sem abrir o navegador do sistema', async () => {
  const { r, deps } = coletor();
  let chamadas = 0;
  const codigo = await abrirPainel({ ...deps, argv: ['--sem-abrir'], env: {}, saude: async () => (++chamadas > 1 ? ESTA : null) });
  assert.equal(codigo, 0);
  assert.deepEqual(r.subidas, [PORTA_PADRAO]);
  assert.deepEqual(r.abertos, []);
  assert.match(r.saida.join(), new RegExp(`127\\.0\\.0\\.1:${PORTA_PADRAO}`));
});

test('--sem-abrir com o painel já no ar: não sobe outro nem abre', async () => {
  const { r, deps } = coletor();
  const codigo = await abrirPainel({ ...deps, argv: ['--sem-abrir'], env: {}, saude: async () => ESTA });
  assert.equal(codigo, 0);
  assert.deepEqual(r.subidas, []);
  assert.deepEqual(r.abertos, []);
});

test('argumentos: porta do env, --porta, erro e ajuda', () => {
  assert.equal(lerPorta([], { PAINEL_DE_CONTAS_PORTA: '5000' }).porta, 5000);
  assert.equal(lerPorta(['--porta', '6000'], {}).porta, 6000);
  assert.match(lerPorta(['--porta', '0'], {}).erro, /--porta/);
  assert.match(lerPorta(['--x'], {}).erro, /desconhecido/);
  assert.equal(lerPorta(['-h'], {}).ajuda, true);
  assert.equal(lerPorta(['--sem-abrir'], {}).semAbrir, true);
  assert.equal(lerPorta([], {}).semAbrir, false);
});

test('o barra.json abre no navegador do app: url na porta padrão e o bin só sobe o painel nessa porta', () => {
  const barra = JSON.parse(readFileSync(new URL('../../../barra.json', import.meta.url), 'utf8'));
  const contas = barra.botoes.find((b) => b.id === 'contas');
  assert.equal(contas.rotulo, 'Contas');
  assert.equal(contas.url, `http://127.0.0.1:${PORTA_PADRAO}`);
  assert.deepEqual(contas.comando, ['node', '${CLAUDE_PLUGIN_ROOT}/src/painel/abrir.mjs', '--sem-abrir', '--porta', String(PORTA_PADRAO)]);
});

// ICH-F23: depois de atualizar o plugin, o servidor da versão anterior seguia vivo na porta e o botão reaproveitava-o.
const PASTA_VELHA = '/Users/x/.claude/plugins/cache/ichikawa-plugins/contas/d288e84abcde';
const comandoDoPainel = (pasta) => `/opt/homebrew/bin/node ${pasta}/src/painel/cli.mjs --porta 4791 --sem-abrir`;

test('a linha de comando prova o servidor do painel, no cache ou no repositório', () => {
  assert.equal(pastaDoServidorDoPainel(comandoDoPainel(PASTA_VELHA)), PASTA_VELHA);
  assert.equal(pastaDoServidorDoPainel('node /repo/plugins/contas/src/painel/cli.mjs'), '/repo/plugins/contas');
  assert.equal(pastaDoServidorDoPainel('python3 -m http.server 4791'), null);
  assert.equal(pastaDoServidorDoPainel('node /repo/plugins/contas/src/troca/cli.mjs'), null);
  assert.equal(pastaDoServidorDoPainel('node /outro/app/src/painel/cli.mjs'), null);
});

/** `abrirPainel` com a saúde e os processos falsos; devolve o que encerrou, se subiu outro e os avisos. */
async function abrirSobre({ pastaNoAr, comando }) {
  const { r, deps } = coletor();
  const encerrados = [];
  let noAr = { pasta: pastaNoAr };
  const codigo = await abrirPainel({
    ...deps, argv: ['--sem-abrir'], env: {}, prazoMs: 200,
    saude: async () => noAr,
    processos: () => [{ pid: 4242, comando }],
    encerrar: (pid) => { encerrados.push(pid); noAr = null; },
    subir: (p) => { r.subidas.push(p); noAr = ESTA; },
  });
  return { codigo, encerrados, subidas: r.subidas, erro: r.erro };
}

test('servidor desta versão fica como está', async () => {
  const x = await abrirSobre({ pastaNoAr: PASTA_DO_PLUGIN, comando: comandoDoPainel(PASTA_DO_PLUGIN) });
  assert.deepEqual(x, { codigo: 0, encerrados: [], subidas: [], erro: [] });
});

test('servidor de outra versão do plugin é encerrado e o desta sobe', async () => {
  const x = await abrirSobre({ pastaNoAr: PASTA_VELHA, comando: comandoDoPainel(PASTA_VELHA) });
  assert.deepEqual(x.encerrados, [4242]);
  assert.deepEqual(x.subidas, [PORTA_PADRAO]);
  assert.equal(x.codigo, 0);
});

test('servidor antigo, sem pasta na saúde, é provado pela linha de comando e trocado', async () => {
  const x = await abrirSobre({ pastaNoAr: null, comando: comandoDoPainel(PASTA_VELHA) });
  assert.deepEqual(x.encerrados, [4242]);
  assert.deepEqual(x.subidas, [PORTA_PADRAO]);
});

test('sem provar pela linha de comando, nada é encerrado e o painel no ar segue', async () => {
  const x = await abrirSobre({ pastaNoAr: null, comando: 'python3 -m http.server 4791' });
  assert.deepEqual(x.encerrados, []);
  assert.deepEqual(x.subidas, []);
  assert.equal(x.codigo, 0);
  assert.match(x.erro.join(), /deixei como está/);
});

test('ponta a ponta: painel de uma cópia antiga no ar é derrubado e o desta versão passa a responder', async (t) => {
  if (process.platform !== 'darwin') { t.skip('a prova pela linha de comando usa lsof e ps do macOS'); return; }
  const raiz = realpathSync(mkdtempSync(join(tmpdir(), 'f23-')));
  const velha = join(raiz, 'contas', 'velha');
  cpSync(join(PASTA_DO_PLUGIN, 'src'), join(velha, 'src'), { recursive: true, filter: (o) => !o.includes('/test') });
  cpSync(join(PASTA_DO_PLUGIN, 'package.json'), join(velha, 'package.json'));
  const porta = 20000 + Math.floor(Math.random() * 20000);
  const filhos = [];
  const rodar = (cli) => { const f = spawn(process.execPath, [cli, '--porta', String(porta), '--sem-abrir'], { stdio: 'ignore' }); filhos.push(f); };
  try {
    rodar(join(velha, 'src', 'painel', 'cli.mjs'));
    const ate = Date.now() + 5000;
    while (!(await saudeDoPainel(porta)) && Date.now() < ate) await new Promise((r) => setTimeout(r, 50));
    assert.equal((await saudeDoPainel(porta))?.pasta, velha, 'a cópia antiga não subiu');
    const { r, deps } = coletor();
    const codigo = await abrirPainel({ ...deps, argv: ['--sem-abrir', '--porta', String(porta)], env: {}, subir: () => rodar(fileURLToPath(new URL('../cli.mjs', import.meta.url))) });
    assert.equal(codigo, 0, r.erro.join());
    const velho = filhos[0];
    if (velho.exitCode === null && velho.signalCode === null) await Promise.race([once(velho, 'exit'), new Promise((r) => setTimeout(r, 2000))]);
    assert.equal(velho.signalCode, 'SIGTERM', 'o servidor antigo não foi encerrado');
    assert.equal((await saudeDoPainel(porta))?.pasta, PASTA_DO_PLUGIN, 'a porta não serve o painel desta versão');
  } finally {
    for (const f of filhos) f.kill();
    rmSync(raiz, { recursive: true, force: true });
  }
});
