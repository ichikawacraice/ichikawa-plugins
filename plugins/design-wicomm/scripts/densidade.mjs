#!/usr/bin/env node
/**
 * **A densidade de cada rota de um projeto, de onde quer que ele a declare.** É o que a crítica e a revisão de UI
 * (skills `critica-de-ui` e `revisao-de-arquitetura-de-ui`) mandam rodar, para não interpretarem a declaração cada uma
 * a seu modo.
 *
 *   node densidade.mjs <raiz> [<rota>] [--de <arquivo da tela>] [--json]
 *
 * **Onde a densidade mora** (precedência por chave, `densidade` e `densidadePorRota` valem cada uma por si):
 * 1. `design/design-system.json`, depois o antigo `design/wicomm.json` (a junção que `configDoProjeto` já faz). A fonte da chave é o arquivo que a disse.
 * 2. A seção `<a id="densidade"></a>` de um `DESIGN.md`, com uma tabela `Rota | Densidade`, só para a chave que nenhum
 *    dos dois diz. O `DESIGN.md` é achado nesta ordem: (a) o que `fontes` lista; (b) com `--de`, o primeiro com a seção
 *    e a tabela subindo da pasta do arquivo até a raiz (o `DESIGN.md` sem a seção no caminho não encerra a busca);
 *    (c) varredura até 3 níveis abaixo da raiz (fora de `node_modules`, `.git` e pastas que começam com ponto), só dos
 *    que têm a seção com tabela: um só vale; mais de um, nenhum vale e o aviso pede o `--de`.
 *    O de (a) vale mesmo sem tabela (é a fonte declarada do projeto): não declara nada, não cai em (c) e vira aviso.
 *
 * **A tabela:** a ordem conta (a primeira rota que casa vence); `*` sozinho é o resto e vira a `densidade` do projeto; no
 * padrão `*` casa qualquer sequência, inclusive `/`, e `/x/*` casa também `/x`; a crase em volta da rota é opcional; a
 * densidade é a primeira palavra da célula, em minúscula. Valor que não é `instrumento` nem `site` entra assim mesmo e
 * vira aviso, sem quebrar.
 *
 * Sem nada declarado: `densidade` e `densidadePorRota` `null`, fonte `null`. Caminhos relativos sempre com `/`.
 * Saída: markdown curto, ou `--json`. Sem raiz que exista: uso no stderr e `process.exitCode = 2`.
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { ARQUIVO_ANTIGO, ARQUIVO_DO_PROJETO, configDoProjeto, lerJsonDoProjeto } from "../hooks/config.mjs";

const VALIDAS = ["instrumento", "site"];
const ANCORA = /<a\s+id=["']densidade["']\s*>\s*<\/a>/i;
const PROFUNDIDADE_MAXIMA = 3;
const objeto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const comBarra = (c) => c.split(sep).join("/");

const celulas = (linha) => linha.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const semCrase = (c) => c.replace(/^`+|`+$/g, "").trim();

/**
 * A tabela `Rota | Densidade` da seção `<a id="densidade"></a>` do texto de um `DESIGN.md`. `null` se não há a âncora,
 * a tabela com as duas colunas ou nenhuma linha. A seção vai da âncora até a próxima âncora ou o próximo heading de
 * nível igual ou maior que o do heading dela.
 */
