#!/usr/bin/env node
// SessionStart: injeta as regras do kit, o papel da sessão, o modo ausente e as respostas da página
// ainda não lidas. Só lê; nada aqui trava.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as estado from '../lib/estado.mjs';
import { lerEntrada, papelDe, rodar } from './comum.mjs';

const REGRAS = fileURLToPath(new URL('../regras.md', import.meta.url));

export function contexto(entrada) {
  const partes = [readFileSync(REGRAS, 'utf8').trim()];
  if (entrada.session_id) partes.push(`ID desta sessão para \`perguntas papel\`: ${entrada.session_id}`);
  const papel = papelDe(entrada.session_id);
  if (papel) partes.push(`Papel desta sessão: **${papel}** (siga a skill \`orquestracao:${papel}\`).`);
  const ausente = estado.lerAusente();
  if (ausente) partes.push(`O operador está AUSENTE desde ${ausente.desde ?? '?'}: pergunte pela página (\`perguntas nova\`), não pare esperando no chat; siga com o que não depende dele.`);
  const projeto = estado.nomeDoProjeto(entrada.cwd || process.cwd());
  const novas = estado.listar('perguntas', projeto).filter((p) => p.estado === 'respondida' && p.lida === false);
  if (novas.length) partes.push(`Há ${novas.length} resposta(s) dada(s) pela página e não lida(s): rode \`perguntas novidades\`.`);
  return partes.join('\n\n');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('inicio', () => {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: contexto(lerEntrada()) },
    }));
  });
}
