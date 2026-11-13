#!/usr/bin/env node
/**
 * **O aviso barato na hora da escrita: valor solto e ícone de outra biblioteca.**
 *
 * Hook `PreToolUse` (`Edit|Write|MultiEdit`) do plugin `design-wicomm`. Quando o texto novo de um arquivo de tela traz o que
 * a base proíbe — cor literal (`#hex`, `rgb(…)`), valor arbitrário do Tailwind (`text-[15px]`, `h-[34px]`,
 * `z-[60]`), duração ou curva solta (`duration-200`, `ease-in-out`), classe da paleta usada direto fora do idioma de cor
 * (`text-zinc-700`, COR-05) ou ícone que não é `lucide-react` —, devolve um `additionalContext` com o achado e a regra
 * (CONV-04, PRIN-06, MOV-01, COR-05, CTRL-09). **Avisa e não nega:** a escrita segue o fluxo normal de permissão; quem reprova é a guarda no CI (`@wicomm/guardas`, com catraca).
 *
 * Arquivo de tela = `visual` da configuração (`design/design-system.json`, ou a pasta do front). Fora dele, calado.
 * Linha que declara token (`--nome: #fff`) não é valor solto: é onde o valor mora. `valorSolto: false` no projeto
 * desliga o aviso; `valorSolto.ignorar` (globs) lista as exceções locais com motivo (CONV-04).
 *
 * Erro nunca prende a escrita: sai 0 sem decisão e a mensagem vai para o stderr.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { configDoProjeto, eCodigoDeTela, telasDoProjeto } from "./config.mjs";

/** Cada padrão: o que casa, como se chama no aviso e a regra da base que o proíbe. */
export const PADROES = [
  { nome: "cor literal", regra: "CONV-04", re: /(?<![\w&/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g },
  // `(?<![A-Za-z])` e não `\b`: dentro de valor arbitrário a função vem depois de `_` (`shadow-[0_2px_rgba(…)]`), e `_` é
  // letra para o `\b`.
  { nome: "cor literal", regra: "CONV-04", re: /(?<![A-Za-z])(?:rgba?|hsla?|oklch|oklab)\(\s*[\d.]/g },
  { nome: "valor arbitrário", regra: "PRIN-06", re: /(?<![\w-])-?[a-z][\w:-]*-\[(?:-?\d*\.?\d+)(?:px|rem|em|%|vh|vw|dvh|ms|s)?\]/g },
  { nome: "duração solta", regra: "MOV-01", re: /(?<![\w-])(?:duration|delay)-\d+(?![\w-])/g },
  { nome: "curva solta", regra: "MOV-01", re: /(?<![\w-])ease-(?:linear|in|out|in-out)(?![\w-])/g },
];

/**
 * Classe da paleta do Tailwind usada direto (`text-zinc-700`, `hover:bg-emerald-500/10`): a cor de voz sai do idioma de
 * cor, um arquivo só (COR-05); fora dele é deriva. O grupo 2 é a família.
 */
export const PALETA_DIRETO =
  /(?<![\w-])!?-?(bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|divide|placeholder|decoration|accent|caret|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|[1-9]00|950)(?:\/(?:\d+|\[[^\]]+\]))?(?![\w-])/g;

/** Biblioteca de ícone que não é a da base (CTRL-09: `lucide-react`). */
export const ICONE_DE_FORA = /from\s+['"]((?:react-icons|@heroicons|@fortawesome|@mui\/icons-material|@tabler\/icons|@phosphor-icons|phosphor-react|react-feather|@radix-ui\/react-icons|@iconify|lucide(?!-react))[^'"]*)['"]/g;

/** Linha que declara uma variável CSS: é onde o token mora, não valor solto. */
const DECLARA_TOKEN = /^\s*--[\w-]+\s*:/;

/** O texto que a ferramenta vai gravar. */
export function textoNovo(entrada) {
  if (!entrada || typeof entrada !== "object") return "";
  if (typeof entrada.content === "string") return entrada.content;
  if (typeof entrada.new_string === "string") return entrada.new_string;
  if (Array.isArray(entrada.edits)) return entrada.edits.map((e) => (typeof e?.new_string === "string" ? e.new_string : "")).join("\n");
  return "";
}

/**
 * O arquivo do idioma de cor do projeto: o `idioma` da guarda `o-carimbo-tem-forma` no `design/design-system.json` (o mesmo
 * que a guarda lê), relativo à raiz. Sem a chave, nenhum: toda classe de paleta é aviso.
 */
export const idiomaDeCor = (projeto) => {
  const v = projeto?.guardas?.regras?.["o-carimbo-tem-forma"]?.idioma;
  return typeof v === "string" && v ? v.replace(/^\.\//, "") : null;
};

/**
 * Os achados do texto: `[{ nome, regra, valor }]`, sem repetir o mesmo valor. `noIdioma`: o texto é o do idioma de cor,
 * onde a paleta mora por regra (COR-05).
 */
export function achados(texto, { noIdioma = false } = {}) {
  const vistos = new Map();
  for (const linha of String(texto ?? "").split("\n")) {
    if (DECLARA_TOKEN.test(linha)) continue;
    for (const p of PADROES) {
      for (const m of linha.matchAll(p.re)) vistos.set(`${p.regra}\0${m[0]}`, { nome: p.nome, regra: p.regra, valor: m[0] });
    }
    if (!noIdioma) for (const m of linha.matchAll(PALETA_DIRETO)) vistos.set(`COR-05\0${m[0]}`, { nome: "paleta direto", regra: "COR-05", valor: m[0] });
    for (const m of linha.matchAll(ICONE_DE_FORA)) vistos.set(`CTRL-09\0${m[1]}`, { nome: "ícone de outra biblioteca", regra: "CTRL-09", valor: m[1] });
  }
  return [...vistos.values()];
}

/** O aviso, ou `null`. `ctx`: `{ raiz(cwd), config(raiz), projeto(raiz) }`, trocáveis no teste. */
export function decidir(evento, ctx) {
  if (evento?.hook_event_name !== "PreToolUse") return null;
  const caminho = evento?.tool_input?.file_path;
  if (typeof caminho !== "string" || !caminho) return null;
  const raiz = ctx.raiz(evento?.cwd || process.cwd());
  if (!raiz) return null;
  const config = ctx.config(raiz);
  if (!config) return null;
  const projeto = ctx.projeto(raiz);
  if (projeto?.valorSolto === false) return null;
  if (!eCodigoDeTela(caminho, config.visual)) return null;
  const ignorar = Array.isArray(projeto?.valorSolto?.ignorar) ? projeto.valorSolto.ignorar.filter((g) => typeof g === "string") : [];
  if (ignorar.length > 0 && eCodigoDeTela(caminho, ignorar)) return null;
  const idioma = idiomaDeCor(projeto);
  const noIdioma = Boolean(idioma) && relative(raiz, resolve(raiz, caminho)).split(sep).join("/") === idioma;
  const lista = achados(textoNovo(evento.tool_input), { noIdioma });
  if (lista.length === 0) return null;
  const mostrados = lista.slice(0, 8).map((a) => `\`${a.valor}\` (${a.nome}, ${a.regra})`).join("; ");
  const resto = lista.length > 8 ? ` e mais ${lista.length - 8}` : "";
  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      additionalContext:
        `Valor solto na tela que está sendo escrita (${caminho.split("/").pop()}): ${mostrados}${resto}. ` +
        "A base pede token: cor, espaço, tipo, raio, sombra e duração saem da escala da DESIGN, a cor de voz sai do idioma de cor (COR-05), e ícone só de `lucide-react`. " +
        "Troque pelo token; se a escala não tem o valor, ele entra no token com motivo (ou na exceção local `valorSolto.ignorar` do design/design-system.json). " +
        "Isto é aviso: a guarda do CI é quem reprova.",
    },
  };
}

function raizDoGit(cwd) {
  try {
    return execFileSync("git", ["-C", cwd, "rev-parse", "--show-toplevel"], { encoding: "utf-8", timeout: 1_500, killSignal: "SIGKILL", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

export function main(entrada) {
  let evento;
  try {
    evento = JSON.parse(entrada);
  } catch (e) {
    console.error(`[valor-solto] evento ilegível: ${e.message}`);
    return 0;
  }
  try {
    const decisao = decidir(evento, { raiz: raizDoGit, config: (r) => telasDoProjeto(r), projeto: (r) => configDoProjeto(r) });
    if (decisao) process.stdout.write(JSON.stringify(decisao));
  } catch (e) {
    console.error(`[valor-solto] ${e?.message ?? e}`);
  }
  return 0;
}

const real = (c) => {
  try {
    return realpathSync(c);
  } catch {
    return null;
  }
};
if (process.argv[1] && real(process.argv[1]) === real(fileURLToPath(import.meta.url))) {
  process.exitCode = main(readFileSync(0, "utf-8"));
}
