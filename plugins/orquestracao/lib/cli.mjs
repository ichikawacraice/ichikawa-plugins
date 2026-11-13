#!/usr/bin/env node
// `perguntas`: as perguntas ao operador e os itens do projeto, um arquivo por registro.
// Uso: perguntas ajuda
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import * as estado from './estado.mjs';
import { abrirPagina, servir, PORTA_PADRAO } from './pagina.mjs';

const ETAPAS = new Set(['planejamento', 'execucao', 'revisao', 'pr', 'feito', 'parado', 'descartado']);
const DESFECHOS = { entregue: 'feito', parcial: 'feito', parado: 'parado' };

const AJUDA = `perguntas — perguntas ao operador e itens do projeto

  perguntas nova --titulo T --caso C --se-nao S --recomendacao R [--item F7] [--sessao local_…]
  perguntas responder Q12 "resposta"        grava a resposta dada no chat
  perguntas descartar Q12
  perguntas listar [--todas] [--json]       as abertas deste projeto (--todas: inclusive respondidas)
  perguntas novidades                       respostas dadas pela página ainda não lidas (e marca lidas)
  perguntas contar                          quantas abertas em todos os projetos
  perguntas item nova "título" [--sessao local_…]
  perguntas item etapa F7 <${[...ETAPAS].join('|')}> [--pr N] [--sessao local_…]
  perguntas item entregar F7 --desfecho <entregue|parcial|parado> --resultado R
            [--medido M] [--nao-medido N] [--proximo P ...] [--pr N]
                                            a dona grava ao terminar, logo antes de se arquivar
  perguntas item listar [--json]
  perguntas papel <orquestradora|nenhum> --sessao-id ID   marca o papel desta sessão (o ID vem do início da sessão)
  perguntas pagina [--abrir] [--porta ${PORTA_PADRAO}]

Opção comum: --projeto <nome> (padrão: a pasta do repositório principal).`;

const OPCOES = {
  titulo: { type: 'string' }, caso: { type: 'string' }, 'se-nao': { type: 'string' },
  recomendacao: { type: 'string' }, item: { type: 'string' }, sessao: { type: 'string' },
  projeto: { type: 'string' }, todas: { type: 'boolean' }, json: { type: 'boolean' },
  abrir: { type: 'boolean' }, porta: { type: 'string' }, pr: { type: 'string' },
  desfecho: { type: 'string' }, resultado: { type: 'string' }, medido: { type: 'string' },
  'nao-medido': { type: 'string' }, proximo: { type: 'string', multiple: true }, 'sessao-id': { type: 'string' },
};

const PAPEIS = new Set(['orquestradora', 'nenhum']);

function marcarPapel(papel, sessaoId) {
  if (!PAPEIS.has(papel) || !/^[\w-]{8,80}$/.test(sessaoId ?? '')) throw new Error('uso: perguntas papel <orquestradora|nenhum> --sessao-id ID');
  const pasta = join(estado.raiz(), 'papeis');
  const marcador = join(pasta, sessaoId);
  if (papel === 'nenhum') { rmSync(marcador, { force: true }); return 'papel removido'; }
  mkdirSync(pasta, { recursive: true });
  writeFileSync(marcador, `${papel}\n`);
  return `papel: ${papel}`;
}

function entregar(id, v, projeto) {
  if (!id) throw new Error('uso: perguntas item entregar F7 --desfecho <entregue|parcial|parado> --resultado R');
  if (!DESFECHOS[v.desfecho]) throw new Error(`--desfecho precisa ser ${Object.keys(DESFECHOS).join(', ')}`);
  if (!v.resultado?.trim()) throw new Error('faltou --resultado: o que mudou para quem usa (ou, se parou, o motivo)');
  const entrega = {
    desfecho: v.desfecho, resultado: v.resultado.trim(), medido: v.medido?.trim() || null,
    naoMedido: v['nao-medido']?.trim() || null, proximos: (v.proximo ?? []).map((p) => p.trim()).filter(Boolean),
    em: new Date().toISOString(),
  };
  const campos = { etapa: DESFECHOS[v.desfecho], entrega, ...(v.pr ? { pr: Number(v.pr) } : {}) };
  return estado.atualizar('itens', projeto, id, campos);
}

const linha = (p) => `${p.id} · ${p.titulo}${p.item ? ` (${p.item})` : ''} — ${p.estado}`;

function exigir(valores, nomes) {
  const faltam = nomes.filter((n) => !valores[n]?.trim());
  if (faltam.length) throw new Error(`faltou: ${faltam.map((n) => `--${n}`).join(', ')}. Pergunta vem inteira: caso, o que acontece se não decidir e a recomendação.`);
}

