import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { criarServidor, html } from '../lib/pagina.mjs';
import { agrupar, criarColeta, lerSessoesDoAmbiente, lerTabela, secaoDeUso } from '../lib/uso.mjs';

beforeEach(() => { process.env.ICHIKAWA_HOME = mkdtempSync(join(tmpdir(), 'ichikawa-')); });

const APP = '/Applications/Claude.app/Contents/MacOS/Claude';
const CLI = '/Users/x/Library/Application Support/Claude/claude-code/2.1/abc/claude.app/Contents/MacOS/claude --output-format stream-json';
// Uma máquina pequena: duas sessões (uma com dev server e testes, outra só pensando), o preview que o app subiu para a
// primeira, um `nohup` órfão da segunda, Docker, um app, o sistema e o próprio app do Claude.
const PS = [
  `    1     0   0.5   7000 02-10:00:00 /sbin/launchd`,
  `  100     1   2.0 200000    01:00:00 ${APP}`,
  `  101   100   1.0 100000    01:00:00 /Applications/Claude.app/Contents/Frameworks/Claude Helper (Renderer).app/Contents/MacOS/Claude Helper (Renderer) --type=renderer`,
  `  200   100   0.0   1000    40:00 /Applications/Claude.app/Contents/Helpers/disclaimer --pgroup -- ${CLI}`,
  `  201   200   5.0 300000    40:00 ${CLI}`,
  `  202   201   0.1   2000    30:00 /bin/zsh -c pnpm test`,
  `  203   202  80.0 400000    30:00 node (vitest)`,
  `  204   203  40.0  90000    29:00 /p/node_modules/@esbuild/darwin-arm64/bin/esbuild --service`,
  `  210   100   0.0   1000  1:02:00 /Applications/Claude.app/Contents/Helpers/disclaimer -- /bin/sh -c pnpm --filter web exec next dev`,
  `  211   210  30.0 500000  1:02:00 next-server (v15.5.29)`,
  `  300   100   0.0   1000    10:00 /Applications/Claude.app/Contents/Helpers/disclaimer --pgroup -- ${CLI}`,
  `  301   300   3.0 250000    10:00 ${CLI}`,
  `  400     1 150.0 900000    05:00 /Users/x/.rustup/toolchains/stable/bin/cargo test --workspace`,
  `  401   400  90.0 300000    02:00 /Users/x/.rustup/toolchains/stable/bin/rustc --crate-name foo`,
  `  500     1   1.0 100000 2-00:00:00 /Applications/Docker.app/Contents/MacOS/com.docker.backend`,
  `  501     1 120.0 4000000 2-00:00:00 /System/Library/Frameworks/Virtualization.framework/Versions/A/XPCServices/com.apple.Virtualization.VirtualMachine.xpc/Contents/MacOS/com.apple.Virtualization.VirtualMachine`,
  `  600     1  10.0 600000    03:00 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
  `  700     1  20.0  50000 2-00:00:00 /usr/libexec/logd`,
  `  800     1   0.1  60000    00:30 node /kit/lib/cli.mjs pagina --porta 4747`,
  `  801   800   0.5   1000    00:00 ps -A -o pid=,ppid=,pcpu=,rss=,etime=,args=`,
].join('\n');
// O `ps -E`: o ambiente vem inteiro (com segredo), e só a variável da sessão pode sair dele.
const ENV = [
  `  200 /Applications/Claude.app/Contents/Helpers/disclaimer --pgroup -- claude TOKEN=segredo CLAUDE_CODE_HOST_SESSION_ID=local_aaaaaaaa-1111 HOME=/Users/x`,
  `  210 /Applications/Claude.app/Contents/Helpers/disclaimer -- /bin/sh -c next dev CLAUDE_CODE_HOST_SESSION_ID=local_aaaaaaaa-1111`,
  `  300 /Applications/Claude.app/Contents/Helpers/disclaimer --pgroup -- claude CLAUDE_CODE_HOST_SESSION_ID=local_bbbbbbbb-2222`,
  `  400 /Users/x/.rustup/toolchains/stable/bin/cargo test --workspace CLAUDE_CODE_HOST_SESSION_ID=local_bbbbbbbb-2222`,
].join('\n');
const SESSOES = [
  { sessionId: 'local_aaaaaaaa-1111', titulo: 'ICH-F48 · Painel mostra quem pesa' },
  { sessionId: 'local_bbbbbbbb-2222', titulo: 'IZA-F7 · <b>migração</b>' },
];

const executarFalso = (chamadas = []) => async (cmd, args) => {
  chamadas.push(args.join(' '));
  return args[0] === '-E' ? ENV : PS;
};

test('agrupa por responsável, do que mais pesa ao que menos, com tipo e há quanto tempo roda', async () => {
  const chamadas = [];
  const coleta = criarColeta({ executar: executarFalso(chamadas), lerSessoes: () => SESSOES, pidDoPainel: 800, nucleos: 10, memoriaTotal: 16 * 1024 ** 3 });
  const a = await coleta.amostra();
  const nomes = a.grupos.map((g) => g.chave);
  // B: cargo test órfão (240) + cli (3) = 243 → 24,3%; A: vitest+esbuild+next+cli (155,1) → 15,5%; Docker: 121 → 12,1%.
  assert.deepEqual(nomes.slice(0, 5), ['sessao:local_bbbbbbbb-2222', 'sessao:local_aaaaaaaa-1111', 'docker', 'sistema', 'app:Google Chrome']);
  const [b, aa] = a.grupos;
  assert.equal(b.codigo, 'IZA-F7');
  assert.equal(b.tipos[0].tipo, 'teste', 'o rustc chamado pelo cargo test conta como teste, não build');
  assert.equal(b.tipos[0].segundos, 300);
  assert.deepEqual(aa.tipos.map((t) => t.tipo), ['teste', 'dev server', 'sessão do Claude']);
  assert.equal(aa.tipos.find((t) => t.tipo === 'dev server').segundos, 62 * 60, 'o preview subido pelo app vai para a sessão');
  assert.equal(aa.processos, 7);
  assert.ok(a.grupos.some((g) => g.chave === 'app:Claude' && g.processos === 2));
  assert.ok(a.grupos.some((g) => g.chave === 'painel' && g.processos === 1), 'o `ps` da própria coleta não conta');
  // Ambiente lido só das raízes candidatas, nunca do app, do Docker nem do daemon.
  assert.deepEqual(chamadas, ['-A -o pid=,ppid=,pcpu=,rss=,etime=,args=', '-E -o pid=,command= -p 200,210,300,400']);
  assert.doesNotMatch(JSON.stringify(a), /segredo|TOKEN/);
});

test('a coleta guarda a amostra por alguns segundos e não relê o ambiente da raiz já lida', async () => {
  let t = 0;
  const chamadas = [];
  const coleta = criarColeta({ executar: executarFalso(chamadas), agora: () => t, lerSessoes: () => [], pidDoPainel: 800 });
  assert.equal(coleta.ultima(), null);
  await Promise.all([coleta.amostra(), coleta.amostra()]);
  assert.equal(chamadas.length, 2, 'duas abas ao mesmo tempo: um ps só');
  t = 1000;
  await coleta.amostra();
  assert.equal(chamadas.length, 2);
  t = 10_000;
  await coleta.amostra();
  assert.deepEqual(chamadas.slice(2), ['-A -o pid=,ppid=,pcpu=,rss=,etime=,args='], 'raízes conhecidas: sem ps -E');
});

test('a seção escapa o título e diz o tipo e o tempo; ps que falha vira aviso', async () => {
  const coleta = criarColeta({ executar: executarFalso(), lerSessoes: () => SESSOES, pidDoPainel: 800, nucleos: 10, memoriaTotal: 16 * 1024 ** 3 });
  const h = secaoDeUso(await coleta.amostra());
  assert.match(h, /id="h-uso">Uso do computador</);
  assert.match(h, /<span class="id">IZA-F7<\/span><span class="uso-nome">&lt;b&gt;migração/);
  assert.match(h, /teste há 5 min/);
  assert.match(h, /dev server há 1 h 2 min/);
  assert.match(h, /de 16,0 GB/);
  const ruim = criarColeta({ executar: async () => { throw new Error('ps sumiu'); } });
  assert.match(secaoDeUso(await ruim.amostra()), /Não deu para ler os processos: ps sumiu/);
});

test('a página põe o uso numa aba própria, fechada por padrão, e o serve em GET /uso', async () => {
  const h = html(Date.now(), null, null);
  // Duas abas: Perguntas (com Sessões e Entregues), a padrão, e Uso do computador, escondida até ser escolhida.
  assert.match(h, /role="tablist"/);
  assert.match(h, /<button type="button" role="tab" id="aba-perguntas" aria-controls="painel-perguntas" aria-selected="true" tabindex="0">Perguntas<\/button>/);
  assert.match(h, /<button type="button" role="tab" id="aba-uso" aria-controls="painel-uso" aria-selected="false" tabindex="-1">Uso do computador<\/button>/);
  const painelPerguntas = h.match(/<main id="painel-perguntas" role="tabpanel" aria-labelledby="aba-perguntas">([\s\S]*?)<\/main>/);
  const painelUso = h.match(/<main id="painel-uso" role="tabpanel" aria-labelledby="aba-uso" hidden>([\s\S]*?)<\/main>/);
  assert.ok(painelPerguntas && painelUso, 'os dois painéis, o de Uso escondido');
  assert.match(painelPerguntas[1], /id="h-perguntas"[\s\S]*id="h-entregas"/);
  assert.doesNotMatch(painelPerguntas[1], /id="h-uso"/);
  assert.match(painelUso[1], /id="h-uso"[\s\S]*Lendo os processos/);
  // A coleta só pede amostra com a aba Uso ativa e a página visível.
  assert.match(h, /if \(abaAtiva\(\) !== 'uso' \|\| document\.visibilityState !== 'visible' \|\| lendoUso\) return;/);

  const coleta = criarColeta({ executar: executarFalso(), lerSessoes: () => SESSOES, pidDoPainel: 800 });
  const servidor = criarServidor(0, { coleta, aviso: () => null });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  try {
    const r = await fetch(`http://127.0.0.1:${servidor.address().port}/uso`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('cache-control'), /no-store/);
    assert.match(await r.text(), /^<section class="secao" id="uso"[\s\S]*IZA-F7/);
  } finally {
    servidor.close();
  }
});

test('lerTabela e lerSessoesDoAmbiente não confiam na entrada', () => {
  assert.deepEqual(lerTabela('lixo\n  12 1 0,5 100 00:05 /bin/x -a b'), [{ pid: 12, ppid: 1, cpu: 0.5, rssKb: 100, segundos: 5, args: '/bin/x -a b' }]);
  const m = lerSessoesDoAmbiente('  5 x CLAUDE_CODE_HOST_SESSION_ID=local_abcdef12-3 Y=1\n  6 y CLAUDE_CODE_HOST_SESSION_ID=$(rm)\n');
  assert.equal(m.get(5), 'local_abcdef12-3');
  assert.equal(m.get(6), null);
  assert.equal(agrupar([], {}).grupos.length, 0);
});
