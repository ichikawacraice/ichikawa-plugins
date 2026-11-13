// A lista de conversas do Code que o app mostra por conta (claude-code-sessions/<conta>/<organização>/local_<id>.json).
// O conteúdo das conversas é um só (~/.claude/projects); tornar uma conversa visível noutra conta é copiar a entrada dela.
// Port de sessions.go (ver NOTICE).
import { createHash } from 'node:crypto';
import { chmodSync, closeSync, copyFileSync, existsSync, fstatSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, statSync, utimesSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { clonarArquivo, copiarArquivo, criarPasta, escreverAtomico } from './app-do-claude.mjs';

/** As chaves da marca que o app põe nas conversas que parou no meio do turno ao fechar. */
export const CHAVES_DE_CORTE = ['interruptedByQuitAt', 'interruptedUnseenResume', 'interruptedAwaitingPerson'];
/** Um transcrito escrito há menos que isso pode ser de uma conversa em andamento. */
export const EM_ANDAMENTO_EM_MS = 30 * 60 * 1000;

const subpastas = (dir) => { try { return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort(); } catch { return []; } };
const arquivos = (dir) => { try { return readdirSync(dir, { withFileTypes: true }).filter((e) => !e.isDirectory()).map((e) => e.name).sort(); } catch { return null; } };
const mesmaPasta = (a, b) => resolve(a).toLowerCase() === resolve(b).toLowerCase();

/** Lê uma entrada da lista. Devolve { caminho, nome, cli, atividade, obj } ou lança. */
export function lerEntrada(caminho) {
  const texto = readFileSync(caminho, 'utf8');
  const obj = JSON.parse(texto);
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) throw new Error(`${caminho} não é um objeto`);
  const nome = caminho.slice(caminho.lastIndexOf('/') + 1);
  return {
    caminho, nome, obj, texto,
    cli: typeof obj.cliSessionId === 'string' ? obj.cliSessionId : '',
    atividade: Number.isFinite(obj.lastActivityAt) ? obj.lastActivityAt : 0,
  };
}
/**
 * Lê a entrada e devolve só os campos de que a varredura precisa, DESCARTANDO o texto e o objeto. O arquivo é lido e
 * parseado inteiro — é o descarte que segura a memória, não uma leitura parcial: do acervo todo (7.400 entradas de
 * ~176 KB, mais de 1,2 GB) sobram algumas dezenas de bytes por entrada, uma por vez. Uma entrada única maior que o
 * heap ainda estoura: o teto é o maior arquivo, não o acervo. Quem precisa do conteúdo relê o arquivo.
 */
export function lerResumo(caminho) {
  const obj = JSON.parse(readFileSync(caminho, 'utf8'));
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) throw new Error(`${caminho} não é um objeto`);
  return {
    caminho,
    nome: caminho.slice(caminho.lastIndexOf('/') + 1),
    cli: typeof obj.cliSessionId === 'string' ? obj.cliSessionId : '',
    atividade: Number.isFinite(obj.lastActivityAt) ? obj.lastActivityAt : 0,
    corte: typeof obj.interruptedByQuitAt === 'number' ? obj.interruptedByQuitAt : undefined,
  };
}
const identidade = (e) => (e.cli ? `cli:${e.cli}` : `arquivo:${e.nome}`);
const idLocal = (e) => e.nome.replace(/^local_/, '').replace(/\.json$/, '');

/** Grava a entrada no formato em que ela veio (tabulação, 2 espaços ou compacto); sem pista, tabulação. */
export function gravarEntrada(caminho, obj, textoOriginal = '') {
  const formatos = ['\t', 2, undefined];
  const f = formatos.find((i) => JSON.stringify(JSON.parse(textoOriginal || '{}'), null, i) === textoOriginal) ?? '\t';
  escreverAtomico(caminho, JSON.stringify(obj, null, f));
}

/** As pastas de organização que a conta tem em `raiz/<conta>/`. */
export const organizacoesDa = (raiz, conta) => subpastas(join(raiz, conta));

