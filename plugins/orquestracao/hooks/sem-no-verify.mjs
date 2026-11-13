#!/usr/bin/env node
// PreToolUse (Bash): pular os hooks do git pergunta antes. `--no-verify`, `-n` do commit e `-c core.hooksPath=` desligam
// a checagem que o projeto montou; o agente costuma usar para o commit passar em vez de consertar o que falhou.
// Ideia absorvida do ECC (block-no-verify, MIT, affaan-m/ECC 2.2.3); aqui pergunta em vez de bloquear.
import { fileURLToPath } from 'node:url';
import { lerEntrada, responder, rodar } from './comum.mjs';

const SEPARADORES = new Set(['&&', '||', ';', '|', '&', '\n']);
const PROFUNDIDADE_MAXIMA = 2;
// Opções do `git commit` que levam valor: o que vem colado depois delas num feixe (`-am`) é o valor, não mais opções.
const COMMIT_COM_VALOR = new Set(['m', 'F', 'C', 'c', 'S', 'u', 't']);
// Opções globais do git que levam o valor no token seguinte.
const GLOBAIS_COM_VALOR = new Set(['-C', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env']);

/** Quebra o comando em segmentos de tokens, respeitando aspas simples e duplas. */
export function segmentos(comando) {
  const saida = [];
  let seg = [];
  let atual = '';
  let aberto = false;
  let aspas = null;
  const fechaToken = () => { if (aberto) seg.push(atual); atual = ''; aberto = false; };
  const fechaSegmento = () => { fechaToken(); if (seg.length) saida.push(seg); seg = []; };
  const s = String(comando ?? '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (aspas) {
      if (c === aspas) aspas = null;
      else if (c === '\\' && aspas === '"' && i + 1 < s.length) atual += s[++i];
      else atual += c;
    } else if (c === "'" || c === '"') { aspas = c; aberto = true; }
    else if (c === '\\' && i + 1 < s.length) { atual += s[++i]; aberto = true; }
    else if (/\s/.test(c) && c !== '\n') fechaToken();
    else if (c === '\n' || c === ';' || c === '|' || c === '&') {
      fechaSegmento();
    } else { atual += c; aberto = true; }
  }
  fechaSegmento();
  return saida;
}

const feixeComN = (token) => {
  if (!/^-[A-Za-z]+$/.test(token)) return false;
  for (const letra of token.slice(1)) {
    if (letra === 'n') return true;
    if (COMMIT_COM_VALOR.has(letra)) return false;
  }
  return false;
};

function checarGit(tokens, indiceDoGit) {
  let hooksPath = false;
  let i = indiceDoGit + 1;
  for (; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === '-c') { if (/^core\.hookspath=/i.test(tokens[i + 1] ?? '')) hooksPath = true; i++; continue; }
    if (/^--config-env=core\.hookspath=/i.test(t)) { hooksPath = true; continue; }
    if (GLOBAIS_COM_VALOR.has(t)) { i++; continue; }
    if (t.startsWith('-')) continue;
    break;
  }
  const sub = tokens[i];
  if (sub !== 'commit' && sub !== 'push') return null;
  if (hooksPath) return '`-c core.hooksPath=` desliga os hooks do git';
  for (const t of tokens.slice(i + 1)) {
    if (t === '--no-verify') return `\`git ${sub} --no-verify\` pula os hooks do git`;
    if (sub === 'commit' && feixeComN(t)) return '`git commit -n` pula os hooks do git (é o mesmo que --no-verify)';
  }
  return null;
}

export function achar(comando, fundo = 0) {
  for (const tokens of segmentos(comando)) {
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i].split('/').pop() === 'git') {
        const achado = checarGit(tokens, i);
        if (achado) return achado;
      }
    }
    if (fundo < PROFUNDIDADE_MAXIMA) {
      for (const t of tokens) {
        if (/\bgit\b/.test(t) && /\s/.test(t)) {
          const achado = achar(t, fundo + 1);
          if (achado) return achado;
        }
      }
    }
  }
  return null;
}

export function decidir(entrada) {
  if (entrada.tool_name !== 'Bash') return null;
  const achado = achar(entrada.tool_input?.command);
  return achado ? `${achado}. Os hooks existem para pegar o erro antes do CI: conserte o que falhou. Aprove só se pular for o pedido.` : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('sem-no-verify', () => {
    const motivo = decidir(lerEntrada());
    if (motivo) responder('ask', motivo);
  });
}
