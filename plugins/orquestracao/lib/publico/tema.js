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
