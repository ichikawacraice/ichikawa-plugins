// Quem está pesando no computador (ICH-F48): CPU e memória somadas por responsável — a sessão do Claude dona da árvore
// de processos, ou Docker, um app, o sistema. Lê só o `ps`, sem modelo e sem laço próprio: a página pede `GET /uso`
// enquanto está visível, e a última amostra vale por `VALIDADE_MS` (duas abas não dobram a coleta).
import { execFile } from 'node:child_process';
import { availableParallelism, totalmem } from 'node:os';
import { duracao } from './sessoes.mjs';

export const VALIDADE_MS = 4_000;
/** O HTML inicial só mostra amostra mais nova que isto; mais velha, a página pede uma nova ao abrir. */
export const AMOSTRA_FRESCA_MS = 15_000;
export const GRUPOS_A_MOSTRAR = 8;
const PRAZO_DO_PS_MS = 5_000;
const BUFFER_DO_PS = 32 * 1024 * 1024;
// Só esta variável sai do ambiente: o app do Claude a põe em cada sessão e em cada servidor que sobe por ela, e o
// filho a herda. O resto do ambiente (há tokens nele) é descartado na hora.
const VARIAVEL_DA_SESSAO = /(?:^|\s)CLAUDE_CODE_HOST_SESSION_ID=(local_[0-9a-f-]{8,64})(?=\s|$)/;
// O comando da sessão do Claude passa de 10 KB (a lista de ferramentas); o tipo e o dono se leem no começo.
const ARGS_LIDOS = 400;
const LINHA_DO_PS = /^\s*(\d+)\s+(\d+)\s+([\d.,]+)\s+(\d+)\s+(\S+)\s(.*)$/;

const APP_CLAUDE = /\/Claude\.app\/Contents\/(MacOS\/Claude$|MacOS\/Claude\s|Frameworks\/|Helpers\/chrome)/;
const DOCKER = /\/Docker\.app\/|\/com\.docker\.|(^|\/)docker(-[\w-]+)?(\s|$)|\/\.docker\//;
const MAQUINA_VIRTUAL = /Virtualization\.VirtualMachine|\/qemu-system/;
const SISTEMA = /^(\/System\/|\/usr\/(?!local\/)|\/sbin\/|\/bin\/|\/Library\/Apple\/|\/Library\/PrivilegedHelperTools\/|\/Library\/Application Support\/Apple\/)/;
// Daemon do sistema não herda ambiente de sessão; o `/bin/zsh` órfão de uma sessão herda, então shell e ferramenta
// de `/bin` e `/usr/bin` passam pela leitura do ambiente antes de cair em Sistema.
const DAEMON = /^(\/System\/|\/usr\/libexec\/|\/usr\/sbin\/|\/sbin\/|\/Library\/Apple\/|\/Library\/PrivilegedHelperTools\/)/;
const APP = /\/([^/]+)\.app\//;

/** Os tipos de trabalho, do mais de fora para dentro: o `cargo test` que compila é teste, não build. */
const TIPOS = [
  ['teste', /\b(vitest|jest|playwright|mocha|cypress|pytest|ava)\b|node(\s+[^\s]+)*\s+--test\b|\b(cargo|go|swift|deno|bun)\s+test\b|\b(npm|pnpm|yarn)\s+(run\s+)?test\b/i],
  ['dev server', /\bnext[ -]dev\b|next-server|\bnext\s+dev\b|\bvite(\s|$)(?!.*\bbuild\b)|webpack[- ]dev[- ]server|webpack\s+serve|nodemon|wrangler\s+dev|\b(astro|remix|nuxt|nuxi|svelte-kit|storybook|expo)\s+(dev|start)\b|\b(npm|pnpm|yarn|bun)\s+(run\s+)?(dev|start|serve)\b|\btsx\s+watch|\bfaststore\s+dev|\buvicorn\b|flask\s+run|rails\s+s(erver)?\b|php\s+-S/i],
  ['build', /\b(tsc|esbuild|rustc|swc|tsup|rollup|babel|xcodebuild|swift-frontend|clang|gcc|turbo|gradle|webpack)\b|\bcargo\s+(build|check|clippy)\b|\bnext\s+build\b|\bvite\s+build\b|\bgo\s+build\b|\b(npm|pnpm|yarn)\s+(run\s+)?build\b/i],
  ['docker', /(^|\/)docker(\s|$)/],
];
const CLAUDE_CLI = /\/claude-code\/[^ ]*\/claude(\s|$)|\/\.local\/bin\/claude(\s|$)|(^|\/)claude\s+--/;

