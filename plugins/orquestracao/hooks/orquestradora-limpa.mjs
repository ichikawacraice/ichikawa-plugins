#!/usr/bin/env node
// Stop: quando o contexto da orquestradora passa do limite, pergunta ao operador numa caixa (`systemMessage`)
// se pode limpar e deixa a limpeza pendente. Não bloqueia: bloquear forçaria uma rodada extra do modelo.
// A limpeza só roda quando a mensagem do operador pede (hook orquestradora-limpa-na-mensagem): limpar sozinha
// apagava o texto que ele estava lendo e deixava as notas das donas presas até a próxima mensagem dele.
// O estado vive no `perguntas`; perder o histórico não perde nada. Avisa uma vez por degrau.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lerEntrada, limpezaPendenteDe, marcadorDe, papelDe, rodar, tokensDoContexto } from './comum.mjs';

const LIMITE_PADRAO = 150_000;
const DEGRAU = 40_000;
const MIL = 1_000;

const limite = () => Number(process.env.ORQUESTRADORA_LIMPA_EM) || LIMITE_PADRAO;

/** A saída do Stop (`{ systemMessage }`) quando é hora de avisar; null quando não. */
export function pedirLimpeza(entrada) {
  if (papelDe(entrada.session_id) !== 'orquestradora') return null;
  const tokens = tokensDoContexto(entrada.transcript_path);
  if (!tokens || tokens < limite()) return null;
  const aviso = `${marcadorDe(entrada.session_id)}.limpeza`;
  const anterior = existsSync(aviso) ? Number(readFileSync(aviso, 'utf8')) || 0 : 0;
  if (anterior && tokens < anterior + DEGRAU) return null;
  writeFileSync(aviso, String(tokens));
  writeFileSync(limpezaPendenteDe(entrada.session_id), String(tokens));
  return { systemMessage: `🧹 Contexto em ${Math.round(tokens / MIL)} mil tokens — posso limpar? Diga "limpa" quando terminar de ler (ou digite /clear)` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  rodar('orquestradora-limpa', () => {
    const saida = pedirLimpeza(lerEntrada());
    if (saida) process.stdout.write(JSON.stringify(saida));
  });
}