/** Move o arquivo para `dir/<nome>`; nome já usado ganha sufixo (`local_x.1.json`), nunca se sobrescreve. Devolve o caminho final. */
function guardarNaReserva(caminho, dir, nome) {
  criarPasta(dir);
  const ponto = nome.lastIndexOf('.');
  const [base, ext] = ponto > 0 ? [nome.slice(0, ponto), nome.slice(ponto)] : [nome, ''];
  let destino = join(dir, nome);
  for (let i = 1; existsSync(destino); i++) destino = join(dir, `${base}.${i}${ext}`);
  try { renameSync(caminho, destino); } catch (err) {
    if (err.code !== 'EXDEV') throw err;
    copyFileSync(caminho, destino);
    rmSync(caminho);
  }
  return destino;
}

/** A hora da marca de apagada (ms): o número do arquivo; vazia ou ilegível conta como agora. */
function lerMarca(caminho, agora) {
  let texto = '';
  try { texto = readFileSync(caminho, 'utf8').trim(); } catch { /* ilegível: agora */ }
  const n = Number(texto);
  return texto !== '' && Number.isFinite(n) && n > 0 ? { ms: n, texto } : { ms: agora, texto: '' };
}

/**
 * Deixa a lista de `raiz/<conta>/<org>/` como espelho da união das outras contas, conversa por conversa (cliSessionId):
 * - copia o que falta; nunca a apagada (`deleted_<id>`, também pelo cliSessionId);
 * - a entrada de origem substitui a do destino quando o ARQUIVO dela é mais novo (mtime: pega arquivar e renomear, que não
 *   mudam o lastActivityAt) e o texto é diferente; a cópia leva o mtime da origem, então a volta não reescreve;
 * - se o destino usa outro nome de arquivo para a mesma conversa, é nele que se grava (com o sessionId dele): nunca há dois;
 * - a apagada em outra conta sai do destino (se o lastActivityAt dela ≤ a hora da marca) para `reserva/<conta>/<org>/`, e o
 *   destino ganha a marca; sem `reserva` nada sai (só conta e vai ao log). O que só existe no destino fica.
 * Só a lista: o conteúdo das conversas nunca é tocado. Devolve { gravadas, removidas }.
 */