export function lerTabelaDeDensidade(texto) {
  const m = ANCORA.exec(String(texto ?? ""));
  if (!m) return null;
  const linhas = texto.slice(m.index + m[0].length).split(/\r?\n/);
  const secao = [];
  let nivel = null;
  for (const linha of linhas) {
    if (/<a\s+id=/i.test(linha)) break;
    const h = /^(#{1,6})\s/.exec(linha);
    if (h) {
      if (nivel === null && secao.every((l) => !l.trim().startsWith("|"))) nivel = h[1].length;
      else if (h[1].length <= (nivel ?? 7)) break;
    }
    secao.push(linha);
  }
  const i = secao.findIndex((l) => {
    if (!l.trim().startsWith("|")) return false;
    const c = celulas(l).map((x) => x.toLowerCase());
    return c.includes("rota") && c.includes("densidade");
  });
  if (i < 0) return null;
  const cab = celulas(secao[i]).map((x) => x.toLowerCase());
  const iRota = cab.indexOf("rota");
  const iDens = cab.indexOf("densidade");
  let densidade;
  const densidadePorRota = {};
  const invalidas = [];
  let linhasLidas = 0;
  for (const linha of secao.slice(i + 1)) {
    if (!linha.trim().startsWith("|")) break;
    const c = celulas(linha);
    if (c.every((x) => /^:?-{2,}:?$|^$/.test(x))) continue;
    const rota = semCrase(c[iRota] ?? "");
    const valor = (semCrase(c[iDens] ?? "").split(/\s+/)[0] ?? "").toLowerCase();
    if (!rota) continue;
    linhasLidas++;
    if (!VALIDAS.includes(valor)) invalidas.push(rota);
    if (rota === "*") densidade ??= valor;
    else if (!(rota in densidadePorRota)) densidadePorRota[rota] = valor;
  }
  if (linhasLidas === 0) return null;
  return { densidade, densidadePorRota, invalidas };
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
const doPadrao = (parte) => parte.split("*").map(escapar).join(".*");

/** Se o padrão casa a rota: `*` casa qualquer sequência (com `/`); `/x/*` casa também `/x`; o resto é literal. */
function casa(padrao, rota) {
  const fim = padrao.endsWith("/*");
  const re = fim ? `^${doPadrao(padrao.slice(0, -2))}(?:/.*)?$` : `^${doPadrao(padrao)}$`;
  return new RegExp(re).test(rota);
}

/**
 * A densidade de uma rota: a primeira chave de `declarada.densidadePorRota` que a casa (`regra` é o padrão); sem casar,
 * ou sem rota, a `densidade` do projeto com `regra: null`.
 */
export function densidadeDaRota(declarada, rota) {
  const mapa = objeto(declarada?.densidadePorRota) ? declarada.densidadePorRota : {};
  if (typeof rota === "string" && rota.length > 0) {
    for (const [padrao, valor] of Object.entries(mapa)) {
      if (casa(padrao, rota)) return { densidade: valor, regra: padrao };
    }
  }
  return { densidade: declarada?.densidade ?? null, regra: null };
}

const lerTabelaDe = (caminho) => lerTabelaDeDensidade(readFileSync(caminho, "utf-8"));

/** Os DESIGN.md até `PROFUNDIDADE_MAXIMA` níveis abaixo da raiz (em ordem), sem seguir link nem entrar em pasta oculta. */
function varrer(raiz) {
  const achados = [];
  const visitar = (dir, nivel) => {
    let entradas;
    try {
      entradas = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    } catch {
      return;
    }
    for (const e of entradas) if (e.isFile() && e.name === "DESIGN.md") achados.push(join(dir, e.name));
    if (nivel >= PROFUNDIDADE_MAXIMA) return;
    for (const e of entradas) {
      if (!e.isDirectory() || e.name === "node_modules" || e.name === ".git" || e.name.startsWith(".")) continue;
      visitar(join(dir, e.name), nivel + 1);
    }
  };
  visitar(raiz, 0);
  return achados;
}

/** O caminho real da pasta mais funda que existe (resolve link simbólico também quando o arquivo ainda não existe). */
function realDaPasta(dir) {
  const resto = [];
  for (;;) {
    try {
      return join(realpathSync(dir), ...resto.reverse());
    } catch {
      const pai = dirname(dir);
      if (pai === dir) return dir;
      resto.push(basename(dir));
      dir = pai;
    }
  }
}

/**
 * O primeiro `DESIGN.md` com a seção e a tabela subindo da pasta de `de` até a raiz, inclusive; `null` se `de` cai fora
 * da raiz ou nenhum tem a tabela. `raiz` já é o caminho real.
 */
function subindo(raiz, de) {
  let dir = realDaPasta(dirname(resolve(raiz, de)));
  const rel = relative(raiz, dir);
  if (rel.startsWith("..") || isAbsolute(rel)) return null;
  for (;;) {
    const candidato = join(dir, "DESIGN.md");
    if (existsSync(candidato) && lerTabelaDe(candidato) !== null) return candidato;
    if (dir === raiz) return null;
    const pai = dirname(dir);
    if (pai === dir) return null;
    dir = pai;
  }
}

/**
 * A densidade declarada do projeto: `{ densidade, densidadePorRota, fonte: { densidade, densidadePorRota }, avisos }`.
 * Ver o cabeçalho para a precedência. `de` é o arquivo da tela (relativo à raiz ou absoluto), para escolher o `DESIGN.md`.
 */
export function densidadeDoProjeto(raiz, { de } = {}) {
  raiz = realDaPasta(resolve(raiz));
  const config = configDoProjeto(raiz);
  const arquivos = [
    [ARQUIVO_DO_PROJETO, lerJsonDoProjeto(join(raiz, ARQUIVO_DO_PROJETO))],
    [ARQUIVO_ANTIGO, lerJsonDoProjeto(join(raiz, ARQUIVO_ANTIGO))],
  ];
  const resultado = { densidade: null, densidadePorRota: null, fonte: { densidade: null, densidadePorRota: null }, avisos: [] };
  const valido = { densidade: (v) => typeof v === "string" && v.length > 0, densidadePorRota: objeto };
  for (const chave of ["densidade", "densidadePorRota"]) {
    if (!valido[chave](config[chave])) continue;
    resultado[chave] = config[chave];
    const dono = arquivos.find(([, conteudo]) => valido[chave](conteudo[chave]));
    resultado.fonte[chave] = dono ? comBarra(dono[0]) : null;
  }
  if (resultado.densidade !== null && resultado.densidadePorRota !== null) return resultado;

  // O DESIGN.md: só para a chave que nenhum json diz.
  let arquivo = null;
  let tabela = null;
  const dasFontes = Array.isArray(config.fontes) ? config.fontes.find((f) => typeof f === "string" && basename(f) === "DESIGN.md" && existsSync(resolve(raiz, f))) : null;
  if (dasFontes) arquivo = resolve(raiz, dasFontes);
  else if (de && (arquivo = subindo(raiz, de))) {
    // achado subindo da tela
  } else {
    const comTabela = varrer(raiz).filter((c) => lerTabelaDe(c) !== null);
    if (comTabela.length === 1) arquivo = comTabela[0];
    else if (comTabela.length > 1) {
      const lista = comTabela.map((c) => comBarra(relative(raiz, c))).join(", ");
      resultado.avisos.push(`Mais de um DESIGN.md declara a seção densidade (${lista}): nenhum vale; passe --de <arquivo da tela> para escolher.`);
    }
  }
  if (arquivo) tabela = lerTabelaDe(arquivo);
  if (!tabela) {
    if (dasFontes) resultado.avisos.push(`O DESIGN.md de fontes (${comBarra(relative(raiz, arquivo))}) não tem a seção densidade com a tabela Rota | Densidade.`);
    return resultado;
  }
  const fonte = `${comBarra(relative(raiz, arquivo))}#densidade`;
  if (resultado.densidade === null && tabela.densidade) {
    resultado.densidade = tabela.densidade;
    resultado.fonte.densidade = fonte;
  }
  if (resultado.densidadePorRota === null && Object.keys(tabela.densidadePorRota).length > 0) {
    resultado.densidadePorRota = tabela.densidadePorRota;
    resultado.fonte.densidadePorRota = fonte;
  }
  for (const rota of tabela.invalidas) {
    const valor = rota === "*" ? tabela.densidade : tabela.densidadePorRota[rota];
    resultado.avisos.push(`Densidade inválida em ${fonte}: a rota \`${rota}\` diz "${valor}"; use instrumento ou site.`);
  }
  return resultado;
}

const FRASE_VAZIA = "Densidade não declarada (nem design/design-system.json, nem a seção `densidade` de um DESIGN.md): decida por rota e marque *assumida, a confirmar*.";

function emMarkdown(p, rota, daRota) {
  const linhas = [];
  if (p.densidade === null && p.densidadePorRota === null) linhas.push(FRASE_VAZIA);
  else {
    if (p.densidade !== null) linhas.push(`Densidade do projeto: ${p.densidade} (fonte: \`${p.fonte.densidade}\`)`);
    if (p.densidadePorRota !== null) {
      linhas.push(`Rotas (fonte: \`${p.fonte.densidadePorRota}\`):`);
      for (const [padrao, valor] of Object.entries(p.densidadePorRota)) linhas.push(`- \`${padrao}\`: ${valor}`);
    }
    if (daRota) linhas.push("", `Rota \`${rota}\`: ${daRota.densidade ?? "sem densidade declarada"} (${daRota.regra ? `regra \`${daRota.regra}\`` : "densidade do projeto"})`);
  }
  if (p.avisos.length > 0) linhas.push("", "Avisos:", ...p.avisos.map((a) => `- ${a}`));
  return linhas.join("\n");
}

const real = (c) => {
  try {
    return realpathSync(c);
  } catch {
    return null;
  }
};
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  try {
    const args = process.argv.slice(2);
    const posicionais = [];
    let de;
    let emJson = false;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "--json") emJson = true;
      else if (args[i] === "--de") de = args[++i];
      else posicionais.push(args[i]);
    }
    const [raiz, rota] = posicionais;
    if (!raiz || !existsSync(raiz)) throw new Error("uso: node densidade.mjs <raiz do projeto> [<rota>] [--de <arquivo>] [--json]");
    const p = densidadeDoProjeto(raiz, { de });
    const daRota = rota ? densidadeDaRota(p, rota) : undefined;
    process.stdout.write(emJson ? JSON.stringify({ ...p, rota: rota ?? null, ...(daRota ? { daRota } : {}) }, null, 2) + "\n" : emMarkdown(p, rota, daRota) + "\n");
  } catch (err) {
    console.error(`[densidade] ${err.message}`);
    process.exitCode = 2;
  }
}