/** `[[dd-]hh:]mm:ss` → segundos. */
export function segundos(etime) {
  const m = /^(?:(\d+)-)?(?:(\d+):)?(\d+):(\d+)$/.exec(String(etime ?? '').trim());
  if (!m) return 0;
  const [, d = 0, h = 0, min, s] = m;
  return Number(d) * 86_400 + Number(h) * 3600 + Number(min) * 60 + Number(s);
}

/** A saída do `ps -A -o pid=,ppid=,pcpu=,rss=,etime=,args=`; linha que não se lê fica de fora. */
export function lerTabela(saida) {
  const linhas = [];
  for (const l of String(saida).split('\n')) {
    const m = LINHA_DO_PS.exec(l);
    if (!m) continue;
    linhas.push({ pid: Number(m[1]), ppid: Number(m[2]), cpu: Number(m[3].replace(',', '.')) || 0, rssKb: Number(m[4]), segundos: segundos(m[5]), args: m[6].slice(0, ARGS_LIDOS).trim() });
  }
  return linhas;
}

/** A sessão do ambiente de cada processo (`ps -E -o pid=,command=`): `Map pid → local_…`. Só a variável sai daqui. */
export function lerSessoesDoAmbiente(saida) {
  const mapa = new Map();
  for (const l of String(saida).split('\n')) {
    const pid = Number(/^\s*(\d+)\s/.exec(l)?.[1]);
    if (!pid) continue;
    const id = VARIAVEL_DA_SESSAO.exec(l)?.[1];
    mapa.set(pid, id ?? null);
  }
  return mapa;
}

const executavel = (args) => {
  if (MAQUINA_VIRTUAL.test(args)) return 'máquina virtual';
  const app = APP.exec(args);
  if (app) return app[1];
  const primeiro = args.split(/\s+/)[0] ?? '';
  return primeiro.split('/').pop() || primeiro || '?';
};

const tipoDe = (args) => TIPOS.find(([, re]) => re.test(args))?.[0] ?? null;

/** O código do item no começo do título (`ICH-F48 · …` → `ICH-F48`). */
const codigoDoTitulo = (titulo) => /^([A-Z][A-Z0-9]{1,6}-[A-Z]\d+)\b/.exec(titulo ?? '')?.[1] ?? null;

/**
 * As raízes cujo ambiente vale ler: abaixo do app do Claude (sessões e servidores do preview) ou órfãs adotadas pelo
 * `launchd` fora de app e de sistema (o `nohup` de uma sessão). App aberto pelo Finder não herda a variável.
 */
export function raizesParaLer(linhas, { pidDoPainel = null } = {}) {
  const { raizDe, appClaude } = arvore(linhas);
  const raizes = new Set();
  for (const p of linhas) {
    const r = raizDe(p.pid);
    if (!r || r.pid === pidDoPainel || raizes.has(r.pid)) continue;
    if (APP_CLAUDE.test(r.args) || DOCKER.test(r.args) || MAQUINA_VIRTUAL.test(r.args) || DAEMON.test(r.args)) continue;
    if (r.ppid !== appClaude && APP.test(r.args)) continue;
    raizes.add(r.pid);
  }
  return [...raizes];
}

