#!/usr/bin/env node
// Stop: rede de segurança das perguntas ao operador. Se o turno termina com bloco de decisão (`**D34 · …` ou
// `**IZA-Q9 · …`) que não está gravado no `perguntas`, devolve o turno à sessão uma vez, pedindo para gravar.
// A pergunta que só fica no chat não chega ao painel. Hook com erro deixa passar.
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as estado from '../lib/estado.mjs';
import { lerEntrada, rodar } from './comum.mjs';

const CAUDA_DO_TRANSCRIPT = 512 * 1024;
// Só no começo da linha (depois de marcador de lista, citação ou título): `**D34` ou `**IZA-Q9`.
const BLOCO = /^[ \t>#*+-]*\*\*(?:D(\d+)|([A-Z0-9]{3})-(Q\d+))\b/gm;
const GRAVA_PERGUNTA = /\bperguntas\s+nova\b/;

// Bloco `Dn` só conta quando pede decisão: recomendação no trecho dele (até o próximo bloco) ou `?` na linha do
// título, e a linha do título não diz que já foi decidido. Sem isso, a recapitulação (`**D19, aceito pelo operador:**`,
// `**D6 (assumida, a confirmar)**`) seria cobrada; decisão assumida não espera o operador e não vai à página.
const RECOMENDA = /recomend/i;
const JA_DECIDIDO = /aprovad|aceit|respondid|assumid|decidid|resolvid|mergead|gravad|descartad|fechad|na página/i;
const pedeDecisao = (trecho) => {
  const titulo = trecho.split('\n', 1)[0];
  return !JA_DECIDIDO.test(titulo) && (titulo.includes('?') || RECOMENDA.test(trecho));
};

/** Os blocos de decisão do texto, sem repetir: `{ d: 'D34' }` ou `{ sigla: 'IZA', id: 'Q9' }`. */
export function blocosDeDecisao(texto) {
  const t = String(texto ?? '');
  const achados = [...t.matchAll(BLOCO)];
  const vistos = new Map();
  achados.forEach((m, i) => {
    const trecho = t.slice(m.index, achados[i + 1]?.index ?? t.length);
    if (m[1] && !pedeDecisao(trecho)) return;
    const b = m[1] ? { d: `D${m[1]}` } : { sigla: m[2], id: m[3] };
    vistos.set(b.d ?? `${b.sigla}-${b.id}`, b);
  });
  return [...vistos.values()];
}

const conteudoEmLista = (e) => (Array.isArray(e?.message?.content) ? e.message.content : []);

/** O pedido de verdade do operador (ou de outra sessão), não o retorno de ferramenta nem nota do sistema. */
function ehPedido(e) {
  if (e?.type !== 'user' || e.isMeta || e.isSidechain) return false;
  const c = e.message?.content;
  if (typeof c === 'string') return true;
  return Array.isArray(c) && c.some((b) => b?.type === 'text') && !c.some((b) => b?.type === 'tool_result');
}

/** O turno atual pelo fim do transcript: o texto das respostas e os comandos de shell desde o último pedido. */
export function turnoAtual(transcriptPath) {
  let fd;
  try {
    fd = openSync(transcriptPath, 'r');
    const tamanho = fstatSync(fd).size;
    const n = Math.min(tamanho, CAUDA_DO_TRANSCRIPT);
    const buf = Buffer.alloc(n);
    readSync(fd, buf, 0, n, tamanho - n);
    const entradas = [];
    for (const linha of buf.toString('utf8').split('\n')) {
      try { entradas.push(JSON.parse(linha)); } catch { /* linha cortada no começo da cauda */ }
    }
    let inicio = 0;
    for (let i = entradas.length - 1; i >= 0; i -= 1) if (ehPedido(entradas[i])) { inicio = i + 1; break; }
    const textos = [];
    const comandos = [];
    for (const e of entradas.slice(inicio)) {
      if (e?.type !== 'assistant' || e.isSidechain) continue;
      for (const b of conteudoEmLista(e)) {
        if (b?.type === 'text') textos.push(b.text);
        if (b?.type === 'tool_use' && typeof b.input?.command === 'string') comandos.push(b.input.command);
      }
    }
    return { texto: textos.join('\n'), comandos };
  } catch {
    return { texto: '', comandos: [] };
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

/** A pergunta existe (em qualquer estado) num projeto que responde pela sigla. Sigla que o kit não conhece: não é nossa. */
export function gravada(sigla, id, projetoAtual) {
  const projetos = estado.projetosDaSigla(sigla, [projetoAtual]);
  if (!projetos.length) return true;
  return projetos.some((p) => estado.ler('perguntas', p, id));
}

/** Os rótulos dos blocos sem pergunta gravada. `Dn` vale como gravado se o turno rodou `perguntas nova` para cada um. */
export function semRegistro({ texto, comandos = [] }, projetoAtual) {
  const blocos = blocosDeDecisao(texto);
  const ds = blocos.filter((b) => b.d);
  const gravacoes = comandos.filter((c) => GRAVA_PERGUNTA.test(c)).length;
  const faltam = gravacoes >= ds.length ? [] : ds.map((b) => b.d);
  for (const b of blocos) if (!b.d && !gravada(b.sigla, b.id, projetoAtual)) faltam.push(`${b.sigla}-${b.id}`);
  return faltam;
}

/** A saída do Stop (`{ decision: 'block', reason }`) quando falta gravar; null quando não. */
export function cobrarRegistro(entrada) {
  if (entrada.stop_hook_active) return null;
  const projeto = estado.nomeDoProjeto(entrada.cwd || process.cwd());
  const turno = turnoAtual(entrada.transcript_path);
  if (typeof entrada.last_assistant_message === 'string' && !turno.texto.includes(entrada.last_assistant_message)) {
    turno.texto = `${turno.texto}\n${entrada.last_assistant_message}`;
  }
  const faltam = semRegistro(turno, projeto);
  if (!faltam.length) return null;
  const s = estado.sigla(projeto);
  return {
    decision: 'block',
    reason: `A sua mensagem traz decisão para o operador que não está na página: ${faltam.join(', ')}. `
      + `Pergunta que só fica no chat não chega ao painel. Grave cada uma agora com \`perguntas nova --titulo … --caso … --se-nao … --recomendacao … --item ${s}-Fn\` `
      + `e cite o id que ela imprimir (${s}-Qn) no lugar do número do chat. Se já estava gravada, só diga o id. `
      + 'Não repita a mensagem ao operador: uma linha com os ids basta.',
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('pergunta-no-painel', () => {
    const saida = cobrarRegistro(lerEntrada());
    if (saida) process.stdout.write(JSON.stringify(saida));
  });
}
