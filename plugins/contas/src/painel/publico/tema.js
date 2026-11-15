// O botão de tema das páginas locais (base comum, copiada para o painel de cotas). Troca o `data-ceu` do `<html>` na
// hora (o céu e os tokens acompanham) e grava a escolha pelo `gravar` de cada página, no mesmo `tema.json` que a barra
// lê. Gravação falhou: volta o céu de antes e avisa no rótulo do botão.

const ROTULO = { noite: 'Mudar para o tema claro', dia: 'Mudar para o tema escuro' };
const ERRO = 'Não consegui gravar o tema; tente de novo.';

const ceuAtual = () => (document.documentElement.dataset.ceu === 'dia' ? 'dia' : 'noite');

/** O HTML do botão: o sol (leva ao claro) aparece no escuro e a lua (leva ao escuro) no claro, pelo estilo.css. */
export const BOTAO_DE_TEMA = '<button type="button" class="botao-tema" id="b-tema" aria-label="Mudar de tema">'
  + '<svg class="icone-sol" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">'
  + '<circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>'
  + '<svg class="icone-lua" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor">'
  + '<path d="M20.2 14.6A8.5 8.5 0 0 1 9.4 3.8a8.5 8.5 0 1 0 10.8 10.8z"/></svg></button>';

function rotular(botao, texto = ROTULO[ceuAtual()]) {
  botao.setAttribute('aria-label', texto);
  botao.title = texto;
}

/**
 * Liga o botão. `gravar(tema)` recebe `'claro'` ou `'escuro'` e rejeita se não gravou. Troca vinda de fora (o painel
 * de cotas relê o tema a cada 10 s) só atualiza o rótulo.
 */
