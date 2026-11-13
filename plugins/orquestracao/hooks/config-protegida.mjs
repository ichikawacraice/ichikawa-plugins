#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit): mexer na configuração de lint, formatador ou tipos que já existe pergunta antes.
// O agente costuma afrouxar a regra para o erro sumir; o certo é consertar o código.
// Lista absorvida do ECC (config-protection.js, MIT, affaan-m/ECC 2.2.3); aqui pergunta em vez de bloquear.
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { caminhoDe, lerEntrada, responder, rodar } from './comum.mjs';

const EXTENSOES = '(?:js|cjs|mjs|ts|cts|mts|json|jsonc|yml|yaml|toml)';
const PROTEGIDOS = [
  new RegExp(`^\\.eslintrc(?:\\.${EXTENSOES})?$`),
  new RegExp(`^eslint\\.config\\.${EXTENSOES}$`),
  new RegExp(`^\\.prettierrc(?:\\.${EXTENSOES})?$`),
  new RegExp(`^prettier\\.config\\.${EXTENSOES}$`),
  /^\.?biome\.jsonc?$/,
  /^\.?ruff\.toml$/,
  /^\.shellcheckrc$/,
  new RegExp(`^\\.stylelintrc(?:\\.${EXTENSOES})?$`),
  new RegExp(`^stylelint\\.config\\.${EXTENSOES}$`),
  new RegExp(`^\\.markdownlint(?:\\.${EXTENSOES})?$`),
  /^\.(?:eslint|prettier|stylelint|markdownlint)ignore$/,
  /^tsconfig(?:\.[\w-]+)?\.json$/,
];

export function decidir(entrada) {
  const p = caminhoDe(entrada);
  if (!p || !existsSync(p)) return null;
  const nome = basename(p);
  if (!PROTEGIDOS.some((r) => r.test(nome))) return null;
  return `${nome} é configuração de checagem. Conserte o código em vez de afrouxar a regra; aprove só se mudar a regra é o pedido.`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('config-protegida', () => {
    const motivo = decidir(lerEntrada());
    if (motivo) responder('ask', motivo);
  });
}
