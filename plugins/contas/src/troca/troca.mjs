// Os fluxos da troca de conta: trocar, adicionar, sincronizar, nomear e o estado. Port de switcher.go (ver NOTICE),
// sem uso das contas, sem troca automática e sem projetos.
import { closeSync, existsSync, openSync, readFileSync, rmSync, statfsSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { criarApp, criarPasta, escreverAtomico, idSeguro, pastaDeDados, pastaDeProjetos } from './app-do-claude.mjs';
import { backup, limparLogin, restaurarBackup, restaurarPerfil, salvarPerfil } from './perfis.mjs';
import { conversasEmAndamento, enxugar, faltamPeloNome, gravarResiduo, limparMarca, organizacoesDa, sincronizar, tomarConversasCortadas } from './conversas.mjs';

/** Erro de uso: a mensagem já é para a pessoa. `codigo = 'ocupado'` marca a recusa por trava (outra troca em andamento). */
export class ErroDeTroca extends Error {}

/** Espera `ms` e acorda antes se o sinal abortar (nunca rejeita: quem espera olha o sinal depois). */
function esperarReal(ms, sinal) {
  return new Promise((resolve) => {
    if (sinal?.aborted) { resolve(); return; }
    let t;
    const fim = () => { clearTimeout(t); sinal?.removeEventListener('abort', fim); resolve(); };
    t = setTimeout(fim, ms);
    sinal?.addEventListener('abort', fim, { once: true });
  });
}

/**
 * @param {object} [o]
 * @param {object} [o.app]      a pasta do app (padrão: `criarApp()` pelas envs)
 * @param {string} [o.dados]    pasta de dados da troca (`TROCA_DE_CONTA_DIR`)
 * @param {string} [o.projetos] pasta `projects` do CLI do Claude
 * @param {() => number} [o.agora] relógio em ms
 * @param {(t: string) => void} [o.log]
 */
export function criarTroca({ env = process.env, app = criarApp({ dir: env.CLAUDE_APP_DIR || undefined }), dados = pastaDeDados(env), projetos = pastaDeProjetos(env), agora = () => Date.now(), log = () => {} } = {}) {
  const estadoPath = join(dados, 'estado.json');
  const perfilDir = (id) => join(dados, 'contas', id);
  const backupsDir = join(dados, 'backups');

  function lerEstado() {
    try {
      const e = JSON.parse(readFileSync(estadoPath, 'utf8'));
      const brutas = e && typeof e.contas === 'object' && e.contas ? e.contas : {};
      // Chave que não serve de nome de pasta viraria caminho fora de `contas/` e de `claude-code-sessions/`.
      const contas = Object.fromEntries(Object.entries(brutas).filter(([id, c]) => idSeguro(id) && c && typeof c === 'object'));
      return { contas, ativa: typeof e?.ativa === 'string' && idSeguro(e.ativa) ? e.ativa : '' };
    } catch { return { contas: {}, ativa: '' }; }
  }
  function gravarEstado(e) {
    criarPasta(dados);
    escreverAtomico(estadoPath, JSON.stringify(e, null, 2));
  }
  const salvo = (id) => existsSync(join(perfilDir(id), 'config.json'));

  /** uuid, começo do uuid ou nome (sem diferenciar maiúscula) → uuid; lança se não achar ou se for ambíguo. */
  function resolver(texto, candidatas) {
    const t = String(texto ?? '').trim().toLowerCase();
    if (!t) throw new ErroDeTroca('diga qual conta');
    const ids = Object.keys(candidatas);
    const exata = ids.filter((id) => id.toLowerCase() === t || String(candidatas[id].nome ?? '').toLowerCase() === t);
    const lista = exata.length ? exata : ids.filter((id) => id.toLowerCase().startsWith(t));
    if (lista.length === 0) throw new ErroDeTroca(`conta desconhecida: ${texto}`);
    if (lista.length > 1) throw new ErroDeTroca(`"${texto}" serve a mais de uma conta; use mais do uuid`);
    return lista[0];
  }

  /** A lista das contas salvas e qual está ativa agora (lida do app). Sem token. */
  function estado() {
    const e = lerEstado();
    const ativa = app.contaAtiva();
    const contas = Object.entries(e.contas).map(([uuid, c]) => ({ uuid, nome: c.nome || uuid.slice(0, 8), salvoEm: c.salvoEm ?? null, salva: salvo(uuid), ativa: uuid === ativa }));
    if (ativa && !e.contas[ativa]) contas.push({ uuid: ativa, nome: ativa.slice(0, 8), salvoEm: null, salva: false, ativa: true });
    return { ativa, contas };
  }

  function registrar(e, id) {
    e.contas[id] = { nome: e.contas[id]?.nome || id.slice(0, 8), salvoEm: new Date(agora()).toISOString() };
  }

  /**
   * Fecha o app, faz backup, roda `mudar(ativaAntes)` e abre o app de novo, aconteça o que acontecer depois do fechamento.
   * Erro em `mudar` volta o backup. Depois marca a retomada das conversas cortadas pelo fechamento.
   */
  async function reiniciar(mudar, { retomar = true } = {}) {
    app.lerConfig(); // formato inesperado recusa antes de fechar o app
    const soltar = travar();
    try { return await reiniciarTravado(mudar, retomar); } finally { soltar(); }
  }

  /** Uma troca por vez: a segunda salvaria como de uma conta o config de outra. Trava de processo morto é retomada. */
  function travar() {
    criarPasta(dados);
    const trava = join(dados, 'troca.lock');
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      let fd;
      try { fd = openSync(trava, 'wx', 0o600); } catch (err) {
        if (err.code !== 'EEXIST') throw err;
        const pid = Number.parseInt(readFileSync(trava, 'utf8'), 10);
        let vivo = false;
        if (Number.isInteger(pid) && pid > 0) { try { process.kill(pid, 0); vivo = true; } catch (e) { vivo = e.code === 'EPERM'; } }
        if (vivo) throw Object.assign(new ErroDeTroca(`outra troca está em andamento (processo ${pid}); espere ela terminar`), { codigo: 'ocupado' });
        rmSync(trava, { force: true });
        continue;
      }
      try { writeSync(fd, String(process.pid)); } finally { closeSync(fd); }
      return () => rmSync(trava, { force: true });
    }
    throw new ErroDeTroca('não consegui pegar a trava da troca; tente de novo');
  }

  /**
   * Com a trava já presa. `marca` ({ saiuEm, andamento }) é o fechamento de onde as conversas foram cortadas, quando a
   * retomada é de outro fechamento (o segundo do "adicionar e voltar"). Devolve `{ cortadas, saiuEm, andamento }` deste fechamento.
   */
  async function reiniciarTravado(mudar, retomar, marca = null) {
    const saiuEm = agora();
    const andamento = marca ? new Set() : conversasEmAndamento(projetos, saiuEm);
    log('fechando o Claude (pode levar até 30 s)…');
    await app.controle.fechar();
    let erro = null;
    let mudou = false;
    let cortadas = [];
    try {
      let bk;
      try { bk = backup(app, backupsDir, new Date(saiuEm)); } catch (err) { throw new Error(`backup: ${err.message}`); }
      try {
        mudar(app.contaAtiva());
        mudou = true;
      } catch (err) {
        erro = err;
        try { restaurarBackup(app, bk); } catch (rerr) {
          log(`volta do backup ${bk} falhou: ${rerr.message}`);
          erro = new Error(`${err.message} (a volta do backup também falhou: ${rerr.message}; o backup está em ${bk})`);
        }
      }
      try { cortadas = marcarRetomada(marca?.saiuEm ?? saiuEm, marca?.andamento ?? andamento, retomar); } catch (err) { log(`marca de retomada: ${err.message}`); }
    } catch (err) {
      erro = err;
    } finally {
      try { await app.controle.abrir(); } catch (err) {
        erro = erro ?? (mudou
          ? Object.assign(new ErroDeTroca(`a mudança foi feita, mas não consegui abrir o Claude (${err.message}); abra-o à mão, sem voltar o backup`), { codigo: 'abriuNao' })
          : new Error(`não consegui abrir o Claude: ${err.message}`));
      }
    }
    if (erro) {
      if (erro.codigo === 'abriuNao') erro.fechamento = { cortadas, saiuEm, andamento }; // o "adicionar e voltar" segue com ele
      throw erro;
    }
    return { cortadas, saiuEm, andamento };
  }

  function marcarRetomada(saiuEm, andamento, retomar) {
    let ativa;
    try { ativa = app.contaAtiva(); } catch { return []; }
    if (!ativa) return [];
    const raiz = app.sessoesDir();
    const orgs = organizacoesDa(raiz, ativa);
    if (!orgs.length) return [];
    const cortadas = tomarConversasCortadas(raiz, ativa, orgs, saiuEm, andamento, { log });
    if (retomar) return cortadas;
    for (const c of cortadas) { try { limparMarca(c.caminho); } catch (err) { log(`marca não tirada de ${c.caminho}: ${err.message}`); } }
    return [];
  }

  /**
   * Deixa a lista de conversas de cada pasta de organização da conta de destino igual à das outras contas (copia o que falta,
   * atualiza o que mudou, tira a apagada em outra conta para a reserva `lista-reserva/`). Sem saber qual organização o app
   * abre, todas recebem a lista; pasta que o app criar depois é preenchida na troca seguinte. `orgsAlternativas` (as da conta
   * que sai) valem se a de destino ainda não tem pasta: é palpite. Depois grava o resíduo da conta (`lista.json`): quantas
   * ainda faltam pelo nome, o que a página não deve avisar. Falha ao gravar só vai ao log.
   */
  function copiarLista(conta, orgsAlternativas = []) {
    const raiz = app.sessoesDir();
    const proprias = organizacoesDa(raiz, conta);
    const orgs = proprias.length ? proprias : orgsAlternativas;
    if (!proprias.length && orgs.length) log(`a conta ${conta.slice(0, 8)} ainda não tem pasta de organização; a lista vai para ${orgs.join(', ')} até o app criar a dela`);
    const reserva = join(dados, 'lista-reserva');
    let copiadas = 0;
    let removidas = 0;
    for (const org of orgs) {
      const r = sincronizar(raiz, conta, org, { log, reserva });
      copiadas += r.gravadas;
      removidas += r.removidas;
    }
    log(`${copiadas} entradas copiadas e ${removidas} removidas na conta ${conta.slice(0, 8)}`);
    const residuo = faltamPeloNome(raiz, conta).faltam;
    try { gravarResiduo(dados, conta, residuo); } catch (err) { log(`resíduo da lista não gravado: ${err.message}`); }
    return { copiadas, removidas, residuo };
  }

  async function trocar({ para, retomar = true } = {}) {
    const e = lerEstado();
    const id = resolver(para, e.contas);
    const ativa = app.contaAtiva();
    if (id === ativa) return { jaAtiva: true, conta: id, copiadas: 0, cortadas: [] };
    if (!salvo(id)) throw Object.assign(new ErroDeTroca(`a conta ${e.contas[id].nome} não tem login salvo; use "trocar-conta adicionar"`), { codigo: 'semLogin' });
    let copiadas = 0;
    let removidas = 0;
    const r = await reiniciar((ativaAntes) => {
      let orgsSaida = [];
      if (ativaAntes) {
        orgsSaida = organizacoesDa(app.sessoesDir(), ativaAntes);
        try { salvarPerfil(app, perfilDir(ativaAntes)); } catch (err) { throw new Error(`salvar o login atual: ${err.message}`); }
        registrar(e, ativaAntes);
      }
      try { restaurarPerfil(app, perfilDir(id)); } catch (err) { throw new Error(`restaurar o login: ${err.message}`); }
      ({ copiadas, removidas } = copiarLista(id, orgsSaida));
      e.ativa = id;
      gravarEstado(e);
    }, { retomar });
    return { jaAtiva: false, conta: id, copiadas, removidas, cortadas: r.cortadas };
  }

  /**
   * Guarda o login atual e abre o app na tela de entrada. Com `voltar`, espera a entrada com a outra conta, guarda o login
   * dela e volta para a conta de antes (o app fecha 2 vezes); sem conta de antes, recusa com `semAtiva`. Prazo e
   * cancelamento (`sinal`) também voltam para a de antes e lançam `ErroDeTroca` com `codigo` `prazo` ou `cancelado`; login novo que não deu para guardar volta
   * para a de antes e lança com `codigo` `naoGuardou`.
   * `esperar(ms, sinal)` entra nos testes.
   */
  async function adicionar({ voltar = false, prazoMs = 15 * 60_000, intervaloMs = 2000, assentarMs = 8000, sinal, esperar = esperarReal } = {}) {
    if (voltar) return adicionarEVoltar({ prazoMs, intervaloMs, assentarMs, sinal, esperar });
    const e = lerEstado();
    await reiniciar((ativaAntes) => {
      if (ativaAntes) {
        try { salvarPerfil(app, perfilDir(ativaAntes)); } catch (err) { throw new Error(`salvar o login atual: ${err.message}`); }
        registrar(e, ativaAntes);
      }
      limparLogin(app);
      e.ativa = '';
      gravarEstado(e);
    });
    return { conta: e.ativa };
  }

  /**
   * O que a página lê para saber em que fase está o "adicionar e voltar" (sem segredo). `faseDesde` é regravado a cada fase,
   * para a página contar o tempo por fase. Falha aqui não derruba a troca.
   */
  function marcarAdicionar(campos) {
    try { escreverAtomico(join(dados, 'adicionar.json'), JSON.stringify({ pid: process.pid, ...campos, faseDesde: new Date(agora()).toISOString() })); } catch (err) { log(`adicionar.json não gravado: ${err.message}`); }
  }

  async function adicionarEVoltar({ prazoMs, intervaloMs, assentarMs, sinal, esperar }) {
    app.lerConfig(); // formato inesperado recusa antes de fechar o app
    const soltar = travar();
    const arquivo = join(dados, 'adicionar.json');
    let antes = '';
    try {
      antes = app.contaAtiva();
      if (!antes) throw Object.assign(new ErroDeTroca('o app do Claude não está com nenhuma conta logada, então não há conta para onde voltar; entre no app com a sua conta e use "Adicionar conta" de novo'), { codigo: 'semAtiva' });
      const desde = new Date(agora()).toISOString();
      let prazoEm = null; // o prazo corre da espera, não do fechamento
      let abriuSozinho = true;
      const fase = (nome, extras = {}) => marcarAdicionar({ fase: nome, voltarPara: antes, desde, prazoEm, ...(abriuSozinho ? {} : { abriuSozinho: false }), ...extras });
      fase('fechando');
      const e = lerEstado();
      let um;
      try {
        um = await reiniciarTravado((ativaAntes) => {
          if (ativaAntes) {
            try { salvarPerfil(app, perfilDir(ativaAntes)); } catch (err) { throw new Error(`salvar o login atual: ${err.message}`); }
            registrar(e, ativaAntes);
          }
          limparLogin(app);
          e.ativa = '';
          gravarEstado(e);
        }, true);
      } catch (err) {
        // O login já foi apagado e guardado: a pessoa pode abrir o app à mão e entrar, então a espera segue.
        if (err?.codigo !== 'abriuNao' || !err.fechamento) throw err;
        um = err.fechamento;
        abriuSozinho = false;
        log('o Claude não abriu sozinho; abra-o à mão que a espera continua');
      }

      let motivo = null;
      let erroDaEspera = null;
      try {
        if (sinal?.aborted) motivo = 'cancelado';
        else {
          prazoEm = agora() + prazoMs;
          fase('esperando', { prazoEm: new Date(prazoEm).toISOString() });
          log('esperando a entrada na outra conta…');
          while (motivo === null) {
            if (sinal?.aborted) { motivo = 'cancelado'; break; }
            let entrou = '';
            try { entrou = app.contaAtiva(); } catch { /* o app pode estar no meio da escrita: ainda não */ }
            if (entrou) motivo = 'entrou';
            else if (agora() >= prazoEm) motivo = 'prazo';
            else await esperar(intervaloMs, sinal);
          }
        }
        const prazoIso = prazoEm === null ? null : new Date(prazoEm).toISOString();
        fase('voltando', { motivo, prazoEm: prazoIso }); // no instante em que a parada é decidida: o cancelar some da tela
        if (motivo === 'entrou') {
          log('entrada vista; esperando o app terminar de gravar o login…');
          await esperar(assentarMs); // dentro do voltando: sinal daqui em diante não muda nada
        }
      } catch (err) { erroDaEspera = err; }

      let novaConta = '';
      let naoGuardou = false;
      let dois;
      try {
        dois = await reiniciarTravado((ativaAgora) => {
          const e2 = lerEstado();
          if (ativaAgora) { // a conta que entrou (B), ou a de antes de novo (B igual a A): guarda o login mais novo
            // Falhar aqui não pode impedir a volta: o backup deste fechamento está em B, e lançar antes de restaurar A deixaria o app em B.
            try {
              salvarPerfil(app, perfilDir(ativaAgora));
              registrar(e2, ativaAgora);
              novaConta = ativaAgora;
            } catch (err) {
              naoGuardou = true;
              log(`não guardei a conta que entrou: ${err.message}`);
            }
          }
          try { restaurarPerfil(app, perfilDir(antes)); } catch (err) { throw new Error(`restaurar o login da conta de antes: ${err.message}`); }
          e2.ativa = antes;
          gravarEstado(e2);
        }, true, { saiuEm: um.saiuEm, andamento: um.andamento });
      } catch (err) {
        if (err?.codigo === 'abriuNao') err.conta = novaConta || null; // a mudança foi feita: a conta guardada vale mesmo sem o app abrir
        throw err;
      }

      // O desfecho é o que foi guardado, não o motivo da parada: sinal ou prazo depois da entrada guardam a conta nova.
      if (novaConta) return { conta: novaConta, igualAAnterior: novaConta === antes, voltarPara: antes, cortadas: dois.cortadas };
      if (naoGuardou) throw Object.assign(new ErroDeTroca('não consegui guardar o login da conta que entrou; o app voltou para a conta de antes'), { codigo: 'naoGuardou' });
      if (erroDaEspera) throw erroDaEspera;
      if (motivo === 'prazo') throw Object.assign(new ErroDeTroca(`a outra conta não entrou em ${Math.round(prazoMs / 60_000)} min; o app voltou para a conta de antes`), { codigo: 'prazo' });
      throw Object.assign(new ErroDeTroca('cancelado; o app voltou para a conta de antes'), { codigo: 'cancelado' });
    } catch (err) {
      if (err && typeof err === 'object') err.voltarPara = antes || null; // todo desfecho do "adicionar e voltar" diz para onde voltava
      throw err;
    } finally {
      try { rmSync(arquivo, { force: true }); } catch { /* sai com o processo morto: a página confere o pid */ }
      soltar();
    }
  }

  /**
   * Deixa a lista da conta ativa igual à das outras contas. `entraram` é quantas conversas passaram a aparecer nela: o que
   * faltava pelo nome antes menos o resíduo de depois (a só atualizada não conta).
   */
  async function sincronizarLista({ retomar = true } = {}) {
    const ativa = app.contaAtiva();
    if (!ativa) throw Object.assign(new ErroDeTroca('o app do Claude não está com nenhuma conta logada'), { codigo: 'semAtiva' });
    const antes = faltamPeloNome(app.sessoesDir(), ativa).faltam;
    let resultado = { copiadas: 0, removidas: 0, residuo: 0 };
    const r = await reiniciar((ativaAgora) => {
      if (!ativaAgora) throw new Error('nenhuma conta logada');
      resultado = copiarLista(ativaAgora);
    }, { retomar });
    return { conta: ativa, copiadas: resultado.copiadas, removidas: resultado.removidas, entraram: Math.max(0, antes - resultado.residuo), cortadas: r.cortadas };
  }

  function nomear(conta, nome) {
    const limpo = String(nome ?? '').trim();
    if (!limpo) throw new ErroDeTroca('diga o nome novo');
    const e = lerEstado();
    const ativa = app.contaAtiva();
    const candidatas = { ...e.contas };
    if (ativa && !candidatas[ativa]) candidatas[ativa] = { nome: ativa.slice(0, 8) };
    const id = resolver(conta, candidatas);
    if (!idSeguro(id)) throw new ErroDeTroca('uuid inválido');
    const igual = (a) => String(a).trim().toLocaleLowerCase('pt-BR') === limpo.toLocaleLowerCase('pt-BR');
    const outraTem = Object.entries(candidatas).some(([uuid, c]) => uuid !== id && igual(c.nome || uuid.slice(0, 8)));
    if (outraTem) throw Object.assign(new ErroDeTroca('esse nome já é de outra conta'), { codigo: 'repetido' });
    e.contas[id] = { nome: limpo, salvoEm: e.contas[id]?.salvoEm ?? null };
    gravarEstado(e);
    return { uuid: id, nome: limpo };
  }

  /**
   * Mede (e com `aplicar` desfaz) o disco gasto pela mesma conversa repetida na lista de cada conta. Não fecha o app: o
   * enxugo não muda um byte de conteúdo e nunca reescreve a pasta da conta logada — ela é a doadora dos clones, e é a
   * única pasta em que o app grava. `liberados` é a diferença de espaço livre do volume, que outro processo gravando ao
   * mesmo tempo também mexe: é o que se mediu, não promessa. Toma a trava: a troca copia as mesmas listas.
   */
  function enxugarListas({ aplicar = false } = {}) {
    let referencia = '';
    // Sem saber qual conta está em uso, toda pasta entraria como destino — inclusive a da conta logada, em que o app
    // grava. O enxugo então só mede e recusa o `--aplicar`: medir não mexe em nada.
    try { referencia = app.contaAtiva(); } catch { referencia = ''; }
    const fazer = aplicar && referencia !== '';
    const dir = app.sessoesDir();
    const livre = () => { try { const s = statfsSync(dir); return s.bavail * s.bsize; } catch { return null; } };
    const soltar = travar();
    try {
      const antes = fazer ? livre() : null;
      const r = enxugar(dir, { referencia, aplicar: fazer, log });
      const depois = fazer ? livre() : null;
      return {
        ...r,
        referencia,
        aplicado: fazer,
        recusa: aplicar && !fazer ? 'conta-em-uso-desconhecida' : null,
        liberados: antes === null || depois === null ? null : depois - antes,
      };
    } finally { soltar(); }
  }

  return { trocar, adicionar, sincronizar: sincronizarLista, nomear, estado, enxugar: enxugarListas };
}