function arvore(linhas) {
  const porPid = new Map(linhas.map((p) => [p.pid, p]));
  const appClaude = linhas.find((p) => /\/Claude\.app\/Contents\/MacOS\/Claude$/.test(p.args))?.pid ?? null;
  const cacheDaRaiz = new Map();
  const raizDe = (pid) => {
    if (cacheDaRaiz.has(pid)) return cacheDaRaiz.get(pid);
    let p = porPid.get(pid);
    const vistos = new Set();
    while (p && p.ppid > 1 && p.ppid !== appClaude && porPid.has(p.ppid) && !vistos.has(p.pid)) {
      vistos.add(p.pid);
      p = porPid.get(p.ppid);
    }
    cacheDaRaiz.set(pid, p ?? null);
    return p ?? null;
  };
  /** Os processos do caminho da raiz até `pid`, de fora para dentro. */
  const caminho = (pid) => {
    const c = [];
    let p = porPid.get(pid);
    const vistos = new Set();
    while (p && !vistos.has(p.pid)) {
      vistos.add(p.pid);
      c.unshift(p);
      if (p.ppid <= 1 || p.ppid === appClaude) break;
      p = porPid.get(p.ppid);
    }
    return c;
  };
  return { porPid, appClaude, raizDe, caminho };
}

/**
 * Agrupa os processos por responsável, do que mais usa CPU para o que menos (empate: memória).
 * `ambiente`: `Map pid da raiz → local_… | null`; `sessoes`: as do `sessoes-do-app.json` (`{ sessionId, titulo }`).
 */
export function agrupar(linhas, { ambiente = new Map(), sessoes = [], nucleos = 1, memoriaTotal = 0, pidDoPainel = null } = {}) {
  const { appClaude, raizDe, caminho } = arvore(linhas);
  const titulos = new Map(sessoes.map((s) => [s.sessionId, s.titulo]));
  const haDocker = linhas.some((p) => DOCKER.test(p.args));
  const grupos = new Map();
  const grupo = (chave, base) => {
    if (!grupos.has(chave)) grupos.set(chave, { chave, ...base, cpu: 0, memoria: 0, processos: 0, tipos: new Map(), principal: null });
    return grupos.get(chave);
  };
  let cpuTotal = 0;
  let memoriaUsada = 0;
  for (const p of linhas) {
    // A própria coleta (o `ps` que o Painel acabou de rodar) não conta.
    if (pidDoPainel !== null && p.ppid === pidDoPainel && /^(\/bin\/)?ps\s/.test(p.args)) continue;
    cpuTotal += p.cpu;
    memoriaUsada += p.rssKb * 1024;
    const rota = caminho(p.pid);
    const r = raizDe(p.pid) ?? p;
    let g;
    if (rota.some((x) => x.pid === pidDoPainel)) g = grupo('painel', { tipo: 'painel', nome: 'Painel (esta página)' });
    else if (p.pid === appClaude || APP_CLAUDE.test(r.args) || r.pid === appClaude) g = grupo('app:Claude', { tipo: 'app', nome: 'App Claude' });
    else if (DOCKER.test(r.args) || DOCKER.test(p.args) && !ambiente.get(r.pid)) g = grupo('docker', { tipo: 'docker', nome: 'Docker' });
    else if (MAQUINA_VIRTUAL.test(r.args)) g = haDocker ? grupo('docker', { tipo: 'docker', nome: 'Docker' }) : grupo('vm', { tipo: 'app', nome: 'Máquina virtual' });
    else if (ambiente.get(r.pid)) {
      const id = ambiente.get(r.pid);
      const titulo = titulos.get(id) ?? null;
      g = grupo(`sessao:${id}`, { tipo: 'sessao', sessao: id, titulo, codigo: codigoDoTitulo(titulo), nome: titulo ?? `sessão ${id.slice(6, 14)}…` });
    } else if (SISTEMA.test(r.args)) g = grupo('sistema', { tipo: 'sistema', nome: 'Sistema (macOS)' });
    else if (APP.test(r.args)) { const nome = APP.exec(r.args)[1]; g = grupo(`app:${nome}`, { tipo: 'app', nome }); }
    else { const nome = executavel(r.args); g = grupo(`outro:${nome}`, { tipo: 'outro', nome }); }
    g.cpu += p.cpu;
    g.memoria += p.rssKb * 1024;
    g.processos += 1;
    // O tipo vem do processo mais de fora que tem um (a sessão do Claude não conta: ela é a dona, não o trabalho).
    const tipo = rota.map((x) => tipoDe(x.args)).find(Boolean) ?? (CLAUDE_CLI.test(p.args) ? 'sessão do Claude' : null);
    if (tipo) {
      const t = g.tipos.get(tipo) ?? { tipo, cpu: 0, segundos: 0 };
      t.cpu += p.cpu;
      t.segundos = Math.max(t.segundos, p.segundos);
      g.tipos.set(tipo, t);
    }
    if (!g.principal || p.cpu > g.principal.cpu) g.principal = { nome: executavel(p.args), cpu: p.cpu, segundos: p.segundos };
  }
  const n = Math.max(1, nucleos);
  const ordenados = [...grupos.values()].map((g) => ({
    ...g,
    cpu: g.cpu / n,
    tipos: [...g.tipos.values()].sort((a, b) => b.cpu - a.cpu || b.segundos - a.segundos).map((t) => ({ ...t, cpu: t.cpu / n })),
  })).sort((a, b) => b.cpu - a.cpu || b.memoria - a.memoria);
  return { cpu: cpuTotal / n, memoria: memoriaUsada, memoriaTotal, nucleos: n, grupos: ordenados };
}

