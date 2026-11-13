#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): avisa, sem bloquear, quando a edição acrescenta `console.log` em código de produto
// (.ts .tsx .js .jsx .mjs). Teste, script, configuração, bin e cli ficam de fora: lá o console é a saída.
// Troca o hook de Stop do ECC (check-console-log, MIT, affaan-m/ECC 2.2.3) por um aviso na hora da edição.
import { fileURLToPath } from 'node:url';
import { avisar, caminhoDe, lerEntrada, rodar, textoGravado } from './comum.mjs';

const CODIGO = /\.(?:tsx?|jsx?|mjs)$/;
const FORA = [/\.(?:test|spec)\./, /(?:^|\/)(?:scripts|bin|cli|__tests__)\//, /\.config\./, /(?:^|\/)cli[.-][^/]*$/];
const CONSOLE_LOG = /^(?!\s*(?:\/\/|\*)).*\bconsole\.log\s*\(/gm;

export function decidir(entrada) {
  const p = caminhoDe(entrada);
  if (!p || !CODIGO.test(p) || FORA.some((r) => r.test(p))) return null;
  const n = textoGravado(entrada).reduce((soma, t) => soma + (t.match(CONSOLE_LOG)?.length ?? 0), 0);
  if (!n) return null;
  return `Aviso: esta edição deixou ${n} console.log em ${p.split('/').slice(-2).join('/')}. Tire antes do PR, ou troque pelo logger do projeto se o log é para ficar.`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('aviso-console-log', () => {
    const aviso = decidir(lerEntrada());
    if (aviso) avisar(aviso);
  });
}