export function sincronizar(raiz, conta, org, { log = () => {}, reserva } = {}) {
  const alvo = join(raiz, conta, org);
  const agora = Date.now();
  const marcas = new Map(); // id local apagado → { ms, texto } (a maior hora entre as contas)
  const todas = [];
  const fontes = [];
  const alvos = new Map();
  const alvosProtegidos = new Set();
  const porIdentidade = new Map();

  for (const c of subpastas(raiz)) {
    for (const o of subpastas(join(raiz, c))) {
      const dir = join(raiz, c, o);
      const nomes = arquivos(dir);
      const ehAlvo = mesmaPasta(dir, alvo);
      if (nomes === null) {
        // Sem ler a pasta de destino, importar poderia sobrescrever entradas dela.
        if (ehAlvo) return { gravadas: 0, removidas: 0 };
        continue;
      }
      for (const nome of nomes) {
        if (nome.startsWith('deleted_')) {
          const id = nome.slice('deleted_'.length);
          const m = lerMarca(join(dir, nome), agora);
          if (!marcas.has(id) || m.ms > marcas.get(id).ms) marcas.set(id, m);
          continue;
        }
        if (!nome.startsWith('local_') || !nome.endsWith('.json')) continue;
        let e;
        try {
          e = lerResumo(join(dir, nome));
          e.mtimeMs = Math.floor(statSync(e.caminho).mtimeMs);
        } catch (err) {
          log(`entrada ilegível ignorada: ${join(dir, nome)} (${err.message})`);
          if (ehAlvo) alvosProtegidos.add(nome);
          continue;
        }
        todas.push(e);
        if (ehAlvo) { alvos.set(nome, e); porIdentidade.set(identidade(e), nome); } else fontes.push(e);
      }
    }
  }
  // Uma marca de apagada pode citar outro alias local da mesma conversa.
  const marcasCli = new Map();
  for (const e of todas) {
    const m = marcas.get(idLocal(e));
    if (m && e.cli && (!marcasCli.has(e.cli) || m.ms > marcasCli.get(e.cli).ms)) marcasCli.set(e.cli, m);
  }
  const marcaDe = (e) => {
    const a = marcas.get(idLocal(e));
    const b = e.cli ? marcasCli.get(e.cli) : undefined;
    return a && b ? (a.ms >= b.ms ? a : b) : a ?? b;
  };

  criarPasta(alvo);
  let removidas = 0;
  for (const [nome, e] of [...alvos]) {
    const m = marcaDe(e);
    if (!m || e.atividade > m.ms) continue; // usada depois de apagada: fica
    removidas++;
    if (!reserva) { log(`${nome} foi apagada em outra conta; sem pasta de reserva, fica na lista`); continue; }
    const guardada = guardarNaReserva(e.caminho, join(reserva, conta, org), nome);
    log(`${nome} foi apagada em outra conta; saiu da lista (cópia em ${guardada})`);
    escreverAtomico(join(alvo, `deleted_${idLocal(e)}`), m.texto || String(Date.now()));
    alvos.delete(nome);
    if (porIdentidade.get(identidade(e)) === nome) porIdentidade.delete(identidade(e));
  }

  // De cada conversa vale a origem de arquivo mais novo (conta nova importa a cópia mais fresca uma vez, com vários aliases).
  const melhores = new Map();
  for (const s of fontes) {
    if (marcaDe(s)) continue;
    const atual = melhores.get(identidade(s));
    if (!atual || s.mtimeMs > atual.mtimeMs || (s.mtimeMs === atual.mtimeMs && s.atividade > atual.atividade)) melhores.set(identidade(s), s);
  }
  const ordem = [...melhores.values()].sort((a, b) => b.mtimeMs - a.mtimeMs || (a.nome < b.nome ? -1 : 1));

  let gravadas = 0;
  for (const s of ordem) {
    const existente = porIdentidade.get(identidade(s));
    const nomeAlvo = existente ?? s.nome; // a mesma conversa com outro nome de arquivo: grava no que o destino já usa
    if (alvosProtegidos.has(nomeAlvo)) { log(`entrada de destino ilegível, ${nomeAlvo} fica como está`); continue; }
    const velho = alvos.get(nomeAlvo);
    const caminhoAlvo = join(alvo, nomeAlvo);
    const mesmoNome = nomeAlvo === s.nome;
    // O conteúdo só entra na memória aqui, um par de entradas por gravação.
    let cheios = null;
    if (velho) {
      if (s.mtimeMs <= velho.mtimeMs) continue;
      try { cheios = { fonte: lerEntrada(s.caminho), destino: lerEntrada(velho.caminho) }; }
      catch (err) { log(`entrada ilegível ignorada: ${err.message}`); continue; }
      const { fonte, destino } = cheios;
      const igual = mesmoNome
        ? fonte.texto === destino.texto
        : JSON.stringify({ ...fonte.obj, sessionId: destino.obj.sessionId }) === JSON.stringify(destino.obj);
      if (igual) continue;
    }
    if (mesmoNome || !cheios) {
      copiarArquivo(s.caminho, caminhoAlvo);
    } else {
      gravarEntrada(caminhoAlvo, { ...cheios.fonte.obj, sessionId: cheios.destino.obj.sessionId }, cheios.destino.texto);
    }
    cheios = null;
    // O destino fica com a data da origem: sem isso a cópia pareceria mais nova e cada troca a reescreveria.
    const info = statSync(s.caminho);
    utimesSync(caminhoAlvo, info.atime, info.mtime);
    const novo = { caminho: caminhoAlvo, nome: nomeAlvo, cli: s.cli, atividade: s.atividade, mtimeMs: Math.floor(statSync(caminhoAlvo).mtimeMs) };
    gravadas++;
    if (velho && velho.cli !== s.cli) {
      log(`${nomeAlvo} foi para outra sessão do Claude Code; fica a mais nova`);
      if (porIdentidade.get(identidade(velho)) === nomeAlvo) porIdentidade.delete(identidade(velho));
    }
    alvos.set(nomeAlvo, novo);
    porIdentidade.set(identidade(novo), nomeAlvo);
  }
  return { gravadas, removidas };
}