const rodar = (cmd, args) => new Promise((ok, falha) => {
  execFile(cmd, args, { timeout: PRAZO_DO_PS_MS, maxBuffer: BUFFER_DO_PS, encoding: 'utf8' }, (err, saida) => (err ? falha(err) : ok(saida)));
});

/**
 * A coleta com memória curta: `amostra()` roda o `ps` (no máximo uma vez a cada `VALIDADE_MS`, e uma só em voo);
 * `ultima()` devolve a guardada sem rodar nada. O ambiente de cada raiz é lido uma vez por processo.
 */
export function criarColeta({ executar = rodar, agora = Date.now, lerSessoes = () => [], pidDoPainel = process.pid, nucleos = availableParallelism(), memoriaTotal = totalmem() } = {}) {
  let ultima = null;
  let emVoo = null;
  const ambiente = new Map();
  async function medir() {
    const linhas = lerTabela(await executar('ps', ['-A', '-o', 'pid=,ppid=,pcpu=,rss=,etime=,args=']));
    const vivos = new Map(linhas.map((p) => [p.pid, p.args]));
    for (const [pid, v] of ambiente) if (vivos.get(pid) !== v.args) ambiente.delete(pid);
    const novas = raizesParaLer(linhas, { pidDoPainel }).filter((pid) => !ambiente.has(pid));
    if (novas.length) {
      let lidas = new Map();
      try { lidas = lerSessoesDoAmbiente(await executar('ps', ['-E', '-o', 'pid=,command=', '-p', novas.join(',')])); } catch { /* processo sumiu no meio: fica sem dona */ }
      for (const pid of novas) ambiente.set(pid, { args: vivos.get(pid), sessao: lidas.get(pid) ?? null });
    }
    const sessaoDa = new Map([...ambiente].map(([pid, v]) => [pid, v.sessao]));
    return { em: agora(), ...agrupar(linhas, { ambiente: sessaoDa, sessoes: lerSessoes(), nucleos, memoriaTotal, pidDoPainel }) };
  }
  return {
    async amostra() {
      if (ultima && agora() - ultima.em < VALIDADE_MS) return ultima;
      emVoo ??= medir().then((a) => { ultima = a; return a; }, (err) => { ultima = { em: agora(), erro: err.message, grupos: [] }; return ultima; }).finally(() => { emVoo = null; });
      return emVoo;
    },
    ultima: () => ultima,
  };
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pct = (v) => `${v < 10 ? v.toFixed(1).replace('.', ',') : Math.round(v)}%`;
export function bytes(b) {
  const gb = b / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1).replace('.', ',')} GB`;
  return `${Math.round(b / 1024 ** 2)} MB`;
}
const ha = (s) => `há ${duracao(s * 1000)}`;

function linhaDoGrupo(g, maior) {
  const nome = g.tipo === 'sessao'
    ? `${g.codigo ? `<span class="id">${esc(g.codigo)}</span>` : ''}<span class="uso-nome">${esc(g.codigo ? g.titulo.slice(g.codigo.length).replace(/^\s*[·:-]\s*/, '') : g.nome)}</span>`
    : `<span class="uso-nome">${esc(g.nome)}</span>`;
  const tipos = g.tipos.filter((t) => t.tipo !== 'sessão do Claude' || g.tipos.length === 1);
  const oQue = tipos.length
    ? tipos.map((t) => `${esc(t.tipo)} ${esc(ha(t.segundos))}`).join(' · ')
    : g.principal ? `${esc(g.principal.nome)} ${esc(ha(g.principal.segundos))}` : '';
  const largura = maior > 0 ? Math.max(2, Math.round((g.cpu / maior) * 100)) : 0;
  return `<li class="uso-grupo uso-${esc(g.tipo)}"><div class="uso-cab">${nome}<span class="uso-numeros"><span title="CPU, % da máquina">${esc(pct(g.cpu))}</span> · <span title="Memória">${esc(bytes(g.memoria))}</span></span></div>
