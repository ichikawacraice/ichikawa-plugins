#!/usr/bin/env node
/**
 * **A base no projeto: copiada com a versão estampada, e atualizada por merge de três vias.**
 *
 *   node base-do-projeto.mjs estampar  <raiz> [--densidade instrumento|site] [--pasta <front>]
 *   node base-do-projeto.mjs atualizar <raiz> [--resolvido]
 *
 * `estampar` (bootstrap, skill `novo-projeto`): copia `DESIGN.md`, `ANATOMIA.md` e `CONVENCOES.md` da base do plugin
 * para `design/` do projeto, guarda a cópia intocada em `design/.base/` (o ancestral do próximo merge) e escreve ou
 * completa o `design/design-system.json` com `versao`, `densidade`, `pasta` e o hash de cada arquivo. Nunca sobrescreve um
 * documento que o projeto já tem: ele fica, e a base do plugin vira o ancestral dele (o `estado` o mostra "editado no
 * projeto", e o próximo `atualizar` mescla a partir daí).
 *
 * `atualizar` (skill `atualizar-sistema`): para cada arquivo, `git merge-file` entre a cópia do projeto (com o que o
 * projeto acrescentou), o ancestral (`design/.base/`) e a base nova do plugin. Sem conflito, grava e sobe a versão;
 * com conflito, grava o arquivo com os marcadores, lista os conflitos e NÃO sobe a versão (sai 1). Resolvidos os
 * marcadores à mão (inclusive ficando com o lado do projeto), `atualizar --resolvido` aceita o arquivo do projeto como
 * mesclado, troca o ancestral pela base nova e sobe a versão — sem isso o mesmo trecho conflitaria para sempre.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { arquivoDoProjeto } from "../hooks/config.mjs";

export const BASE_DO_PLUGIN = join(dirname(fileURLToPath(import.meta.url)), "..", "base");
export const ARQUIVOS = ["DESIGN.md", "ANATOMIA.md", "CONVENCOES.md"];
export const DENSIDADES = ["instrumento", "site"];

export const hash = (texto) => createHash("sha256").update(texto).digest("hex");

/** A versão no frontmatter de um documento da base (`versao: 1.2.3`). */
export function versaoDe(texto) {
  return String(texto).match(/^---\n[\s\S]*?^versao:\s*([\w.-]+)\s*$/m)?.[1] ?? null;
}

/** A versão da base do plugin; os três arquivos têm de concordar (a base muda a versão nos três). */
export function versaoDaBase(base = BASE_DO_PLUGIN) {
  const versoes = new Set(ARQUIVOS.map((f) => versaoDe(readFileSync(join(base, f), "utf-8"))));
  if (versoes.size !== 1 || versoes.has(null)) throw new Error(`a base do plugin tem versões diferentes ou ausentes: ${[...versoes].join(", ")}`);
  return [...versoes][0];
}

const lerConfig = (raiz) => {
  const c = arquivoDoProjeto(raiz);
  if (!existsSync(c)) return {};
  try {
    return JSON.parse(readFileSync(c, "utf-8"));
  } catch (e) {
    throw new Error(`${c} ilegível: ${e.message}`);
  }
};
const gravarConfig = (raiz, config) => writeFileSync(arquivoDoProjeto(raiz), JSON.stringify(config, null, 2) + "\n");

/** Copia a base para `design/` e estampa a versão. Devolve `{ versao, copiados, mantidos }`. */
export function estampar(raiz, { densidade, pasta } = {}, base = BASE_DO_PLUGIN) {
  if (densidade !== undefined && !DENSIDADES.includes(densidade)) throw new Error(`densidade deve ser ${DENSIDADES.join(" ou ")}, veio ${densidade}`);
  const versao = versaoDaBase(base);
  mkdirSync(join(raiz, "design", ".base"), { recursive: true });
  const config = lerConfig(raiz);
  const copiados = [];
  const mantidos = [];
  const hashes = { ...(config.base ?? {}) };
  for (const f of ARQUIVOS) {
    const destino = join(raiz, "design", f);
    const ancestral = join(raiz, "design", ".base", f);
    if (existsSync(destino)) {
      if (!existsSync(ancestral)) {
        copyFileSync(join(base, f), ancestral);
        hashes[f] = hash(readFileSync(join(base, f), "utf-8"));
      }
      mantidos.push(f);
      continue;
    }
    copyFileSync(join(base, f), destino);
    copyFileSync(join(base, f), join(raiz, "design", ".base", f));
    hashes[f] = hash(readFileSync(join(base, f), "utf-8"));
    copiados.push(f);
  }
  // O que o projeto já tinha vence o padrão; o que a linha de comando diz vence o projeto.
  const novo = { versao, densidade: "instrumento", ...config, base: hashes };
  if (densidade !== undefined) novo.densidade = densidade;
  if (pasta !== undefined) novo.pasta = pasta;
  gravarConfig(raiz, novo);
  return { versao: novo.versao, copiados, mantidos };
}

const temMarcador = (caminho) => existsSync(caminho) && /^(<{7}|>{7}) /m.test(readFileSync(caminho, "utf-8"));
const hashesDoAncestral = (raiz) => Object.fromEntries(ARQUIVOS.map((f) => [f, hash(readFileSync(join(raiz, "design", ".base", f), "utf-8"))]));

/**
 * Merge de três vias da base nova no projeto. Devolve `{ de, para, limpos, conflitos, iguais }`.
 * Com conflito, grava `atualizacaoPendente: { para, arquivos }` no design/design-system.json; `resolvido: true` só fecha essa
 * pendência, e só se ela é para a base que o plugin tem agora (senão a regra da versão mais nova se perderia calada).
 */