/**
 * Quantas conversas faltam na lista da conta, só pelo nome dos arquivos (sem ler o conteúdo: ~3 ms para 5.000 entradas).
 * Falta = `local_<id>.json` de qualquer pasta (de qualquer conta) que não está na pasta da conta e não tem `deleted_<id>`
 * em nenhuma. `faltam` é o da pasta mais incompleta da conta, não a soma: a lista que caiu numa pasta não esconde outra
 * vazia. Conta sem pasta de organização: falta a lista toda. Devolve { faltam, porPasta: { <org>: n } }.
 */
export function faltamPeloNome(raiz, conta) {
  const apagadas = new Set();
  const todas = new Set();
  const daConta = new Map();
  for (const c of subpastas(raiz)) {
    for (const o of subpastas(join(raiz, c))) {
      const nomes = arquivos(join(raiz, c, o)) ?? [];
      const ids = new Set();
      for (const n of nomes) {
        if (n.startsWith('deleted_')) { apagadas.add(n.slice('deleted_'.length)); continue; }
        if (n.startsWith('local_') && n.endsWith('.json')) { const id = n.slice('local_'.length, -'.json'.length); ids.add(id); todas.add(id); }
      }
      if (c === conta) daConta.set(o, ids);
    }
  }
  const lista = [...todas].filter((id) => !apagadas.has(id));
  const porPasta = {};
  for (const [o, ids] of daConta) porPasta[o] = lista.filter((id) => !ids.has(id)).length;
  const faltam = daConta.size ? Math.max(...Object.values(porPasta)) : lista.length;
  return { faltam, porPasta };
}

const arquivoDaLista = (dados) => join(dados, 'lista.json');
function lerRegistroDaLista(dados) {
  try {
    const o = JSON.parse(readFileSync(arquivoDaLista(dados), 'utf8'));
    return o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  } catch { return {}; }
}