export function ligarBotaoDeTema(botao, gravar) {
  if (!botao) return;
  rotular(botao);
  new MutationObserver(() => rotular(botao)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-ceu'] });
  botao.addEventListener('click', async () => {
    const antes = ceuAtual();
    const novo = antes === 'dia' ? 'noite' : 'dia';
    document.documentElement.dataset.ceu = novo;
    botao.disabled = true;
    try {
      await gravar(novo === 'dia' ? 'claro' : 'escuro');
    } catch {
      document.documentElement.dataset.ceu = antes;
      rotular(botao, ERRO);
    } finally {
      botao.disabled = false;
    }
  });
}

// ---- a gaveta de temas: o tema do Claude (`tema-do-app.json`, o céu atrás da conversa, que a barra relê a cada 2 s)
// e o tema do painel (`tema-do-painel.json`: ligado, o céu e o vidro; desligado, o layout do kit antigo), um a um ou os dois ----

const CHAVES = {
  app: { atributo: 'temaDoApp', nome: 'o tema do Claude' },
  painel: { atributo: 'temaDoPainel', nome: 'o tema do painel' },
};
const ligadoEm = (qual) => document.documentElement.dataset[CHAVES[qual].atributo] !== 'desligado';
const marcar = (qual, ligado) => { document.documentElement.dataset[CHAVES[qual].atributo] = ligado ? 'ligado' : 'desligado'; };

/** O botão do canto esquerdo do topo: abre a gaveta. O ícone é um céu (meia-lua sobre o horizonte). */
export const BOTAO_DE_TEMAS = '<button type="button" class="botao-tema botao-temas" id="b-temas" aria-haspopup="dialog" aria-controls="gaveta-temas" aria-label="Temas do Claude e do painel" title="Temas do Claude e do painel">'
  + '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
  + '<rect x="3" y="4" width="18" height="14" rx="3"/><path d="M3 15.5h18"/><path d="M14.5 7.2a3.2 3.2 0 1 0 2.6 4.8 2.6 2.6 0 0 1-2.6-4.8z" fill="currentColor" stroke="none"/>'
  + '<path d="M7 8.5v.01M9.5 11v.01M6.5 12.5v.01"/></svg></button>';

const chave = (qual, titulo, apoio) => `<label class="chave"><span class="chave-texto"><span class="chave-titulo">${titulo}</span><span class="chave-apoio">${apoio}</span></span>`
  + `<input type="checkbox" role="switch" class="chave-botao" data-chave="${qual}"></label>`;

/** A gaveta (um `<dialog>` que entra pela esquerda). Os servidores a põem logo depois do botão. */
export const GAVETA_DE_TEMAS = '<dialog class="gaveta" id="gaveta-temas" aria-labelledby="gaveta-temas-titulo"><div class="gaveta-dentro">'
  + '<div class="gaveta-cab"><h2 id="gaveta-temas-titulo">Temas</h2>'
  + '<button type="button" class="gaveta-fechar" aria-label="Fechar"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>'
  + '<div class="gaveta-chaves">'
  + chave('app', 'Tema do Claude', 'O céu atrás da conversa no app.')
  + chave('painel', 'Tema do painel', 'Céu, vidro e Geist no Painel e nas Contas. Desligado, o layout do kit antigo.')
  + '</div>'
  + chave('os-dois', 'Os dois', 'Liga ou desliga o do Claude e o do painel juntos.')
  + '<p class="gaveta-erro" role="alert" hidden></p></div></dialog>';

/**
 * Liga o botão e a gaveta. `gravar(qual, ligado)` recebe `'app'` ou `'painel'` e rejeita se não gravou; aí a chave volta
 * e a gaveta diz o que falhou. Troca vinda de fora (outra página, o recarregamento) só redesenha as chaves.
 */
export function ligarGavetaDeTemas(botao, gaveta, gravar) {
  if (!botao || !gaveta) return;
  const erro = gaveta.querySelector('.gaveta-erro');
  const entrada = (qual) => gaveta.querySelector(`[data-chave="${qual}"]`);
  const desenhar = () => {
    entrada('app').checked = ligadoEm('app');
    entrada('painel').checked = ligadoEm('painel');
    const dois = entrada('os-dois');
    dois.checked = ligadoEm('app') && ligadoEm('painel');
    dois.indeterminate = ligadoEm('app') !== ligadoEm('painel');
    botao.setAttribute('aria-expanded', String(gaveta.open));
  };
  const avisar = (texto) => { erro.textContent = texto; erro.hidden = !texto; };

  /** Troca as chaves pedidas na hora e grava; o que falhou volta. */
  const trocar = async (pedidos) => {
    const antes = Object.fromEntries(pedidos.map(([qual]) => [qual, ligadoEm(qual)]));
    for (const [qual, ligado] of pedidos) marcar(qual, ligado);
    avisar('');
    desenhar();
    const falhas = [];
    for (const [qual, ligado] of pedidos) {
      if (antes[qual] === ligado) continue;
      try { await gravar(qual, ligado); } catch { marcar(qual, antes[qual]); falhas.push(CHAVES[qual].nome); }
    }
    if (falhas.length) avisar(`Não consegui gravar ${falhas.join(' nem ')}; tente de novo.`);
    desenhar();
  };

  for (const qual of ['app', 'painel']) entrada(qual).addEventListener('change', (ev) => trocar([[qual, ev.target.checked]]));
  // "Os dois": misturado ou desligado, liga os dois; os dois ligados, desliga os dois.
  entrada('os-dois').addEventListener('change', () => {
    const ligar = !(ligadoEm('app') && ligadoEm('painel'));
    trocar([['app', ligar], ['painel', ligar]]);
  });
  botao.addEventListener('click', () => { desenhar(); gaveta.showModal(); desenhar(); });
  gaveta.querySelector('.gaveta-fechar').addEventListener('click', () => gaveta.close());
  // Clique fora do conteúdo (no fundo escurecido) fecha; Esc o navegador já fecha.
  gaveta.addEventListener('click', (ev) => { if (ev.target === gaveta) gaveta.close(); });
  gaveta.addEventListener('close', desenhar);
  new MutationObserver(desenhar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema-do-app', 'data-tema-do-painel'] });
  desenhar();
}