export function atualizar(raiz, base = BASE_DO_PLUGIN, mergeFile = gitMergeFile, { resolvido = false } = {}) {
  const config = lerConfig(raiz);
  const para = versaoDaBase(base);
  const resultado = { de: config.versao ?? null, para, limpos: [], conflitos: [], iguais: [] };
  const pendente = config.atualizacaoPendente;
  if (resolvido) {
    if (!pendente || !Array.isArray(pendente.arquivos)) throw new Error("não há atualização pendente: --resolvido só fecha o conflito de um atualizar anterior");
    if (pendente.para !== para) throw new Error(`a atualização pendente era para ${pendente.para}, e a base do plugin agora é ${para}: rode o atualizar de novo (sem --resolvido) sobre os arquivos já resolvidos`);
    const comMarcador = pendente.arquivos.filter((f) => temMarcador(join(raiz, "design", f)));
    if (comMarcador.length) throw new Error(`ainda há marcadores de conflito em ${comMarcador.join(", ")}`);
    for (const f of pendente.arquivos) {
      writeFileSync(join(raiz, "design", ".base", f), readFileSync(join(base, f), "utf-8"));
      resultado.limpos.push(f);
    }
    const { atualizacaoPendente, ...resto } = config;
    gravarConfig(raiz, { ...resto, versao: para, base: hashesDoAncestral(raiz) });
    return resultado;
  }
  const comMarcador = ARQUIVOS.filter((f) => temMarcador(join(raiz, "design", f)));
  if (comMarcador.length) throw new Error(`ainda há marcadores de conflito em ${comMarcador.join(", ")}: resolva e rode com --resolvido`);
  for (const f of ARQUIVOS) {
    const doProjeto = join(raiz, "design", f);
    const ancestral = join(raiz, "design", ".base", f);
    const nova = readFileSync(join(base, f), "utf-8");
    if (!existsSync(doProjeto) || !existsSync(ancestral)) throw new Error(`${f}: falta a cópia do projeto ou o ancestral em design/.base/ — rode o estampar antes`);
    if (readFileSync(ancestral, "utf-8") === nova) {
      resultado.iguais.push(f);
      continue;
    }
    const { texto, conflitos } = mergeFile(doProjeto, ancestral, join(base, f));
    writeFileSync(doProjeto, texto);
    if (conflitos > 0) {
      resultado.conflitos.push({ arquivo: f, conflitos });
    } else {
      writeFileSync(ancestral, nova);
      resultado.limpos.push(f);
    }
  }
  const { atualizacaoPendente, ...resto } = config;
  if (resultado.conflitos.length === 0) gravarConfig(raiz, { ...resto, versao: para, base: hashesDoAncestral(raiz) });
  else gravarConfig(raiz, { ...resto, atualizacaoPendente: { para, arquivos: resultado.conflitos.map((c) => c.arquivo) } });
  return resultado;
}

/** `git merge-file -p`: o texto mesclado e o número de conflitos (o status de saída). */
export function gitMergeFile(atual, ancestral, novo) {
  try {
    const texto = execFileSync("git", ["merge-file", "-p", "-L", "projeto", "-L", "base anterior", "-L", "base nova", atual, ancestral, novo], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
    return { texto, conflitos: 0 };
  } catch (e) {
    // 1..127 = número de conflitos; acima disso (o -1 do git vira 255) é erro, e nada se grava.
    if (typeof e?.status === "number" && e.status > 0 && e.status < 128 && typeof e.stdout === "string") return { texto: e.stdout, conflitos: e.status };
    throw e;
  }
}

const real = (c) => {
  try {
    return realpathSync(c);
  } catch {
    return null;
  }
};
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  const [comando, raiz, ...resto] = process.argv.slice(2);
  const opcao = (nome) => (resto.indexOf(nome) >= 0 ? resto[resto.indexOf(nome) + 1] : undefined);
  try {
    if (!raiz || !existsSync(raiz)) throw new Error("uso: node base-do-projeto.mjs estampar|atualizar <raiz> [--densidade instrumento|site] [--pasta <front>] [--resolvido]");
    if (comando === "estampar") {
      const pasta = opcao("--pasta")?.replace(/^(?:\.\/)+(?=.)/, "").replace(/\/+$/, "");
      const r = estampar(raiz, { densidade: opcao("--densidade"), pasta: pasta === "" ? "." : pasta });
      console.log(`base ${r.versao} estampada em design/ — copiados: ${r.copiados.join(", ") || "nenhum"}; mantidos (o projeto já tinha): ${r.mantidos.join(", ") || "nenhum"}`);
    } else if (comando === "atualizar") {
      const r = atualizar(raiz, BASE_DO_PLUGIN, gitMergeFile, { resolvido: resto.includes("--resolvido") });
      console.log(`base ${r.de ?? "?"} → ${r.para} — sem mudança: ${r.iguais.join(", ") || "nenhum"}; mesclados: ${r.limpos.join(", ") || "nenhum"}`);
      if (r.conflitos.length) {
        console.log(`CONFLITOS (versão não subiu): ${r.conflitos.map((c) => `${c.arquivo} (${c.conflitos})`).join(", ")} — resolva os marcadores <<<<<<< e rode \`atualizar --resolvido\``);
        process.exitCode = 1;
      }
    } else throw new Error(`comando desconhecido: ${comando ?? "(nenhum)"} — use estampar ou atualizar`);
  } catch (e) {
    console.error(`[base-do-projeto] ${e.message}`);
    process.exitCode = 2;
  }
}
