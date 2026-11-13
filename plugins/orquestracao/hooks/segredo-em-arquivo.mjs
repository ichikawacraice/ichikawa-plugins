#!/usr/bin/env node
// PreToolUse (Write|Edit|MultiEdit e Bash): perguntar antes de gravar segredo de verdade em arquivo e antes de `git add .env`.
// Só padrão de alta confiança (chave AWS, token do GitHub, chave privada, JWT...): fica de fora `senha = ...`, `Bearer ...` e
// URL com credencial, que em fixture e doc geram ruído. `.env.example` é o lugar certo de exemplo e passa.
// A pergunta nomeia o padrão, nunca o valor. Ideia do ECC (governance-capture, MIT, affaan-m/ECC 2.2.3), que só registrava o
// achado; aqui pergunta. As expressões vêm de varredura-entre-sessoes.mjs.
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caminhoDe, lerEntrada, responder, rodar, textoGravado } from './comum.mjs';
import { SEGREDOS, segredosEm, nomesDe } from './varredura-entre-sessoes.mjs';
import { segmentos } from './sem-no-verify.mjs';

const FRACOS = new Set(['chave-valor', 'bearer-token', 'url-com-credencial']);
const FORTES = new Set(SEGREDOS.map(([nome]) => nome).filter((nome) => !FRACOS.has(nome)));
const ENV_REAL = /^\.env(?:\.[\w.-]+)?$/;
const ENV_DE_EXEMPLO = /\.(?:example|sample|template|dist)$/i;

const ehEnvReal = (nome) => ENV_REAL.test(nome) && !ENV_DE_EXEMPLO.test(nome);

function gravandoSegredo(entrada) {
  const p = caminhoDe(entrada);
  if (!p || (basename(p).startsWith('.env') && ENV_DE_EXEMPLO.test(basename(p)))) return null;
  const achados = textoGravado(entrada).flatMap((t) => segredosEm(t)).filter(({ padrao }) => FORTES.has(padrao));
  return achados.length ? `${basename(p)} receberia segredo (${nomesDe(achados)}). Segredo vai em variável de ambiente ou no gerenciador de segredos, não em arquivo do repositório; o exemplo vai em .env.example.` : null;
}

function addDeEnv(comando) {
  for (const tokens of segmentos(comando)) {
    const g = tokens.findIndex((t) => t.split('/').pop() === 'git');
    if (g < 0) continue;
    const i = tokens.indexOf('add', g);
    if (i < 0) continue;
    const env = tokens.slice(i + 1).filter((t) => !t.startsWith('-')).map((t) => basename(t)).find(ehEnvReal);
    if (env) return `git add de ${env}: arquivo .env guarda segredo e não entra no repositório. Para exemplo, use .env.example.`;
  }
  return null;
}

export function decidir(entrada) {
  if (entrada.tool_name === 'Bash') return addDeEnv(entrada.tool_input?.command);
  return gravandoSegredo(entrada);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('segredo-em-arquivo', () => {
    const motivo = decidir(lerEntrada());
    if (motivo) responder('ask', motivo);
  });
}
