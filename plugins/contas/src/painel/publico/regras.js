// As regras puras da tela (sem DOM): o que cada número e cada estado vira em texto. Testadas em `test/regras.test.mjs`.
// Horários sempre no fuso de São Paulo.

const FUSO = 'America/Sao_Paulo';
export const USO_ALTO = 70;
export const USO_CRITICO = 90;

const paraMs = (v) => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v !== 'string') return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
};
const numero = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const formatoHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit', hour12: false });
const formatoDia = new Intl.DateTimeFormat('en-CA', { timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit' });
const formatoSemana = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, weekday: 'short' });
const formatoDiaMes = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });

export const horaSP = (ms) => formatoHora.format(ms);
const numeroDoDia = (ms) => Math.round(Date.parse(`${formatoDia.format(ms)}T00:00:00Z`) / 86_400_000);
const diaDaSemana = (ms) => formatoSemana.format(ms).replace('.', '');

/** `14:40` (hoje), `amanhã 01:10`, `sex 21:00` (até 6 dias), `sex 14/11 21:00` (7 ou mais); passado: `ontem 14:40`. */
export function quando(v, agoraMs) {
  const ms = paraMs(v);
  if (ms === null) return '';
  const hora = horaSP(ms);
  const dif = numeroDoDia(ms) - numeroDoDia(agoraMs);
  if (dif === 0) return hora;
  const dia = dif === 1 ? 'amanhã' : dif === -1 ? 'ontem' : Math.abs(dif) < 7 ? diaDaSemana(ms) : `${diaDaSemana(ms)} ${formatoDiaMes.format(ms)}`;
  return `${dia} ${hora}`;
}

/** `agora`, `há 3 min`, `há 2 h`, `há 4 dias`. */
export function haQuanto(v, agoraMs) {
  const ms = paraMs(v);
  if (ms === null) return '';
  const s = Math.max(0, Math.round((agoraMs - ms) / 1000));
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86_400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86_400);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

/** 0 a 100, inteiro; `null` sem número. */
export function percentual(v) {
  const n = numero(v);
  return n === null ? null : Math.min(100, Math.max(0, Math.floor(n)));
}

const NOMES = { sessao: 'Últimas 5 h', semana: 'Semana' };
/** O rótulo curto que cabe dentro da barra. */
const CURTOS = { sessao: '5 h', semana: 'Semana' };

/** As duas janelas de uma conta: `[{ chave, nome, curto, pct, tom, texto }]`. Janela que já zerou mostra 0%. */
export function janelas(uso, agoraMs) {
  if (!uso || typeof uso !== 'object') return [];
  const saida = [];
  for (const chave of ['sessao', 'semana']) {
    const lido = percentual(uso[chave]);
    if (lido === null) continue;
    const reinicia = paraMs(uso[`${chave}Reinicia`]);
    const zerou = reinicia !== null && reinicia <= agoraMs;
    const pct = zerou ? 0 : lido;
    const tom = pct >= USO_CRITICO ? 'critico' : pct >= USO_ALTO ? 'alto' : 'normal';
    let texto = `${pct}%`;
    if (zerou) texto += ' · zerou';
    else if (pct >= 100) texto += reinicia !== null ? ` · no limite até ${quando(reinicia, agoraMs)}` : ' · no limite';
    else if (reinicia !== null) texto += ` · zera ${quando(reinicia, agoraMs)}`;
    saida.push({ chave, nome: NOMES[chave], curto: CURTOS[chave], pct, tom, texto });
  }
  return saida;
}

const ERRO_DO_USO = {
  venceu: 'o login dessa conta venceu; troque para ela uma vez para renovar',
  limite: 'a Anthropic pediu para esperar antes de ler de novo',
  rede: 'sem rede para ler a cota',
  formato: 'a resposta da cota veio num formato desconhecido',
};
/** A frase da falha de leitura da cota de uma conta, ou ''. */
export const erroDoUso = (uso) => (uso && ERRO_DO_USO[uso.erro]) || '';

/** O nome que a linha mostra e o apoio (e-mail ou começo do uuid). */
export function identidade(conta, emails = {}) {
  const email = emails?.[conta.uuid] || null;
  const padrao = conta.uuid.slice(0, 8);
  const temNome = Boolean(conta.nome) && conta.nome !== padrao;
  return { nome: temNome ? conta.nome : email || padrao, apoio: temNome ? email || padrao : email ? padrao : '' };
}

/** A ativa primeiro; depois por nome. */
export const ordenarContas = (contas) => [...contas].sort((a, b) => Number(b.ativa) - Number(a.ativa) || String(a.nome).localeCompare(String(b.nome), 'pt-BR'));

/** O nome que a pessoa digitou: `{ ok, nome }` ou `{ ok: false, motivo }`. Mesmo nome de outra conta (sem caixa) recusa. */
export function validarNome(nome, uuid, contas) {
  const limpo = String(nome ?? '').trim();
  if (!limpo) return { ok: false, motivo: 'Escreva um nome.' };
  if (limpo.length > 60) return { ok: false, motivo: 'Até 60 caracteres.' };
  if (/[\u0000-\u001f\u007f]/.test(limpo)) return { ok: false, motivo: 'Sem caracteres de controle.' };
  const minusculo = limpo.toLowerCase();
  const outro = contas.find((c) => c.uuid !== uuid && (String(c.nome).toLowerCase() === minusculo || c.uuid.slice(0, 8).toLowerCase() === minusculo));
  if (outro) return { ok: false, motivo: 'Esse nome já é de outra conta.' };
  return { ok: true, nome: limpo };
}

