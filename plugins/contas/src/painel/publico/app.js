// A tela do painel: lê `/api/contas` e `/api/sessoes`, desenha e manda as ações. Texto da tela nunca vem cru do servidor
// como HTML: tudo entra por `textContent`.
import { ligarBotaoDeTema } from './tema.js';
import { avisoDaCota, desfecho, erroDoUso, fraseDaChave, fraseDoAndamento, haQuanto, identidade, janelas, ordenarContas, validarNome } from './regras.js';

const CABECALHO = { 'X-Painel-De-Contas': '1', 'Content-Type': 'application/json' };
const INTERVALO_CALMO_MS = 15_000;
const INTERVALO_ATIVO_MS = 2_000;
const INTERVALO_SESSOES_MS = 10_000;
/** O desfecho da última troca aparece por este tempo depois que ela acabou. */
const DESFECHO_VALE_MS = 30 * 60_000;

const $ = (id) => document.getElementById(id);
const estado = { dados: null, sessoes: null, editando: null, pedindo: null, falhaLocal: null, desfechoVisto: null };
let relogio = null;

function el(tag, atributos = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(atributos)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const f of filhos.flat()) if (f !== null && f !== undefined && f !== false) n.append(f instanceof Node ? f : String(f));
  return n;
}

async function lerJson(caminho) {
  const r = await fetch(caminho, { cache: 'no-store' });
  if (!r.ok) throw new Error(`o painel respondeu ${r.status}`);
  return r.json();
}

