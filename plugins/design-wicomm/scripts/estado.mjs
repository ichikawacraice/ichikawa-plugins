#!/usr/bin/env node
/**
 * **O estado de um projeto no sistema Wicomm: versão, deriva e nota.** É o que o `/design-wicomm:estado` mostra.
 *
 *   node estado.mjs <raiz> [--json]
 *
 * - **Versão:** a do `design/design-system.json` contra a da base do plugin instalado.
 * - **Base no projeto:** cada documento de `design/` foi editado no projeto (difere do ancestral em `design/.base/`)?
 * - **Peças:** cada peça anotada em `pecas` (`{ "<nome>": { "arquivo": "...", "hash": "<sha256>", "versao": "..." } }`)
 *   ainda tem o hash com que foi instalada? Peça editada no projeto é deriva (devia ter voltado ao registro).
 * - **Nota:** a média das últimas 10 críticas gravadas na pasta de revisões (linha `Nota: N/30` ou `N/35`), em % do teto.
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ARQUIVOS, hash, versaoDaBase } from "./base-do-projeto.mjs";
import { arquivoDoProjeto, configDoProjeto } from "../hooks/config.mjs";

/** As notas das revisões: a última `Nota: N/M` de cada arquivo, em ordem de nome (a data vem primeiro no nome). */
export function notas(pasta) {
  if (!existsSync(pasta)) return [];
  return readdirSync(pasta)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const todas = [...readFileSync(join(pasta, f), "utf-8").matchAll(/^Nota:\s*\*{0,2}(\d+(?:[.,]\d+)?)\s*\/\s*(30|35)\b/gm)];
      const ultima = todas.at(-1);
      return ultima ? { arquivo: f, nota: Number(ultima[1].replace(",", ".")), de: Number(ultima[2]) } : null;
    })
    .filter(Boolean);
}

export function estado(raiz, versaoDoPlugin = versaoDaBase()) {
  const config = configDoProjeto(raiz);
  const versao = typeof config.versao === "string" ? config.versao : null;
  const base = ARQUIVOS.map((f) => {
    const doProjeto = join(raiz, "design", f);
    const ancestral = join(raiz, "design", ".base", f);
    if (!existsSync(doProjeto)) return { arquivo: f, situacao: "ausente" };
    if (!existsSync(ancestral)) return { arquivo: f, situacao: "sem ancestral" };
    return { arquivo: f, situacao: readFileSync(doProjeto, "utf-8") === readFileSync(ancestral, "utf-8") ? "igual à base" : "editado no projeto" };
  });
  const pecas = Object.entries(config.pecas && typeof config.pecas === "object" ? config.pecas : {}).map(([nome, p]) => {
    const arquivo = typeof p?.arquivo === "string" ? join(raiz, p.arquivo) : null;
    if (!arquivo || !existsSync(arquivo)) return { nome, situacao: "arquivo ausente" };
    return { nome, versao: p.versao ?? null, situacao: hash(readFileSync(arquivo, "utf-8")) === p.hash ? "como instalada" : "editada no projeto" };
  });
  const revisoes = join(raiz, typeof config.revisoes === "string" ? config.revisoes : join("docs", "design", "revisoes"));
  const ultimas = notas(revisoes).slice(-10);
  const media = ultimas.length ? ultimas.reduce((s, n) => s + n.nota / n.de, 0) / ultimas.length : null;
  return {
    configurado: config.temArquivo,
    // O arquivo de configuração que vale (o nome novo, ou o antigo `design/wicomm.json` no projeto que só tem esse).
    arquivo: relative(raiz, arquivoDoProjeto(raiz)).split(sep).join("/"),
    versao,
    versaoDoPlugin,
    atrasado: Boolean(versao && versao !== versaoDoPlugin),
    densidade: config.densidade ?? null,
    // App misto (instrumento por dentro, site no link público): a densidade de cada rota, por padrão de caminho.
    densidadePorRota: config.densidadePorRota && typeof config.densidadePorRota === "object" ? config.densidadePorRota : null,
    base,
    pecas,
    notas: ultimas,
    mediaPct: media === null ? null : Math.round(media * 1000) / 10,
    acimaDoTeto: media === null ? null : media >= 0.8,
  };
}

export function emMarkdown(e) {
  if (!e.configurado) return "Este projeto não tem `design/design-system.json` (nem o nome antigo, `design/wicomm.json`): ainda não entrou no sistema Wicomm. Projeto novo → `/design-wicomm:novo`; existente → `/design-wicomm:auditar`.";
  const editadas = e.pecas.filter((p) => p.situacao !== "como instalada");
  return [
    "## Estado no sistema Wicomm",
    "",
    `- **Configuração:** \`${e.arquivo}\` (é nele que se lê e se grava)`,
    `- **Versão:** ${e.versao ?? "não estampada"} (plugin: ${e.versaoDoPlugin})${e.atrasado ? " — **atrasado**: rode `/design-wicomm:atualizar`" : ""}`,
    `- **Densidade:** ${e.densidade ?? "não declarada"}${e.densidadePorRota ? ` · por rota: ${Object.entries(e.densidadePorRota).map(([rota, d]) => `\`${rota}\` ${["instrumento", "site"].includes(d) ? d : `**${d}** (inválida: instrumento ou site)`}`).join(", ")}` : ""}`,
    `- **Base no projeto:** ${e.base.map((b) => `${b.arquivo} ${b.situacao}`).join(" · ")}`,
    `- **Peças anotadas:** ${e.pecas.length}${editadas.length ? ` — **${editadas.length} com deriva:** ${editadas.map((p) => `${p.nome} (${p.situacao})`).join(", ")}` : e.pecas.length ? " — todas como instaladas" : ""}`,
    `- **Nota das últimas ${e.notas.length} críticas:** ${e.mediaPct === null ? "nenhuma crítica gravada" : `${e.mediaPct}% (teto 80%) ${e.acimaDoTeto ? "— no teto ou acima" : "— **abaixo do teto**"}`}`,
  ].join("\n");
}

const real = (c) => {
  try {
    return realpathSync(c);
  } catch {
    return null;
  }
};
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  const [raiz, flag] = process.argv.slice(2);
  try {
    if (!raiz || !existsSync(raiz)) throw new Error("uso: node estado.mjs <raiz do projeto> [--json]");
    const e = estado(raiz);
    process.stdout.write(flag === "--json" ? JSON.stringify(e, null, 2) + "\n" : emMarkdown(e) + "\n");
  } catch (err) {
    console.error(`[estado] ${err.message}`);
    process.exitCode = 2;
  }
}
