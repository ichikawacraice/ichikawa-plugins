#!/usr/bin/env node
// `trocar-conta`: troca a conta do app desktop do Claude mantendo a lista de conversas do Code. Nunca imprime token.
import { realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { criarApp, controleReal, escreverAtomico, pastaDeDados } from './app-do-claude.mjs';
import { criarTroca, ErroDeTroca } from './troca.mjs';
import { haParaImportar, importar, pastaDoKit } from './importar.mjs';

const USO = `uso:
  trocar-conta                         lista as contas salvas e a ativa (--json para máquina)
  trocar-conta <conta>                 troca para a conta (uuid, começo do uuid ou nome)
  trocar-conta adicionar               guarda a conta ativa e abre o Claude na tela de entrada
  trocar-conta adicionar --voltar      o mesmo, e depois de você entrar com a outra conta guarda o login dela e volta para a de antes
  trocar-conta nomear <conta> <nome>   dá um nome à conta
  trocar-conta sincronizar             deixa a lista de conversas da conta ativa igual à das outras contas
  trocar-conta enxugar                 mede o disco que a mesma conversa repetida na lista de cada conta ocupa
  trocar-conta enxugar --aplicar       devolve esse disco, sem mudar nenhuma conversa nem fechar o app
  trocar-conta importar-do-kit         copia os logins que o kit de orquestração já guardou (não mexe na origem)
  --sem-retomar                        não deixa o app continuar as conversas que a troca cortou`;

export function lerArgumentos(argv) {
  const pos = [];
  const o = { json: false, retomar: true, voltar: false, aplicar: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') o.json = true;
    else if (a === '--sem-retomar') o.retomar = false;
    else if (a === '--voltar') o.voltar = true;
    else if (a === '--aplicar') o.aplicar = true;
    else if (a === '--ajuda' || a === '-h' || a === '--help') o.ajuda = true;
    else if (a.startsWith('--')) return { erro: `argumento desconhecido: ${a}` };
    else pos.push(a);
  }
  return { ...o, pos };
}

const rotulo = (c) => `${c.ativa ? '*' : ' '} ${c.nome}  ${c.uuid}${c.salva ? '' : c.ativa ? '  (ativa, ainda não salva)' : '  (sem login salvo)'}`;

function resumo(r, reserva = '') {
  const linhas = [];
  if (r.entraram !== undefined) linhas.push(`${r.entraram} conversa(s) entraram na lista da conta`);
  else if (r.copiadas !== undefined) linhas.push(`${r.copiadas} conversa(s) copiada(s) para a lista da conta`);
  if (r.removidas > 0) linhas.push(`${r.removidas} conversa(s) apagada(s) em outra conta saíram da lista (cópia em ${reserva})`);
  if (r.cortadas?.length) linhas.push(`o Claude vai continuar ${r.cortadas.length} conversa(s) cortada(s) pelo fechamento: ${r.cortadas.map((c) => c.titulo || c.pasta || '(sem título)').join(', ')}`);
  return linhas;
}

/** As causas que a página sabe dizer com as palavras dela (`codigo` em `ultima-acao.json`); qualquer outra vira `outro`. */
const CODIGOS_DE_ERRO = ['formato', 'abriuNao', 'semLogin', 'repetido', 'semAtiva', 'prazo', 'cancelado', 'naoGuardou'];
const SINAIS = ['SIGINT', 'SIGTERM', 'SIGHUP'];

/** Enquanto a troca fecha e reabre o app, Ctrl-C ou fechar o terminal deixaria o Claude fechado: segura os sinais. */
function segurarSinais(erro) {
  const aviso = () => erro('  espere: a troca está no meio e o Claude ainda vai ser aberto de novo');
  for (const s of SINAIS) process.on(s, aviso);
  return () => { for (const s of SINAIS) process.off(s, aviso); };
}

/** No "adicionar e voltar" o sinal cancela a espera e o app volta para a conta de antes; o processo não morre no meio. */
function cancelarComSinais(erro, controlador) {
  const cancelar = () => { erro('  cancelando: o Claude volta para a conta de antes'); controlador.abort(); };
  for (const s of SINAIS) process.on(s, cancelar);
  return () => { for (const s of SINAIS) process.off(s, cancelar); };
}

/** Devolve o código de saída. `controle`, `app` e `adicionarOpcoes` (prazo, intervalo, `esperar`) entram nos testes; `env` aponta as pastas. */
export async function principal({ argv = [], env = process.env, saida: saidaReal = (t) => console.log(t), erro = (t) => console.error(t), controle, app, adicionarOpcoes = {} } = {}) {
  let ultimaLinha = '';
  const saida = (t) => { ultimaLinha = String(t); saidaReal(t); };
  let contaConhecida = null; // a conta ativa que o `sincronizar` leu antes de agir: a falha dele cai na linha dessa conta
  let acao = null; // o comando que age; listar e uso errado não deixam desfecho
  const comecar = (comando, voltar = false) => { acao = { comando, voltar, inicio: new Date().toISOString() }; };
  /** `ultima-acao.json`: o desfecho que a página lê. Falha ao gravar vai ao `erro` e não muda o código de saída. */
  const desfecho = (ok, mensagem, conta = null, codigo = null, voltarPara = undefined, extras = {}) => {
    if (!acao) return;
    try {
      // `voltarPara` (a conta de antes) só existe no "adicionar --voltar": é o que separa esse fluxo do `adicionar` sem volta.
      escreverAtomico(join(pastaDeDados(env), 'ultima-acao.json'), JSON.stringify({ comando: acao.comando, conta: conta || null, ...(acao.voltar && { voltarPara: voltarPara || null }), ok, codigo, ...extras, mensagem: String(mensagem ?? ''), inicio: acao.inicio, fim: new Date().toISOString(), pid: process.pid }, null, 2));
    } catch (e) { erro(`não gravei o desfecho da ação: ${e.message}`); }
  };
  const a = lerArgumentos(argv);
  if (a.erro) { erro(`${a.erro}\n${USO}`); return 2; }
  if (a.ajuda) { saida(USO); return 0; }
  if (a.voltar && a.pos[0] !== 'adicionar') { erro(`--voltar só vale com "adicionar"\n${USO}`); return 2; }
  if (a.aplicar && a.pos[0] !== 'enxugar') { erro(`--aplicar só vale com "enxugar"\n${USO}`); return 2; }
  let soltar = () => {};
  try {
    const troca = criarTroca({
      env,
      app: app ?? criarApp({ dir: env.CLAUDE_APP_DIR || undefined, controle: controle ?? controleReal() }),
      log: (t) => erro(`  ${t}`),
    });
    const [cmd, ...resto] = a.pos;
    const controlador = new AbortController();
    if (cmd === 'adicionar' && a.voltar) soltar = cancelarComSinais(erro, controlador);
    else if (cmd !== undefined && cmd !== 'nomear' && cmd !== 'enxugar' && cmd !== 'importar-do-kit') soltar = segurarSinais(erro);
    if (cmd === undefined) {
      const e = troca.estado();
      if (a.json) saida(JSON.stringify(e, null, 2));
      const importavel = haParaImportar({ origem: pastaDoKit(env), destino: pastaDeDados(env) });
      if (!a.json) {
        if (!e.contas.length && !importavel) saida('Nenhuma conta salva ainda. Use "trocar-conta adicionar" para guardar a conta de agora e entrar com outra.');
        for (const c of e.contas) saida(rotulo(c));
        if (importavel) saida('O kit de orquestração já tem logins guardados: rode "trocar-conta importar-do-kit" para trazê-los sem entrar de novo.');
      }
      return 0;
    }
    if (cmd === 'adicionar') {
      if (resto.length) { erro(USO); return 2; }
      comecar('adicionar', a.voltar);
      if (a.voltar) {
        const r = await troca.adicionar({ ...adicionarOpcoes, voltar: true, sinal: controlador.signal });
        for (const l of resumo(r)) saida(l);
        saida('Conta guardada; o Claude voltou para a conta de antes.');
        desfecho(true, ultimaLinha, r?.conta, null, r?.voltarPara);
        return 0;
      }
      const r = await troca.adicionar();
      saida('Conta guardada. O Claude abriu na tela de entrada: entre com a outra conta. Não use Sign out.');
      const mensagem = ultimaLinha;
      saida('Depois de entrar com a outra conta, rode "trocar-conta sincronizar" (ou use Sincronizar a lista no painel) para trazer a lista de conversas.');
      desfecho(true, mensagem, r?.conta);
      return 0;
    }
    if (cmd === 'sincronizar') {
      if (resto.length) { erro(USO); return 2; }
      comecar('sincronizar');
      try { contaConhecida = troca.estado().ativa || null; } catch { /* sem leitura boa, a falha fica sem conta */ }
      const r = await troca.sincronizar({ retomar: a.retomar });
      for (const l of resumo(r, join(pastaDeDados(env), 'lista-reserva'))) saida(l);
      saida('Lista sincronizada.');
      desfecho(true, ultimaLinha, r.conta, null, undefined, { entraram: r.entraram, removidas: r.removidas });
      return 0;
    }
    if (cmd === 'enxugar') {
      if (resto.length) { erro(USO); return 2; }
      // Sem `comecar`: o enxugo não troca de conta nem mexe no app, e a última ação que a página mostra é da troca.
      const r = troca.enxugar({ aplicar: a.aplicar });
      const mb = (b) => `${(b / 1_048_576).toFixed(1)} MB`;
      if (a.json) { saida(JSON.stringify(r, null, 2)); return r.recusa ? 1 : 0; }
      if (r.recusa) erro('Não consegui ler qual conta está em uso (o config.json do app está num formato que a troca não conhece, ou ninguém está logado), e o enxugo nunca reescreve a pasta da conta em uso. Só medi; rode de novo depois de entrar numa conta.');
      if (!r.copias && !r.naConta) saida(`Nada repetido: ${r.arquivos} conversa(s) na lista, nenhuma cópia.`);
      else {
        if (!a.aplicar || r.recusa) saida(`${r.arquivos} conversa(s) na lista, ${r.copias} cópia(s) repetida(s) de ${r.grupos} conversa(s): até ${mb(r.bytes)} de disco. Rode "trocar-conta enxugar --aplicar" para devolver.`);
        else {
          if (r.pulados) saida(`${r.pulados} cópia(s) ficaram como estavam (mudaram durante a varredura); rode de novo depois.`);
          saida(`${r.reclonados} de ${r.copias} cópia(s) re-clonada(s)${r.liberados > 0 ? `; o volume ficou com ${mb(r.liberados)} livres a mais` : ''}.`);
        }
        if (r.naConta) saida(`${r.naConta} cópia(s) (${mb(r.bytesNaConta)}) estão dentro da conta em uso e ficam como estão: é a pasta em que o app grava.`);
      }
      return r.recusa ? 1 : 0;
    }
    if (cmd === 'importar-do-kit') {
      if (resto.length) { erro(USO); return 2; }
      let r;
      try { r = importar({ origem: pastaDoKit(env), destino: pastaDeDados(env) }); } catch (e) { erro(`não importei: ${e.message}`); return 1; }
      saida(`Copiado de ${pastaDoKit(env)}: ${r.copiados.join(', ')}. A origem ficou como estava.`);
      for (const c of criarTroca({ env, app: app ?? criarApp({ dir: env.CLAUDE_APP_DIR || undefined, controle: controle ?? controleReal() }) }).estado().contas) saida(rotulo(c));
      return 0;
    }
    if (cmd === 'nomear') {
      if (resto.length < 2) { erro(USO); return 2; }
      comecar('nomear');
      const r = troca.nomear(resto[0], resto.slice(1).join(' '));
      saida(`Conta ${r.uuid} agora se chama ${r.nome}.`);
      desfecho(true, ultimaLinha, r.uuid);
      return 0;
    }
    if (resto.length) { erro(USO); return 2; }
    comecar('trocar');
    const r = await troca.trocar({ para: cmd, retomar: a.retomar });
    if (r.jaAtiva) { saida('Essa já é a conta ativa.'); desfecho(true, ultimaLinha, r.conta); return 0; }
    for (const l of resumo(r, join(pastaDeDados(env), 'lista-reserva'))) saida(l);
    saida('Conta trocada; o Claude foi aberto de novo.');
    desfecho(true, ultimaLinha, r.conta);
    return 0;
  } catch (e) {
    const mensagem = e instanceof ErroDeTroca ? e.message : `a troca falhou: ${e.message}`;
    erro(mensagem);
    if (e?.codigo !== 'ocupado') desfecho(false, mensagem, e?.codigo === 'abriuNao' ? e.conta : contaConhecida, CODIGOS_DE_ERRO.includes(e?.codigo) ? e.codigo : 'outro', e?.voltarPara); // a recusa por trava não apaga o desfecho da troca que roda
    return 1;
  } finally {
    soltar();
  }
}

const comoPrograma = (() => { try { return realpathSync(process.argv[1] ?? '') === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (comoPrograma) process.exitCode = await principal({ argv: process.argv.slice(2) });
