// Traz para cá os logins guardados por uma instalação anterior (a pasta de dados do kit de orquestração), para não
// precisar entrar de novo com cada conta. Copia, nunca move: a pasta de origem fica como estava. Nada aqui decifra token.
import { chmodSync, cpSync, existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { criarPasta } from './app-do-claude.mjs';

/** Onde o kit guardava os logins. `TROCA_IMPORTAR_DE` troca a origem (os testes usam). */
export const pastaDoKit = (env = process.env) => env.TROCA_IMPORTAR_DE || join(homedir(), '.claude', 'orquestracao', 'troca-de-conta');

/** O que vem: os logins, os nomes, o último uso lido e o resíduo da lista. Backups, travas e logs ficam lá. */
export const ITENS = ['contas', 'uso.json', 'lista.json', 'estado.json']; // estado.json por último: é ele que diz "já importado"

/** Há o que importar? (origem com `estado.json` e destino sem). */
export function haParaImportar({ origem, destino }) {
  return existsSync(join(origem, 'estado.json')) && !existsSync(join(destino, 'estado.json'));
}

/**
 * Copia os itens de `origem` para `destino`. Recusa (`codigo`) se a origem não tem `estado.json` (`semOrigem`) ou se o
 * destino já tem (`jaTem`): misturar dois estados perderia nomes ou logins. Devolve `{ copiados: [...] }`.
 */
export function importar({ origem, destino }) {
  if (!existsSync(join(origem, 'estado.json'))) throw Object.assign(new Error(`não achei logins guardados em ${origem}`), { codigo: 'semOrigem' });
  if (existsSync(join(destino, 'estado.json'))) throw Object.assign(new Error(`${destino} já tem contas guardadas; nada foi copiado`), { codigo: 'jaTem' });
  criarPasta(destino);
  const copiados = [];
  for (const item of ITENS) {
    const de = join(origem, item);
    if (!existsSync(de)) continue;
    // Sobrescreve o que o painel já tenha gravado aqui (o uso lido, uma cópia que parou no meio): sem `estado.json` o destino
    // ainda não tem contas próprias, e o `estado.json` vem por último, então rodar de novo depois de uma falha termina a cópia.
    cpSync(de, join(destino, item), { recursive: true, preserveTimestamps: true, force: true });
    copiados.push(item);
  }
  fecharPermissoes(destino);
  return { copiados };
}

/** O `cpSync` leva a permissão da origem; aqui moram logins: pastas 0700, arquivos 0600. */
function fecharPermissoes(caminho) {
  if (statSync(caminho).isDirectory()) {
    chmodSync(caminho, 0o700);
    for (const n of readdirSync(caminho)) fecharPermissoes(join(caminho, n));
  } else chmodSync(caminho, 0o600);
}