async function postar(rota, corpo = {}) {
  try {
    const r = await fetch(rota, { method: 'POST', headers: CABECALHO, body: JSON.stringify(corpo) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, ...j } : { ok: false, motivo: j.motivo || j.erro || `o painel respondeu ${r.status}` };
  } catch {
    return { ok: false, motivo: 'o painel não respondeu; ele ainda está rodando no terminal?' };
  }
}

const nomeDe = (uuid) => {
  const c = estado.dados?.contas?.find((x) => x.uuid === uuid);
  return c ? identidade(c, estado.dados.emails).nome : (uuid || '').slice(0, 8) || 'a conta de antes';
};
const ocupado = () => Boolean(estado.dados?.andamento || estado.pedindo);

// ---- desenho ----

function desenharFaixas() {
  const d = estado.dados;
  const agora = Date.now();
  const and = $('andamento');
  const textoAndamento = estado.pedindo ? estado.pedindo : d?.andamento ? fraseDoAndamento(d.andamento, agora, nomeDe) : '';
  and.hidden = !textoAndamento;
  and.replaceChildren();
  if (textoAndamento) {
    and.append(el('span', {}, textoAndamento));
    if (d?.andamento?.comando === 'adicionar' && d.andamento.fase === 'esperando') {
      and.append(el('button', { type: 'button', class: 'fechar', onclick: cancelarAdicionar }, 'Cancelar e voltar'));
    }
  }

  const des = $('desfecho');
  const falha = estado.falhaLocal;
  const recente = d?.ultima && agora - Date.parse(d.ultima.fim) < DESFECHO_VALE_MS;
  const ultimo = recente && !d?.andamento && !estado.pedindo ? desfecho(d.ultima, agora) : null;
  const visto = d?.ultima && estado.desfechoVisto === d.ultima.fim;
  const mostrar = falha ? { tom: 'erro', texto: falha } : !visto ? ultimo : null;
  des.hidden = !mostrar;
  des.className = `faixa ${mostrar?.tom ?? ''}`;
  des.replaceChildren();
  if (mostrar) {
    des.append(el('span', {}, mostrar.texto), el('button', { type: 'button', class: 'fechar', 'aria-label': 'Fechar aviso', onclick: () => { estado.falhaLocal = null; estado.desfechoVisto = d?.ultima?.fim ?? null; desenharFaixas(); } }, 'Ok'));
  }

  const erro = $('erro-geral');
  erro.hidden = !d?.erro;
  erro.textContent = d?.erroCodigo === 'semConfig' ? 'Não achei o app do Claude neste Mac (o config.json dele não existe).' : d?.erroCodigo === 'formato' ? 'O app do Claude está num formato que o painel não conhece; nada será trocado.' : d?.erro ? `Não consegui ler as contas: ${d.erro}` : '';

  const avisoCota = d && !d.erro ? avisoDaCota({ contas: d.contas, uso: d.uso, lendoUso: d.lendoUso }, agora) : null;
  const caixa = $('aviso-cota');
  caixa.hidden = !avisoCota;
  caixa.classList.toggle('erro', avisoCota?.tom === 'erro');
  $('aviso-cota-titulo').textContent = avisoCota?.titulo ?? '';
  $('aviso-cota-corpo').textContent = avisoCota?.texto ?? '';

  $('aviso-importar').hidden = !d?.importavel;
  const aviso = $('aviso-chave');
  const frase = d ? fraseDaChave(d.lendoUso ? 'lendo' : d.chave) : '';
  aviso.hidden = !frase;
  aviso.textContent = frase;
}

function barra(j) {
  const preenchido = el('span', { class: 'barra-cheia' });
  preenchido.style.width = `${j.pct}%`;
  return el('div', { class: `barra ${j.tom}`, role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(j.pct), 'aria-label': `${j.nome}: ${j.texto}` },
    preenchido,
    el('span', { class: 'barra-texto', 'aria-hidden': 'true' }, el('span', { class: 'barra-rot' }, j.curto), el('span', { class: 'barra-dado' }, j.texto)));
}

function formularioDeNome(c) {
  const motivo = el('span', { class: 'motivo', role: 'alert' });
  const campo = el('input', { type: 'text', maxlength: '60', value: c.nome, 'aria-label': `Nome da conta ${c.nome}` });
  const salvar = async (ev) => {
    ev.preventDefault();
    const v = validarNome(campo.value, c.uuid, estado.dados.contas);
    if (!v.ok) { motivo.textContent = v.motivo; campo.focus(); return; }
    const anterior = c.nome;
    c.nome = v.nome; // o nome novo entra na hora; a recusa desfaz
    estado.editando = null;
    desenharContas();
    const r = await postar('/api/contas/nomear', { conta: c.uuid, nome: v.nome });
    if (!r.ok) { c.nome = anterior; estado.falhaLocal = `Não dei o nome: ${r.motivo}`; }
    await carregarContas();
  };
  setTimeout(() => { campo.focus(); campo.select(); }, 0);
  return el('form', { class: 'nomear', onsubmit: salvar },
    campo,
    el('button', { type: 'submit', class: 'primario' }, 'Salvar'),
    el('button', { type: 'button', onclick: () => { estado.editando = null; desenharContas(); } }, 'Cancelar'),
    motivo);
}

function linhaDeConta(c) {
  const d = estado.dados;
  const id = identidade(c, d.emails);
  const uso = d.uso?.[c.uuid];
  const js = janelas(uso, Date.now());
  const erroUso = erroDoUso(uso);
  const trocar = el('button', {
    type: 'button', class: 'primario', disabled: c.ativa || !c.salva || ocupado(),
    title: !c.salva ? 'Essa conta não tem login salvo' : undefined,
    onclick: () => trocarPara(c),
  }, 'Trocar para esta');
  const nomear = el('button', { type: 'button', disabled: ocupado(), onclick: () => { estado.editando = c.uuid; desenharContas(); } }, 'Dar nome');
  return el('li', { class: c.ativa ? 'conta-ativa' : undefined }, el('div', { class: 'conta' },
    el('div', {},
      el('div', { class: 'conta-nome' }, id.nome,
        c.ativa ? el('span', { class: 'selo selo-ativa' }, 'no app agora') : null,
        !c.salva ? el('span', { class: 'selo selo-sem-login' }, c.ativa ? 'login ainda não guardado' : 'sem login salvo') : null),
      id.apoio || uso?.lidoEm ? el('div', { class: 'conta-apoio' }, [id.apoio, uso?.lidoEm ? `cota lida ${haQuanto(uso.lidoEm, Date.now())}` : ''].filter(Boolean).join(' · ')) : null),
    js.length ? el('div', { class: 'conta-uso' }, js.map(barra)) : null,
    erroUso ? el('div', { class: 'conta-erro' }, `Cota: ${erroUso}.`) : null,
    el('div', { class: 'conta-acoes' }, c.ativa ? null : trocar, nomear),
    estado.editando === c.uuid ? formularioDeNome(c) : null));
}

function desenharContas() {
  const d = estado.dados;
  const lista = $('lista-contas');
  lista.setAttribute('aria-busy', d ? 'false' : 'true');
  if (!d) return;
  const contas = ordenarContas(d.contas ?? []);
  lista.replaceChildren(...(contas.length ? contas.map(linhaDeConta) : [el('li', { class: 'vazio' }, 'Nenhuma conta guardada ainda. Use Adicionar conta: o painel guarda a conta aberta no app e abre a tela de entrada para a outra.')]));
  $('b-adicionar').disabled = ocupado() || !d.ativa;
  $('b-sincronizar').disabled = ocupado() || !d.ativa;
  $('b-uso').disabled = Boolean(d.lendoUso) || !contas.length;
  $('b-uso-aviso').disabled = $('b-uso').disabled;
  const lidos = Object.values(d.uso ?? {}).map((u) => Date.parse(u.lidoEm)).filter(Number.isFinite);
  $('lido-uso').textContent = lidos.length ? `cota lida ${haQuanto(Math.max(...lidos), Date.now())}` : '';
  const ativa = contas.find((c) => c.ativa);
  $('subtitulo').textContent = [`${contas.length} ${contas.length === 1 ? 'conta' : 'contas'}`, ativa ? `no app agora: ${identidade(ativa, d.emails).nome}` : ''].filter(Boolean).join(' · ');
}

function desenharSessoes() {
  const s = estado.sessoes;
  const lista = $('lista-sessoes');
  const resumo = $('resumo-sessoes');
  if (!s) { lista.replaceChildren(); resumo.textContent = ''; return; }
  if (s.trocando) { resumo.textContent = 'a lista volta depois da troca'; lista.replaceChildren(el('li', { class: 'vazio' }, 'Trocando de conta…')); return; }
  const partes = [];
  if (s.respondendo) partes.push(`${s.respondendo} respondendo agora`);
  if (s.vaoContinuar) partes.push(`${s.vaoContinuar} para o app continuar`);
  resumo.textContent = partes.join(' · ') || (s.sessoes.length ? 'nenhuma respondendo agora' : '');
  if (!s.sessoes.length) { lista.replaceChildren(el('li', { class: 'vazio' }, 'Nenhuma sessão do Code mexida nas últimas 24 h nesta conta.')); return; }
  const agora = Date.now();
  lista.replaceChildren(...s.sessoes.map((x) => el('li', { class: 'sessao' },
    el('span', { class: `ponto ${x.respondendo ? 'respondendo' : ''}`, 'aria-hidden': 'true' }),
    el('div', { class: 'sessao-corpo' },
      el('div', { class: 'sessao-titulo', title: x.titulo }, x.titulo),
      el('div', { class: 'sessao-apoio' }, [x.respondendo ? 'respondendo agora' : x.vaiContinuar ? 'o app vai continuar ao abrir' : `parada · ${haQuanto(x.atividade, agora)}`, x.pasta, x.modelo].filter(Boolean).join(' · '))))));
}

function desenhar() {
  if (estado.editando !== null && !estado.dados?.contas?.some((c) => c.uuid === estado.editando)) estado.editando = null; // a conta sumiu: sai da edição
  try {
    desenharFaixas();
    if (estado.editando === null) desenharContas(); // com o nome sendo digitado a lista não se redesenha por baixo
    else $('b-uso').disabled = $('b-uso-aviso').disabled = Boolean(estado.dados?.lendoUso);
    desenharSessoes();
  } catch (e) {
    console.error('não consegui desenhar o painel', e);
  }
}

// ---- ações ----

/**
 * Confirmação na própria página (`<dialog id="confirmar">`). Nunca `window.confirm`: o navegador do app do Claude
 * descarta o diálogo nativo e devolve `false` na hora, e o botão parecia não fazer nada (13/11/2026).
 */
function confirmar(texto) {
  const d = $('confirmar');
  const [titulo, ...resto] = texto.split('\n\n');
  $('confirmar-titulo').textContent = titulo;
  $('confirmar-corpo').textContent = resto.join('\n\n');
  return new Promise((resolver) => {
    d.addEventListener('close', () => resolver(d.returnValue === 'sim'), { once: true });
    d.returnValue = '';
    d.showModal();
    $('confirmar-sim').focus();
  });
}

async function lancar(rota, corpo, frasePedindo, confirmacao) {
  if (confirmacao && !(await confirmar(confirmacao))) return;
  estado.pedindo = frasePedindo; // o efeito entra na hora
  estado.falhaLocal = null;
  try {
    desenhar();
    const r = await postar(rota, corpo);
    if (!r.ok) estado.falhaLocal = `Não comecei: ${r.motivo}.`;
  } finally {
    estado.pedindo = null;
  }
  await carregarContas();
}

const AVISO_DE_FECHAR = 'O app do Claude vai fechar e abrir de novo (uns 5 segundos). As sessões que estiverem respondendo são retomadas sozinhas. Continuar?';

function trocarPara(c) {
  const nome = identidade(c, estado.dados.emails).nome;
  return lancar('/api/contas/trocar', { conta: c.uuid }, `Pedindo a troca para ${nome}…`, `Trocar para ${nome}?\n\n${AVISO_DE_FECHAR}`);
}

function adicionar() {
  return lancar('/api/contas/adicionar', {}, 'Pedindo para adicionar conta…', 'Adicionar outra conta?\n\nO painel guarda a conta aberta agora, fecha o app e o abre na tela de entrada. Entre com a outra conta (código do e-mail); depois o app volta sozinho para a de agora. O app fecha 2 vezes.');
}

function sincronizar() {
  return lancar('/api/contas/sincronizar', {}, 'Pedindo para sincronizar a lista…', `Deixar a lista de conversas desta conta igual à das outras?\n\n${AVISO_DE_FECHAR}`);
}

async function cancelarAdicionar() {
  const r = await postar('/api/contas/cancelar');
  if (!r.ok) estado.falhaLocal = `Não cancelei: ${r.motivo}.`;
  await carregarContas();
}

async function lerCota() {
  $('b-uso').disabled = true;
  $('b-uso-aviso').disabled = true;
  const r = await postar('/api/contas/uso');
  if (!r.ok) estado.falhaLocal = `Não li a cota: ${r.motivo}.`;
  await carregarContas();
}

// ---- leitura ----

async function carregarContas() {
  try {
    estado.dados = await lerJson('/api/contas');
  } catch (e) {
    estado.dados = estado.dados ?? { contas: [], erro: e.message };
    estado.falhaLocal = 'O painel não respondeu; ele ainda está rodando no terminal?';
  }
  try { desenhar(); } finally { agendar(); } // o relógio se arma mesmo se o desenho falhar
}

async function carregarSessoes() {
  try { estado.sessoes = await lerJson('/api/sessoes'); } catch { /* a próxima volta tenta de novo */ }
  desenharSessoes();
}

/** O céu segue o botão de tema (`tema.json`, o mesmo da barra e do Painel): o ceu.js e o estilo.css trocam pelo `data-ceu`. */
async function conferirCeu() {
  try {
    const { ceu } = await lerJson('/api/ceu');
    if (ceu === 'dia' || ceu === 'noite') document.documentElement.dataset.ceu = ceu;
  } catch { /* fica o céu que está */ }
}

function agendar() {
  clearTimeout(relogio);
  const rapido = estado.dados?.andamento || estado.dados?.lendoUso;
  relogio = setTimeout(carregarContas, rapido ? INTERVALO_ATIVO_MS : INTERVALO_CALMO_MS);
}

// O céu é enfeite: carregado à parte, a falta ou o erro dele nunca derruba a tela.
(async () => {
  try {
    const { iniciarCeu } = await import('./ceu.js');
    iniciarCeu($('ceu'));
  } catch (e) {
    console.error('não consegui desenhar o céu do fundo', e);
  }
})();
ligarBotaoDeTema($('b-tema'), async (tema) => {
  const r = await postar('/api/tema', { tema });
  if (!r.ok) throw new Error(r.motivo);
});
$('b-adicionar').addEventListener('click', adicionar);
$('b-sincronizar').addEventListener('click', sincronizar);
$('b-uso').addEventListener('click', lerCota);
$('b-uso-aviso').addEventListener('click', lerCota);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { carregarContas(); carregarSessoes(); conferirCeu(); } });
setInterval(() => { carregarSessoes(); conferirCeu(); }, INTERVALO_SESSOES_MS);
carregarContas();
carregarSessoes();