<div class="uso-barra" aria-hidden="true"><span style="width:${largura}%"></span></div>${oQue ? `<p class="quando">${oQue}${g.processos > 1 ? ` · ${g.processos} processos` : ''}</p>` : ''}</li>`;
}

/** A seção inteira (o HTML inicial e o `GET /uso` usam a mesma). Sem amostra: o aviso de que está lendo. */
export function secaoDeUso(amostra) {
  const abre = '<section class="secao" id="uso" aria-labelledby="h-uso"><div class="secao-cab"><h2 id="h-uso">Uso do computador</h2>';
  if (!amostra) return `${abre}<span class="lido">lendo…</span></div><ul class="cartoes uso"><li class="vazio">Lendo os processos…</li></ul></section>`;
  if (amostra.erro) return `${abre}<span class="lido">sem leitura</span></div><ul class="cartoes uso"><li class="vazio">Não deu para ler os processos: ${esc(amostra.erro)}</li></ul></section>`;
  const mostrar = amostra.grupos.slice(0, GRUPOS_A_MOSTRAR);
  const resto = amostra.grupos.slice(GRUPOS_A_MOSTRAR);
  const maior = mostrar[0]?.cpu ?? 0;
  const memoria = amostra.memoriaTotal ? `${bytes(amostra.memoria)} de ${bytes(amostra.memoriaTotal)}` : bytes(amostra.memoria);
  const somaResto = resto.reduce((a, g) => ({ cpu: a.cpu + g.cpu, memoria: a.memoria + g.memoria }), { cpu: 0, memoria: 0 });
  const linhaResto = resto.length ? `<li class="uso-resto">mais ${resto.length} ${resto.length === 1 ? 'grupo' : 'grupos'} · ${esc(pct(somaResto.cpu))} · ${esc(bytes(somaResto.memoria))}</li>` : '';
  return `${abre}<span class="lido">CPU ${esc(pct(amostra.cpu))} · memória ${esc(memoria)}</span></div>
<ul class="cartoes uso">${mostrar.map((g) => linhaDoGrupo(g, maior)).join('\n') || '<li class="vazio">Nenhum processo lido.</li>'}${linhaResto}</ul></section>`;
}
