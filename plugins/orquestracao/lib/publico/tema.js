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

// ---- o tema do app: o céu atrás da conversa no Claude, ligado ou desligado (`tema-do-app.json`, que a barra relê a cada 2 s) ----

const ROTULO_DO_APP = { ligado: 'Desligar o tema do Claude (o céu atrás da conversa)', desligado: 'Ligar o tema do Claude (o céu atrás da conversa)' };
const ERRO_DO_APP = 'Não consegui gravar o tema do Claude; tente de novo.';

const appLigado = () => document.documentElement.dataset.temaDoApp !== 'desligado';

/** O HTML do botão do canto esquerdo: um céu (meia-lua sobre o horizonte). Desligado, fica apagado (estilo.css). */
export const BOTAO_DO_TEMA_DO_APP = '<button type="button" class="botao-tema botao-tema-do-app" id="b-tema-do-app" aria-label="Tema do Claude">'
  + '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">'
  + '<rect x="3" y="4" width="18" height="14" rx="3"/><path d="M3 15.5h18"/><path d="M14.5 7.2a3.2 3.2 0 1 0 2.6 4.8 2.6 2.6 0 0 1-2.6-4.8z" fill="currentColor" stroke="none"/>'
  + '<path d="M7 8.5v.01M9.5 11v.01M6.5 12.5v.01"/></svg></button>';

function rotularApp(botao, texto = ROTULO_DO_APP[appLigado() ? 'ligado' : 'desligado']) {
  botao.setAttribute('aria-label', texto);
  botao.setAttribute('aria-pressed', String(appLigado()));
  botao.title = texto;
}

/** Liga o botão do tema do app. `gravar(ligado)` recebe `true` ou `false` e rejeita se não gravou; aí o botão volta. */
export function ligarBotaoDoTemaDoApp(botao, gravar) {
  if (!botao) return;
  rotularApp(botao);
  new MutationObserver(() => rotularApp(botao)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema-do-app'] });
  botao.addEventListener('click', async () => {
    const antes = appLigado();
    document.documentElement.dataset.temaDoApp = antes ? 'desligado' : 'ligado';
    botao.disabled = true;
    try {
      await gravar(!antes);
    } catch {
      document.documentElement.dataset.temaDoApp = antes ? 'ligado' : 'desligado';
      rotularApp(botao, ERRO_DO_APP);
    } finally {
      botao.disabled = false;
    }
  });
}
