#!/usr/bin/env node
// SessionStart: injeta as regras do kit, o papel da sessão (herdado da passagem depois de um /clear), o modo ausente e as respostas da página
// ainda não lidas. Só lê; nada aqui trava.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as estado from '../lib/estado.mjs';
import { herdarPapel, lerEntrada, papelDe, rodar } from './comum.mjs';

const REGRAS = fileURLToPath(new URL('../regras.md', import.meta.url));

/** A raiz do repositório (a pasta com `.git`, arquivo ou pasta) subindo de `cwd`; `null` fora de um. */
function raizDoRepositorio(cwd) {
  for (let pasta = cwd; ; pasta = dirname(pasta)) {
    if (existsSync(join(pasta, '.git'))) return pasta;
    if (dirname(pasta) === pasta) return null;
  }
}

const lerOuVazio = (caminho) => { try { return readFileSync(caminho, 'utf8'); } catch { return ''; } };
const FRONTMATTER = /^---\n[\s\S]*?\n---\n/;

/**
 * O corpo da skill do papel, sem o frontmatter, para colar no início da sessão. Citar o nome não basta: a skill
 * carregada some na compactação e no reinício, e a sessão seguia sem ela (medido: orquestradora sem os selos depois
 * de cada compactação de 25/11). `null` se o papel não tem skill no kit.
 */
export function skillDoPapel(papel) {
  if (!/^[a-z-]+$/.test(papel ?? '')) return null;
  const texto = lerOuVazio(fileURLToPath(new URL(`../skills/${papel}/SKILL.md`, import.meta.url)));
  return texto ? texto.replace(FRONTMATTER, '').trim() : null;
}
const SEM_TESTE = /no test specified/;
const DECLARA_AFETADOS = /afetad|affected|vitest related|--changed|test:changed/i;

/**
 * Projeto com script de teste no `package.json` da raiz e `CLAUDE.md` que não declara o comando de testes afetados:
 * a linha que manda a sessão à `orquestracao:testes-enxutos` antes de rodar teste. `null` em qualquer outro caso.
 */
export function avisoDeTestes(cwd) {
  const raiz = raizDoRepositorio(cwd);
  if (!raiz) return null;
  let scripts;
  try { scripts = JSON.parse(lerOuVazio(join(raiz, 'package.json')))?.scripts; } catch { return null; }
  const teste = scripts?.test;
  if (typeof teste !== 'string' || SEM_TESTE.test(teste)) return null;
  const instrucoes = lerOuVazio(join(raiz, 'CLAUDE.md')) + lerOuVazio(join(raiz, '.claude', 'CLAUDE.md'));
  if (DECLARA_AFETADOS.test(instrucoes)) return null;
  return 'Este projeto tem testes, mas o `CLAUDE.md` não declara o comando de testes afetados: antes de rodar a suíte inteira durante o trabalho, siga o Diagnóstico de `orquestracao:testes-enxutos` e proponha ao operador o degrau que cabe (e as linhas do `CLAUDE.md`).';
}

export function contexto(entrada) {
  const partes = [readFileSync(REGRAS, 'utf8').trim()];
  if (entrada.session_id) partes.push(`ID desta sessão para \`perguntas papel\`: ${entrada.session_id}`);
  const projeto = estado.nomeDoProjeto(entrada.cwd || process.cwd());
  partes.push(`Sigla do projeto: **${estado.sigla(projeto)}** — itens e perguntas se escrevem \`${estado.sigla(projeto)}-F7\`, \`${estado.sigla(projeto)}-Q12\` em títulos e mensagens (o CLI aceita os dois).`);
  const herdado = herdarPapel(entrada);
  const papel = herdado ?? papelDe(entrada.session_id);
  if (papel) {
    const skill = skillDoPapel(papel);
    partes.push(skill
      ? `Papel desta sessão: **${papel}**. A skill \`orquestracao:${papel}\` vai abaixo, inteira, e vale a cada mensagem (não precisa carregá-la de novo):\n\n${skill}`
      : `Papel desta sessão: **${papel}** (siga a skill \`orquestracao:${papel}\`).`);
  }
  // A cada início (e depois de um /clear), a orquestradora se regrava: é para ela que vai a resposta de dona arquivada.
  if (papel === 'orquestradora') estado.gravarOrquestradora(projeto, estado.sessaoDoAppAtual());
  if (herdado) partes.push('Você acabou de ser limpa: o andamento está em `perguntas item listar` e `perguntas listar`. Não releia transcripts; responda ao que chegar.');
  const testes = avisoDeTestes(entrada.cwd || process.cwd());
  if (testes) partes.push(testes);
  const ausente = estado.lerAusente();
  if (ausente) partes.push(`O operador está AUSENTE desde ${ausente.desde ?? '?'}: pergunte pela página (\`perguntas nova\`), não pare esperando no chat; siga com o que não depende dele.`);
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