/** O resíduo da conta: quantas pareciam faltar pelo nome logo depois da última cópia (alias local, apagada pelo cliSessionId). */
export function lerResiduo(dados, conta) {
  const n = lerRegistroDaLista(dados)[conta]?.residuo;
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

/** Grava o resíduo da conta em `lista.json` (sem segredo, escrita atômica). */
export function gravarResiduo(dados, conta, residuo, agora = new Date()) {
  const r = lerRegistroDaLista(dados);
  r[conta] = { residuo, em: agora.toISOString() };
  criarPasta(dados);
  escreverAtomico(arquivoDaLista(dados), JSON.stringify(r, null, 2));
}

/** O turno está aberto enquanto o Claude ainda tem de responder um prompt ou resultado de ferramenta, ou chamou uma ferramenta. */
export function turnoAberto(cauda) {
  const linhas = String(cauda).split('\n');
  for (let i = linhas.length - 1; i >= 0; i--) {
    let e;
    try { e = JSON.parse(linhas[i]); } catch { continue; }
    if (e === null || typeof e !== 'object' || e.isSidechain) continue;
    if (e.type === 'assistant') {
      const parou = e.message?.stop_reason ?? null;
      if (parou === null) return true;
      return !['end_turn', 'stop_sequence', 'max_tokens', 'refusal'].includes(parou);
    }
    if (e.type === 'user') return !JSON.stringify(e.message?.content ?? null).includes('[Request interrupted by user');
  }
  return false;
}

function lerCauda(caminho, n) {
  let fd;
  try {
    fd = openSync(caminho, 'r');
    const tam = fstatSync(fd).size;
    const ini = Math.max(0, tam - n);
    const buf = Buffer.alloc(tam - ini);
    readSync(fd, buf, 0, buf.length, ini);
    return buf.toString('utf8');
  } catch { return ''; } finally { if (fd !== undefined) closeSync(fd); }
}

/** Os ids de sessão do CLI das conversas com turno aberto, pelos transcritos de `projetos/<pasta>/<id>.jsonl` mexidos nos últimos 30 min. */
export function conversasEmAndamento(projetosDir, agora = Date.now()) {
  const andamento = new Set();
  for (const pasta of subpastas(projetosDir)) {
    for (const n of arquivos(join(projetosDir, pasta)) ?? []) {
      if (!n.endsWith('.jsonl')) continue;
      const p = join(projetosDir, pasta, n);
      let info;
      try { info = statSync(p); } catch { continue; }
      if (agora - info.mtimeMs > EM_ANDAMENTO_EM_MS) continue;
      if (turnoAberto(lerCauda(p, 256 * 1024))) andamento.add(n.slice(0, -'.jsonl'.length));
    }
  }
  return andamento;
}

/** Tira a marca de corte de uma entrada, para o app deixar a conversa em paz. */
export function limparMarca(caminho) {
  const e = lerEntrada(caminho);
  for (const k of CHAVES_DE_CORTE) delete e.obj[k];
  gravarEntrada(caminho, e.obj, e.texto);
}

/**
 * As chaves da marca de corte que o app gravou numa entrada, ou `null` quando o arquivo não pôde ser lido. `null` e
 * objeto vazio dizem coisas diferentes: vazio é "li a entrada e ela não tinha marca", `null` é "não li" — e só o
 * `null` manda quem chama cair na marca de reserva, em vez de gravar nas cópias uma ausência de marca que ninguém mediu.
 */
export function lerChavesDeCorte(caminho, log = () => {}) {
  try {
    const m = lerEntrada(caminho);
    const chaves = {};
    for (const k of CHAVES_DE_CORTE) if (k in m.obj) chaves[k] = m.obj[k];
    return chaves;
  } catch (err) {
    log(`marca de corte não lida em ${caminho}: ${err.message}`);
    return null;
  }
}

/**
 * Põe a marca das conversas paradas no meio do turno pelo fechamento (`desde`, em ms) nas entradas da conta de destino, que é
 * onde o app a procura ao abrir: as que o app marcou sozinho e as de `andamento`. `orgs` são as pastas de organização da
 * conta (uma ou várias: sem saber qual o app vai abrir, todas recebem a marca). Marca deixada na cópia de outra conta
 * continuaria a conversa uma segunda vez numa troca futura, então sai de lá. Conversa que a conta não vê mantém a marca.
 * Devolve as conversas cortadas, uma por conversa: [{ caminho, titulo, pasta }].
 */
export function tomarConversasCortadas(raiz, conta, orgs, desde, andamento = new Set(), { log = () => {} } = {}) {
  const alvos = (Array.isArray(orgs) ? orgs : [orgs]).filter(Boolean).map((o) => join(raiz, conta, o));
  const ehAlvo = (dir) => alvos.some((a) => mesmaPasta(dir, a));
  const marcadas = new Map();
  const noAlvo = new Map();
  for (const c of subpastas(raiz)) {
    for (const o of subpastas(join(raiz, c))) {
      for (const n of arquivos(join(raiz, c, o)) ?? []) {
        if (!n.startsWith('local_') || !n.endsWith('.json')) continue;
        let e;
        try { e = lerResumo(join(raiz, c, o, n)); } catch { continue; }
        if (!e.cli) continue;
        if (ehAlvo(join(raiz, c, o))) { if (!noAlvo.has(e.cli)) noAlvo.set(e.cli, []); noAlvo.get(e.cli).push(e); }
        if (typeof e.corte === 'number' && e.corte >= desde) {
          if (!marcadas.has(e.cli)) marcadas.set(e.cli, []);
          marcadas.get(e.cli).push(e);
        }
      }
    }
  }
  for (const cli of andamento) if (!marcadas.has(cli)) marcadas.set(cli, []);
  const cortadas = [];
  for (const [cli, fontes] of marcadas) {
    const dsts = noAlvo.get(cli);
    if (!dsts?.length) continue;
    // A marca que o app gravou (a fonte mais recente) vale para todas as cópias de destino; só ela é relida.
    const modelo = [...fontes].sort((a, b) => b.corte - a.corte)[0];
    const chaves = modelo ? lerChavesDeCorte(modelo.caminho, log) : null;
    for (const dst of dsts) {
      if (modelo && modelo.caminho === dst.caminho) continue;
      try {
        const d = lerEntrada(dst.caminho);
        if (chaves) Object.assign(d.obj, chaves);
        else { d.obj.interruptedByQuitAt = desde; d.obj.interruptedAwaitingPerson = false; }
        gravarEntrada(dst.caminho, d.obj, d.texto);
      } catch (err) { log(`marca de corte não gravada em ${dst.caminho}: ${err.message}`); }
    }
    for (const src of fontes) {
      if (dsts.some((d) => d.caminho === src.caminho)) continue;
      try { limparMarca(src.caminho); } catch (err) { log(`marca de corte não limpa em ${src.caminho}: ${err.message}`); }
    }
    const dst = dsts[0];
    let obj = {};
    try { obj = lerEntrada(dst.caminho).obj; } catch { /* ilegível: sem título */ }
    const cwd = typeof obj.originCwd === 'string' && obj.originCwd ? obj.originCwd : (typeof obj.cwd === 'string' ? obj.cwd : '');
    const pasta = cwd ? cwd.replace(/\/+$/, '').split('/').pop() : '';
    cortadas.push({ caminho: dst.caminho, titulo: (typeof obj.title === 'string' && obj.title) || pasta, pasta });
  }
  return cortadas.sort((a, b) => (a.titulo < b.titulo ? -1 : a.titulo > b.titulo ? 1 : 0));
}

/** O sha256 do arquivo inteiro, em hexa. Lê e descarta: o conteúdo não fica na memória. */
export function hashDoArquivo(caminho) {
  return createHash('sha256').update(readFileSync(caminho)).digest('hex');
}

/**
 * Reescreve `dst` como clone de `src` (blocos divididos no APFS) mantendo a data que `dst` já tinha e gravando 0600, que é como a troca grava — a ordem
 * do espelho se decide pela data de cada arquivo, e perdê-la faria a próxima troca copiar a entrada sem precisar.
 * O `selo` ({ hash, mtimeMs, tamanho }) é o que a varredura mediu: o clone só entra no lugar se a fonte ainda tem esse
 * conteúdo e o destino não foi gravado por outro no meio. Devolve false quando desistiu, sem deixar temporário.
 */
export function reclonar(src, dst, selo) {
  const bate = () => { try { const s = statSync(dst); return Math.floor(s.mtimeMs) === selo.mtimeMs && s.size === selo.tamanho; } catch { return false; } };
  if (!bate()) return false;
  const antes = statSync(dst);
  const tmp = `${dst}.troca-tmp`;
  rmSync(tmp, { force: true });
  try {
    if (!clonarArquivo(src, tmp)) copyFileSync(src, tmp);
    if (hashDoArquivo(tmp) !== selo.hash) return false; // a fonte mudou desde a varredura: não leva conteúdo de outra conversa
    chmodSync(tmp, 0o600);
    utimesSync(tmp, antes.atimeMs / 1000, antes.mtimeMs / 1000); // em ms, não em Date: o Date perde a fração e a data mudaria
    if (!bate()) return false; // alguém gravou no destino enquanto o clone era feito
    renameSync(tmp, dst);
    return true;
  } finally {
    rmSync(tmp, { force: true });
  }
}

/**
 * Mede (e com `aplicar` desfaz) a repetição das listas: a mesma conversa visível em várias contas é o mesmo conteúdo
 * gravado tantas vezes quantas as contas. Re-clonar cada cópia a partir de uma só devolve o disco sem mudar um byte
 * nem a data de nenhum arquivo. A pasta da conta `referencia` nunca é reescrita: ela é a doadora, e o app pode estar
 * gravando nela (é a conta logada). Devolve o que mediu e o que fez.
 */
export function enxugar(raiz, { referencia = '', aplicar = false, log = () => {} } = {}) {
  const grupos = new Map(); // hash:tamanho → { tamanho, hash, doador, destinos: [] }
  let total = 0;
  for (const conta of subpastas(raiz)) {
    const daReferencia = conta === referencia;
    for (const org of subpastas(join(raiz, conta))) {
      const dir = join(raiz, conta, org);
      for (const nome of arquivos(dir) ?? []) {
        // Temporário de uma rodada interrompida no meio (Ctrl-C): ninguém mais o limpa, e a trava garante que não é de
        // uma rodada em curso. A seco não se mexe em nada, nem nele.
        if (nome.endsWith('.troca-tmp')) {
          if (aplicar) try { rmSync(join(dir, nome), { force: true }); log(`temporário de rodada interrompida removido: ${nome}`); } catch (err) { log(`temporário não removido: ${err.message}`); }
          continue;
        }
        if (!nome.startsWith('local_') || !nome.endsWith('.json')) continue;
        const caminho = join(dir, nome);
        let s, hash;
        try { s = statSync(caminho); hash = hashDoArquivo(caminho); } catch (err) { log(`entrada ilegível ignorada: ${err.message}`); continue; }
        total++;
        const chave = `${s.size}:${hash}`;
        const g = grupos.get(chave) || { tamanho: s.size, hash, doador: null, destinos: [], naReferencia: 0 };
        const item = { caminho, mtimeMs: Math.floor(s.mtimeMs), ref: daReferencia };
        // Quem doa não é reescrito, e a referência doa de preferência; cópia extra dentro da referência fica como está.
        if (!g.doador) g.doador = item;
        else if (!daReferencia) g.destinos.push(item);
        else if (!g.doador.ref) { g.destinos.push(g.doador); g.doador = item; }
        else g.naReferencia++;
        grupos.set(chave, g);
      }
    }
  }
  let repetidos = 0, bytes = 0, copias = 0, reclonados = 0, pulados = 0, naConta = 0, bytesNaConta = 0;
  for (const g of grupos.values()) {
    if (!g.destinos.length && !g.naReferencia) continue;
    repetidos++;
    // `copias` e `bytes` são o que o enxugo devolve: só os destinos. A cópia repetida dentro da própria conta doadora
    // fica como está (é a pasta em que o app grava) e vai contada à parte — senão `reclonados + pulados` nunca
    // fecharia com `copias`, e a medição a seco ofereceria um disco que o `--aplicar` não devolve.
    copias += g.destinos.length;
    bytes += g.tamanho * g.destinos.length;
    naConta += g.naReferencia;
    bytesNaConta += g.tamanho * g.naReferencia;
    if (!aplicar) continue;
    for (const d of g.destinos) {
      let ok = false;
      try { ok = reclonar(g.doador.caminho, d.caminho, { hash: g.hash, mtimeMs: d.mtimeMs, tamanho: g.tamanho }); }
      catch (err) { log(`não re-clonei ${d.caminho}: ${err.message}`); }
      if (ok) reclonados++; else { pulados++; log(`pulei ${d.caminho}: mudou desde a varredura`); }
    }
  }
  return { arquivos: total, unicos: grupos.size, grupos: repetidos, copias, bytes, reclonados, pulados, naConta, bytesNaConta };
}