function cmdPergunta(acao, args, v, projeto, out) {
  if (acao === 'nova') {
    exigir(v, ['titulo', 'caso', 'se-nao', 'recomendacao']);
    const sessao = v.sessao ?? (v.item ? estado.ler('itens', projeto, v.item)?.sessao : null) ?? null;
    const p = estado.criar('perguntas', projeto, {
      titulo: v.titulo, caso: v.caso, seNaoDecidir: v['se-nao'], recomendacao: v.recomendacao,
      item: v.item ?? null, sessao, estado: 'aberta', resposta: null, respondidaEm: null,
    });
    out(p.id);
    return 0;
  }
  if (acao === 'responder' || acao === 'descartar') {
    const [id, resposta] = args;
    if (!id) throw new Error(`uso: perguntas ${acao} Q12${acao === 'responder' ? ' "resposta"' : ''}`);
    if (acao === 'responder' && !resposta?.trim()) throw new Error('a resposta não pode ser vazia');
    const campos = acao === 'responder'
      ? { estado: 'respondida', resposta, respondidaEm: new Date().toISOString(), lida: true }
      : { estado: 'descartada' };
    const p = estado.atualizar('perguntas', projeto, id, campos);
    if (!p) throw new Error(`${id} não existe em ${projeto}`);
    out(linha(p));
    return 0;
  }
  if (acao === 'listar') {
    const todas = estado.listar('perguntas', projeto).filter((p) => v.todas || p.estado === 'aberta');
    out(v.json ? JSON.stringify(todas, null, 2) : (todas.map(linha).join('\n') || 'nenhuma pergunta aberta'));
    return 0;
  }
  if (acao === 'novidades') {
    const novas = estado.listar('perguntas', projeto).filter((p) => p.estado === 'respondida' && p.lida === false);
    for (const p of novas) {
      estado.atualizar('perguntas', projeto, p.id, { lida: true });
      out(`${p.id} · ${p.titulo} → ${p.resposta}`);
    }
    if (!novas.length) out('nenhuma resposta nova');
    return 0;
  }
  if (acao === 'contar') {
    const n = estado.projetos().reduce((s, pr) => s + estado.listar('perguntas', pr).filter((p) => p.estado === 'aberta').length, 0);
    out(String(n));
    return 0;
  }
  return null;
}

function cmdItem(args, v, projeto, out) {
  const [acao, ...resto] = args;
  if (acao === 'nova') {
    const titulo = resto.join(' ').trim();
    if (!titulo) throw new Error('uso: perguntas item nova "título"');
    const it = estado.criar('itens', projeto, { titulo, etapa: 'planejamento', sessao: v.sessao ?? null, pr: null });
    out(it.id);
    return 0;
  }
  if (acao === 'etapa') {
    const [id, etapa] = resto;
    if (!id || !ETAPAS.has(etapa)) throw new Error(`uso: perguntas item etapa F7 <${[...ETAPAS].join('|')}>`);
    const campos = { etapa, ...(v.pr ? { pr: Number(v.pr) } : {}), ...(v.sessao ? { sessao: v.sessao } : {}) };
    const it = estado.atualizar('itens', projeto, id, campos);
    if (!it) throw new Error(`${id} não existe em ${projeto}`);
    out(`${it.id} · ${it.titulo} — ${it.etapa}`);
    return 0;
  }
  if (acao === 'entregar') {
    const it = entregar(resto[0], v, projeto);
    if (!it) throw new Error(`${resto[0]} não existe em ${projeto}`);
    out(`${it.id} · ${it.titulo} — ${it.entrega.desfecho}`);
    return 0;
  }
  if (acao === 'listar') {
    const itens = estado.listar('itens', projeto).filter((i) => !['feito', 'parado', 'descartado'].includes(i.etapa));
    out(v.json ? JSON.stringify(itens, null, 2) : (itens.map((i) => `${i.id} · ${i.titulo} — ${i.etapa}${i.pr ? ` · PR #${i.pr}` : ''}`).join('\n') || 'nenhum item aberto'));
    return 0;
  }
  return null;
}

export async function main(argv, out = (s) => process.stdout.write(`${s}\n`)) {
  const { values: v, positionals } = parseArgs({ args: argv, options: OPCOES, allowPositionals: true, strict: true });
  const [cmd, ...args] = positionals;
  if (!cmd || cmd === 'ajuda' || cmd === 'help') { out(AJUDA); return 0; }
  const projeto = v.projeto || estado.nomeDoProjeto();
  if (cmd === 'papel') { out(marcarPapel(args[0], v['sessao-id'])); return 0; }
  if (cmd === 'item') return cmdItem(args, v, projeto, out) ?? (out(AJUDA), 1);
  if (cmd === 'pagina') {
    const porta = Number(v.porta || PORTA_PADRAO);
    if (v.abrir) { out(await abrirPagina(porta)); return 0; }
    await servir(porta);
    return 0;
  }
  return cmdPergunta(cmd, args, v, projeto, out) ?? (out(AJUDA), 1);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (err) {
    process.stderr.write(`perguntas: ${err.message}\n`);
    process.exitCode = 1;
  }
}