/** O que a faixa de andamento diz enquanto uma troca roda. */
export function fraseDoAndamento(andamento, agoraMs, nomeDe = (u) => u) {
  if (!andamento) return '';
  if (andamento.comando === 'adicionar') {
    if (andamento.fase === 'esperando') {
      const prazo = andamento.prazoEm ? ` Espero até ${quando(andamento.prazoEm, agoraMs)}.` : '';
      return `Entre com a outra conta no app do Claude (código do e-mail). Depois ele volta sozinho para ${nomeDe(andamento.voltarPara)}.${prazo}`;
    }
    if (andamento.fase === 'voltando') return `Guardando a conta nova e voltando para ${nomeDe(andamento.voltarPara)}…`;
    return 'Fechando o app para abrir a tela de entrada…';
  }
  if (andamento.comando === 'trocar') return `Trocando para ${andamento.conta ? nomeDe(andamento.conta) : 'outra conta'}: o app fecha e abre de novo…`;
  if (andamento.comando === 'sincronizar') return 'Sincronizando a lista de conversas: o app fecha e abre de novo…';
  return 'Uma troca de conta está em andamento…';
}

const FALHA = {
  formato: 'O app do Claude mudou o formato do config.json; nada foi gravado.',
  abriuNao: 'A troca foi feita, mas o app não abriu sozinho. Abra o Claude à mão.',
  semLogin: 'Essa conta não tem login salvo. Entre com ela no app e use Adicionar conta.',
  repetido: 'Esse nome já é de outra conta.',
  semAtiva: 'O app do Claude está sem conta aberta.',
  prazo: 'Ninguém entrou a tempo; o app voltou para a conta de antes.',
  cancelado: 'Cancelado; o app voltou para a conta de antes.',
  naoGuardou: 'Não consegui guardar a conta nova; o app voltou para a de antes.',
};
const VERBO = { trocar: 'Troca', adicionar: 'Adicionar conta', sincronizar: 'Sincronizar', nomear: 'Dar nome' };

/** O desfecho da última ação: `{ tom, texto }` ou null. */
export function desfecho(ultima, agoraMs) {
  if (!ultima) return null;
  const verbo = VERBO[ultima.comando] ?? 'Ação';
  const quandoFoi = haQuanto(ultima.fim, agoraMs);
  if (ultima.ok) return { tom: 'ok', texto: `${verbo}: deu certo ${quandoFoi}. ${ultima.mensagem}`.trim() };
  return { tom: 'erro', texto: `${verbo}: falhou ${quandoFoi}. ${FALHA[ultima.codigo] ?? ultima.mensagem}`.trim() };
}

const CHAVE = {
  sem: 'Para ler a cota, o painel pede uma vez ao macOS a senha “Claude Safe Storage” do Keychain. Clique em Permitir (não em Permitir Sempre).',
  lendo: 'Lendo a cota de cada conta…',
  negada: 'O Keychain não liberou a senha; a cota não foi lida. Tente de novo e clique em Permitir.',
  pronta: '',
};
export const fraseDaChave = (chave) => CHAVE[chave] ?? '';

/** A partir de quanto tempo sem ler a cota a página pede, em destaque, para ler de novo. */
export const COTA_VELHA_MS = 30 * 60_000;

/**
 * O aviso do topo quando a cota precisa ser lida de novo: `{ tom: 'erro' | 'velha', titulo, texto }` ou `null`.
 * Só contam as contas que o painel consegue ler (a aberta no app ou com login salvo). Falha vence velhice; lendo agora, nada.
 */
export function avisoDaCota({ contas = [], uso = {}, lendoUso = false } = {}, agoraMs) {
  if (lendoUso) return null;
  const legiveis = contas.filter((c) => c.ativa || c.salva);
  if (!legiveis.length) return null;
  const usos = legiveis.map((c) => uso?.[c.uuid] ?? null);

  const comErro = usos.filter((u) => u && ERRO_DO_USO[u.erro]);
  if (comErro.length) {
    const limite = comErro.find((u) => u.erro === 'limite');
    const ate = limite ? paraMs(limite.tentarDepois) : null;
    const espera = ate !== null && ate > agoraMs ? ` Tente de novo a partir de ${quando(ate, agoraMs)}.` : '';
    const motivo = (limite ? ERRO_DO_USO.limite : ERRO_DO_USO[comErro[0].erro]);
    const quantas = comErro.length === 1 ? 'uma conta' : `${comErro.length} contas`;
    return { tom: 'erro', titulo: 'A última leitura da cota falhou', texto: `Em ${quantas}: ${motivo}.${espera} Os números abaixo podem estar velhos.` };
  }

  const lidos = usos.map((u) => paraMs(u?.lidoEm));
  if (lidos.every((ms) => ms === null)) return { tom: 'velha', titulo: 'Leia a cota', texto: 'A cota destas contas ainda não foi lida.' };
  const nuncaLida = lidos.some((ms) => ms === null);
  const maisVelha = Math.min(...lidos.filter((ms) => ms !== null));
  if (!nuncaLida && agoraMs - maisVelha < COTA_VELHA_MS) return null;
  const texto = nuncaLida ? 'Alguma conta ainda não teve a cota lida.' : `A cota foi lida ${haQuanto(maisVelha, agoraMs)}; os números abaixo podem estar velhos.`;
  return { tom: 'velha', titulo: 'Leia a cota de novo', texto };
}
