#!/usr/bin/env node
/**
 * **Os números de deriva de um app React contra a base Wicomm — só lendo.**
 *
 * Uso: `node medir-deriva.mjs <raiz do projeto> [--pasta <pasta do front>] [--idioma <arquivo>] [--json]`.
 *
 * Mede o que a skill `auditar-projeto` pede em números, separando a pasta ui (as peças) das telas:
 * - valor solto (os padrões do aviso na escrita, `hooks/valor-solto.mjs`, mais o arbitrário composto), com os valores
 *   que mais se repetem em cada um dos piores arquivos;
 * - a paleta do Tailwind usada direto (COR-05), fora e dentro do idioma de cor;
 * - a cor com alfa que não gera CSS no Tailwind v3 (cor de tema `var(--x)` sem `<alpha-value>`, opacidade fora da escala);
 * - tamanhos de fonte, raios em px (resolvidos pelo config e pelo `--radius`), alturas de controle (CTRL-01) separadas
 *   de quadrados e de barras, e o uso de cada variante de tamanho das peças;
 * - os ícones: bibliotecas, ícones distintos e o tamanho de cada uso (CTRL-09);
 * - animação sem escape por ocorrência, na mesma string de classe, isentando `transition-colors` (MOV-02);
 * - os tokens do projeto contra os da Wicomm, as variáveis sem uso, `transparent` (CONV-03) e o tema escuro;
 * - o `tailwind.config.*` (fonte, cores sem alfa, movimento solto) e o stack;
 * - as peças da pasta ui, com quantos usos cada uma tem fora dela.
 * Lê `.tsx/.jsx/.vue/.svelte/.html`, o CSS que algum `import`/`@import`/`<link>` cita pelo nome (o resto vai para uma lista à parte) e os `.ts/.js`
 * que montam classe. Não escreve nada, não instala nada, não roda build nem executa código do projeto.
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { configDoProjeto } from "../hooks/config.mjs";
import { ICONE_DE_FORA, PADROES, PALETA_DIRETO } from "../hooks/valor-solto.mjs";
import { lerCor } from "./lib/contraste.mjs";
import { animacoesSemEscape, declaracoes, literaisDoFonte, separaVariante, tagsDeAbertura, tokensDaLiteral } from "./lib/fonte.mjs";
import { lerConfigTailwind } from "./lib/tailwind-config.mjs";
import { pastaDoTema, temaDaMedida, variaveisDaMarca } from "./lib/tema.mjs";

const TELA = /\.(tsx|jsx|vue|svelte|css|scss|html)$/;
const LOGICA = /\.(ts|js|mjs|cjs)$/;
const CSS = /\.(css|scss)$/;
const FORA = new Set(["node_modules", "dist", "build", ".next", ".git", "coverage", ".turbo", ".vercel", "out"]);
const TESTE = /\.(test|spec|stories)\.|__tests__/;
const DECLARA_TOKEN = /^\s*--[\w-]+\s*:/;
const AQUI = dirname(fileURLToPath(import.meta.url));

/** `.ts`/`.js` que monta classe: importa `cn`/`cva`/`clsx` ou tem `bg-`/`text-`/`border-` numa string. */
export const montaClasse = (texto) =>
  /from\s+["'][^"']*(?:\/utils|\/cn|class-variance-authority|clsx|tailwind-merge)["']/.test(texto) || /["'`][^"'`\n]*(?<![\w-])(?:bg|text|border)-[\w[]/.test(texto);

/** Os arquivos de tela da pasta (e os `.ts`/`.js` candidatos), sem dependências, build, testes e config. */
export function arquivosDeTela(pasta) {
  const lista = [];
  const varrer = (dir) => {
    let entradas;
    try {
      entradas = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entradas) {
      if (e.name.startsWith(".") && e.name !== ".") continue;
      const caminho = join(dir, e.name);
      if (e.isDirectory()) {
        if (!FORA.has(e.name)) varrer(caminho);
      } else if ((TELA.test(e.name) || LOGICA.test(e.name)) && !TESTE.test(caminho) && !/\.config\.|\.d\.ts$/.test(e.name)) lista.push(caminho);
    }
  };
  varrer(pasta);
  return lista.sort();
}

const contar = (mapa, chave, n = 1) => mapa.set(chave, (mapa.get(chave) ?? 0) + n);
const ordenado = (mapa) => [...mapa.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));

/** Um contador que separa a pasta ui das telas. */
function contador() {
  const total = new Map();
  const ui = new Map();
  const tela = new Map();
  return {
    somar(chave, lado, n = 1) {
      contar(total, chave, n);
      contar(lado === "ui" ? ui : tela, chave, n);
    },
    saida: () => ordenado(total).map(([k, n]) => [k, n, { ui: ui.get(k) ?? 0, tela: tela.get(k) ?? 0 }]),
    soma: () => [...total.values()].reduce((a, b) => a + b, 0),
  };
}

/** O arbitrário que não é número simples (`shadow-[0_1px_rgba(…)]`, `grid-cols-[1fr_2fr]`, `w-[min(…)]`). */
const ARBITRARIO = /(?<![\w&/[-])!?-?[a-z][\w:-]*?-\[([^\]\s"'`]+)\](?![\w:-])/g;
const SIMPLES = /^-?\d*\.?\d+(?:px|rem|em|%|vh|vw|dvh|ms|s)?$/;
const COR_NO_COLCHETE = /^(?:#|var\(|--|(?:rgba?|hsla?|oklch|oklab)\()/;
// PRIN-06 composto: a cor sozinha no colchete já é cor literal; `var(--x)` é token.
const composto = (conteudo) => !SIMPLES.test(conteudo) && !COR_NO_COLCHETE.test(conteudo) || /^(?:rgba?|hsla?)\(.*\)_|_(?:rgba?|hsla?)\(/.test(conteudo);

/** A escala de opacidade do Tailwind v3 (`bg-x/NN` fora dela não gera CSS). */
const ESCALA_V3 = new Set([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100]);
const UTIL_COR = "bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|from|via|to|divide|placeholder|decoration|accent|caret|shadow";

/** O raio padrão de cada versão, em px. */
const RAIO = {
  3: { none: 0, sm: 2, "": 4, md: 6, lg: 8, xl: 12, "2xl": 16, "3xl": 24, full: 9999 },
  4: { none: 0, xs: 2, sm: 4, "": 4, md: 6, lg: 8, xl: 12, "2xl": 16, "3xl": 24, "4xl": 32, full: 9999 },
};
const RAIO_RE = /(?<![\w-])rounded(?:-(t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?(?:-(none|xs|sm|md|lg|xl|2xl|3xl|4xl|full|\[[^\]]+\]))?(?![\w-])/g;

/** Um comprimento CSS em px: `.625rem`, `10px`, `calc(var(--radius) - 2px)`. `null` quando não se resolve. */
export function emPx(valor, vars = {}, saltos = 0) {
  let v = String(valor ?? "").trim();
  if (saltos > 8) return null;
  v = v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_, n, padrao) => vars[n] ?? padrao ?? "NaN");
  const c = /^calc\((.+)\)$/.exec(v);
  if (c) {
    const partes = c[1].split(/\s+([+-])\s+/);
    let total = emPx(partes[0], vars, saltos + 1);
    for (let i = 1; i < partes.length && total !== null; i += 2) {
      const n = emPx(partes[i + 1], vars, saltos + 1);
      total = n === null ? null : partes[i] === "+" ? total + n : total - n;
    }
    return total;
  }
  const m = /^(-?\d*\.?\d+)(px|rem|em)?$/.exec(v);
  if (!m) return v === "9999px" ? 9999 : null;
  return Math.round(parseFloat(m[1]) * (m[2] === "rem" || m[2] === "em" ? 16 : 1) * 100) / 100;
}

/** A escala Tailwind (`4` → 16px, `3.5` → 14px, `[18px]` → 18px). */
const escalaPx = (s) => (s.startsWith("[") ? emPx(s.slice(1, -1)) : s === "px" ? 1 : Number.isFinite(Number(s)) ? Number(s) * 4 : null);

/** A animação de uma string de classe sem o escape na mesma string (MOV-02), uma por ocorrência. */
export function movimentosSemEscape(texto) {
  const tokens = tokensDaLiteral(texto);
  const falta = [];
  for (const token of tokens) {
    const { variantes, base } = separaVariante(token);
    if (variantes.includes("motion-reduce") || variantes.includes("motion-safe")) continue;
    // A MOV-02 isenta `transition-colors` (mudança de estado só troca a cor); o resto da família paga o escape.
    const tipo = /^animate-(?!none$)/.test(base) ? "animate" : /^transition(?:-(?!colors$|none$)[\w-]+|-\[.+\])?$/.test(base) ? "transition" : null;
    if (!tipo) continue;
    const forte = `motion-reduce:!${tipo}-none`;
    const ok = variantes.length > 0 ? tokens.includes(forte) : tokens.includes(`motion-reduce:${tipo}-none`) || tokens.includes(forte);
    if (!ok) falta.push(base);
  }
  return falta;
}

const PECA_DE_CONTROLE = ["button", "input", "select", "textarea", "Button", "Input", "Textarea", "SelectTrigger", "TabsTrigger", "Toggle"];

/**
 * Os números de deriva de uma lista de arquivos (`{ caminho, texto }`). `opcoes`: `pastaUi` (prefixo do caminho),
 * `idioma` (o caminho do idioma de cor), `tailwind` (3 ou 4), `semAlfa` (cores de tema sem `<alpha-value>`), `raios`
 * (nome → px).
 */
export function medir(arquivos, opcoes = {}) {
  const { pastaUi = null, idioma = null, tailwind = null, semAlfa = [], raios: raiosPx = RAIO[tailwind === 4 ? 4 : 3] } = opcoes;
  const lado = (c) => (pastaUi && (c === pastaUi || c.startsWith(`${pastaUi}/`)) ? "ui" : "tela");
  const ehCodigo = (c) => !CSS.test(c);
  const valor = contador();
  const porArquivo = new Map();
  const repetidos = new Map();
  const sobrepostos = { ui: 0, tela: 0 };
  const paleta = contador();
  const familias = new Map();
  const paletaPorArquivo = new Map();
  let noIdioma = 0;
  const brancoPreto = contador();
  const alfa = contador();
  const icones = new Map();
  const iconesDistintos = new Set();
  const tamanhoDeIcone = new Map();
  const tamanhos = new Map();
  const raios = new Map();
  const alturas = { controle: new Map(), quadrado: new Map(), outra: new Map() };
  const variantes = {};
  const movimento = contador();
  const movPorArquivo = new Map();
  const semAlfaRe = semAlfa.length ? new RegExp(`(?<![\\w-])!?(?:${UTIL_COR})-(${semAlfa.map((s) => s.replace(/[-]/g, "\\-")).join("|")})\\/(\\d+|\\[[^\\]]+\\])(?![\\w-])`, "g") : null;

  for (const { caminho, texto } of arquivos) {
    const l = lado(caminho);
    let doArquivo = 0;
    const rep = new Map();
    const ehIdioma = idioma && caminho === idioma;
    for (const linha of texto.split("\n")) {
      if (DECLARA_TOKEN.test(linha)) continue;
      const spans = [];
      for (const m of linha.matchAll(ARBITRARIO)) {
        if (!composto(m[1])) continue;
        spans.push([m.index, m.index + m[0].length]);
        valor.somar("arbitrário composto (PRIN-06)", l);
        doArquivo += 1;
        contar(rep, m[0]);
      }
      for (const p of PADROES) {
        for (const m of linha.matchAll(p.re)) {
          valor.somar(`${p.nome} (${p.regra})`, l);
          // A cor dentro de um composto conta na categoria e uma vez só no total.
          if (spans.some(([a, b]) => m.index >= a && m.index < b)) sobrepostos[l] += 1;
          else {
            doArquivo += 1;
            contar(rep, m[0]);
          }
        }
      }
      for (const m of linha.matchAll(ICONE_DE_FORA)) {
        valor.somar("ícone de outra biblioteca (CTRL-09)", l);
        doArquivo += 1;
        contar(icones, m[1].split("/").slice(0, m[1].startsWith("@") ? 2 : 1).join("/"));
      }
      if (/from\s+['"]lucide-react['"]/.test(linha)) contar(icones, "lucide-react");
      for (const m of linha.matchAll(PALETA_DIRETO)) {
        if (ehIdioma) {
          noIdioma += 1;
          continue;
        }
        paleta.somar(m[1].replace(/-[trblxyse]$/, ""), l);
        contar(familias, m[2]);
        contar(paletaPorArquivo, caminho);
      }
      for (const m of linha.matchAll(/(?<![\w-])!?(bg|text|border)-(white|black)(?:\/\d+)?(?![\w-])/g)) brancoPreto.somar(`${m[1]}-${m[2]}`, l);
      if (tailwind === 3) {
        if (semAlfaRe) for (const m of linha.matchAll(semAlfaRe)) alfa.somar(`cor de tema sem <alpha-value>: ${m[0].replace(/^!/, "")}`, l);
        for (const m of linha.matchAll(new RegExp(`(?<![\\w-])!?(?:${UTIL_COR})-(?:[a-z]+-\\d{2,3}|white|black)\\/(\\d+)(?![\\w-])`, "g"))) {
          if (!ESCALA_V3.has(Number(m[1]))) alfa.somar(`opacidade fora da escala v3: /${m[1]}`, l);
        }
      }
      for (const m of linha.matchAll(/(?<![\w-])text-(xs|sm|base|lg|[2-9]?xl|\[\d[^\]]*\])(?![\w-])/g)) contar(tamanhos, `text-${m[1]}`);
      for (const m of linha.matchAll(RAIO_RE)) {
        const tam = m[2] ?? "";
        const px = tam.startsWith("[") ? emPx(tam.slice(1, -1)) : raiosPx[tam];
        const atual = raios.get(m[0]) ?? { n: 0, px: px ?? null };
        atual.n += 1;
        raios.set(m[0], atual);
      }
    }
    if (doArquivo) {
      porArquivo.set(caminho, doArquivo);
      repetidos.set(caminho, ordenado(rep).filter(([, n]) => n > 1).slice(0, 3));
    }

    if (ehCodigo(caminho)) {
      const declaracoesDeTamanho = new Set();
      // A variante de tamanho das peças: a declaração (`size: { sm: "h-9 …" }` num cva) e os usos (`<Button size="sm">`).
      if (lado(caminho) === "ui" && /size\s*:\s*\{/.test(texto)) {
        const nome = caminho.split("/").pop().replace(/\.(tsx|jsx)$/, "").replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
        const bloco = /size\s*:\s*\{([\s\S]*?)\n\s*\}/.exec(texto)?.[1] ?? "";
        const decl = {};
        // A declaração da variante não é uso: sai da conta das alturas, e os usos se contam pela peça (`<Button size>`).
        for (const d of bloco.matchAll(/["'`]([^"'`]*)["'`]/g)) declaracoesDeTamanho.add(d[1]);
        for (const d of bloco.matchAll(/["']?([\w-]+)["']?\s*:\s*["'`]([^"'`]*)["'`]/g)) {
          const h = /(?<![\w:-])h-(\d+(?:\.5)?|\[[^\]]+\])/.exec(d[2]);
          decl[d[1]] = { px: h ? escalaPx(h[1]) : null, usos: 0 };
        }
        if (Object.keys(decl).length) variantes[nome] = decl;
      }
      // Alturas e movimento: pela string de classe, com a variante (`md:h-10`) aceita.
      const controles = new Set();
      for (const nome of PECA_DE_CONTROLE) for (const { tag } of tagsDeAbertura(texto, nome)) controles.add(tag);
      const emControle = (t) => [...controles].some((tag) => tag.includes(t));
      for (const { texto: lit } of literaisDoFonte(texto)) {
        const tokens = tokensDaLiteral(lit).map((t) => ({ t, ...separaVariante(t) }));
        const hs = declaracoesDeTamanho.has(lit) ? [] : tokens.filter((x) => /^(?:min-)?h-(?:\d+(?:\.5)?|px|\[[^\]]+\])$/.test(x.base));
        const lados = new Set(tokens.filter((x) => /^w-/.test(x.base)).map((x) => x.base.slice(2)));
        const quadrado = tokens.some((x) => /^size-/.test(x.base)) || hs.some((x) => x.base.startsWith("h-") && lados.has(x.base.slice(2)));
        for (const x of [...hs, ...(declaracoesDeTamanho.has(lit) ? [] : tokens.filter((y) => /^size-/.test(y.base)))]) {
          const grupo = quadrado ? "quadrado" : emControle(lit) ? "controle" : "outra";
          contar(alturas[grupo], x.base);
        }
        for (const base of movimentosSemEscape(lit)) {
          movimento.somar(base, l);
          contar(movPorArquivo, caminho);
        }
      }
      // Os ícones do lucide: cada um importado, e o tamanho de cada uso (`size={N}`, `size-N`, `h-N w-N`).
      for (const m of texto.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']lucide-react["']/g)) {
        for (const parte of m[1].split(",").map((s) => s.trim()).filter(Boolean)) {
          const [orig, local = orig] = parte.split(/\s+as\s+/);
          iconesDistintos.add(orig.replace(/Icon$/, ""));
          for (const { tag } of tagsDeAbertura(texto, local)) {
            const prop = /\bsize=\{?\s*["']?(\d+)/.exec(tag);
            const cls = /(?<![\w:-])(?:size|h)-(\d+(?:\.5)?|\[\d+px\])(?![\w-])/.exec(tag);
            const px = prop ? Number(prop[1]) : cls ? escalaPx(cls[1]) : 24;
            contar(tamanhoDeIcone, prop || cls ? px : "24 (padrão)");
          }
        }
      }
    }
  }
  // Os usos de cada variante de tamanho, fora da pasta ui.
  for (const [nome, decl] of Object.entries(variantes)) {
    for (const { caminho, texto } of arquivos) {
      if (lado(caminho) === "ui" || !ehCodigo(caminho)) continue;
      for (const { tag } of tagsDeAbertura(texto, nome)) {
        const v = /\bsize=["'{]+([\w-]+)/.exec(tag)?.[1] ?? "default";
        if (decl[v]) decl[v].usos += 1;
        else decl[v] = { px: null, usos: 1 };
      }
    }
  }
  const css = arquivos.filter((a) => CSS.test(a.caminho));
  for (const { caminho, texto } of css) {
    for (const seletor of animacoesSemEscape(texto)) {
      movimento.somar(`css: ${seletor}`, lado(caminho));
      contar(movPorArquivo, caminho);
    }
  }
  const forma = (m) => ordenado(m);
  const tamIcone = forma(tamanhoDeIcone);
  return {
    arquivos: arquivos.length,
    valorSolto: {
      total: valor.soma() - sobrepostos.ui - sobrepostos.tela,
      ui: valor.saida().reduce((a, [, , d]) => a + d.ui, 0) - sobrepostos.ui,
      tela: valor.saida().reduce((a, [, , d]) => a + d.tela, 0) - sobrepostos.tela,
      porCategoria: valor.saida(),
      piores: ordenado(porArquivo).slice(0, 10).map(([c, n]) => [c, n, repetidos.get(c) ?? []]),
    },
    paleta: {
      total: paleta.soma(),
      porUtilitaria: paleta.saida(),
      porFamilia: ordenado(familias),
      porArquivo: ordenado(paletaPorArquivo).slice(0, 10),
      noIdioma,
      idioma,
      brancoPreto: { total: brancoPreto.soma(), porClasse: brancoPreto.saida() },
    },
    alfaSemCss: tailwind === 3 ? { total: alfa.soma(), porClasse: alfa.saida() } : null,
    icones: ordenado(icones),
    iconesLucide: {
      distintos: iconesDistintos.size,
      tamanhos: tamIcone,
      foraDaEscala: tamIcone.filter(([px]) => ![14, 16, 18].includes(px)).reduce((a, [, n]) => a + n, 0),
    },
    tamanhosDeFonte: ordenado(tamanhos),
    raios: [...raios.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0])).map(([k, v]) => [k, v.n, v.px]),
    alturas: { controle: forma(alturas.controle), quadrado: forma(alturas.quadrado), outra: forma(alturas.outra), variantes },
    animacaoSemEscape: { ocorrencias: movimento.soma(), porTipo: movimento.saida(), arquivos: ordenado(movPorArquivo) },
  };
}

const lerJson = (c) => {
  try {
    return JSON.parse(readFileSync(c, "utf-8"));
  } catch {
    return null;
  }
};

const maior = (versao) => Number(/(\d+)/.exec(String(versao ?? ""))?.[1] ?? NaN);

/** O stack do front: framework, Tailwind (versão pelo pacote; o config sozinho é aviso), shadcn e a pasta de componentes. */
export function stack(raizDoFront) {
  const pkg = lerJson(join(raizDoFront, "package.json")) ?? {};
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const framework = deps.next ? `next ${deps.next}` : deps.vite ? `vite ${deps.vite}` : deps["react-scripts"] ? `cra ${deps["react-scripts"]}` : "desconhecido";
  const tailwind = deps.tailwindcss ?? deps["@tailwindcss/vite"] ?? deps["@tailwindcss/postcss"] ?? null;
  const v = deps["@tailwindcss/vite"] || deps["@tailwindcss/postcss"] ? 4 : maior(deps.tailwindcss);
  const configTw = ["tailwind.config.ts", "tailwind.config.js", "tailwind.config.mjs", "tailwind.config.cjs"].find((f) => existsSync(join(raizDoFront, f))) ?? null;
  const avisos = [];
  if (configTw && !tailwind) avisos.push(`${configTw} sem o pacote tailwindcss no package.json: versão desconhecida`);
  if (configTw && v === 4) avisos.push(`${configTw} num projeto v4: só vale se uma folha o carrega com @config`);
  const shadcn = lerJson(join(raizDoFront, "components.json"));
  const pastaUi = ["src/components/ui", "components/ui", "app/components/ui"].map((p) => join(raizDoFront, p)).find((p) => existsSync(p)) ?? null;
  const pecas = pastaUi ? readdirSync(pastaUi).filter((f) => /\.(tsx|jsx)$/.test(f) && !TESTE.test(f)).map((f) => f.replace(/\.(tsx|jsx)$/, "")).sort() : [];
  return {
    react: deps.react ?? null,
    framework,
    loja: Boolean(deps["@faststore/core"] || deps["@faststore/ui"] || Object.keys(deps).some((d) => d.startsWith("@vtex/") || d.startsWith("@wake"))),
    tailwind,
    tailwindVersao: Number.isFinite(v) ? v : null,
    tailwindV3: Number.isFinite(v) ? v === 3 : null,
    configTailwind: configTw,
    avisos,
    shadcn: shadcn ? { estilo: shadcn.style ?? null, registries: Object.keys(shadcn.registries ?? {}) } : null,
    pastaUi: pastaUi ? relative(raizDoFront, pastaUi) : null,
    pecas,
  };
}

/**
 * As folhas que alguém cita: o nome do arquivo aparece num `import`, num `@import` ou num `<link>` (`./app.css?url`,
 * `@/app/globals.css`, `@import "tema.css"`). Pelo nome, e não resolvendo o caminho: alias e convenção de cada
 * framework variam, e a folha de tokens que some da medida custa mais que o arquivo morto que fica.
 */
export function cssAlcancavel(arquivos, front) {
  const textos = arquivos.map((a) => a.texto);
  const html = join(front, "index.html");
  if (existsSync(html)) textos.push(readFileSync(html, "utf-8"));
  const citados = new Set();
  for (const t of textos) for (const m of t.matchAll(/["'(]([^"'()\s]*?([\w.-]+\.s?css))(?:\?[^"')]*)?["')]/g)) citados.add(m[2]);
  return new Set(arquivos.filter((a) => CSS.test(a.caminho) && citados.has(a.caminho.split("/").pop())).map((a) => a.caminho));
}

/**
 * Os tokens de referência de um projeto (`{ claro, escuro }`): os do sistema (`dados/tokens-wicomm.json`), com as
 * variáveis da marca trocadas pelas do tema dele (`design/tema/`, senão o padrão). A deriva da cor da marca se mede
 * contra o tema que o projeto aplicou, não contra uma marca fixa.
 */
export function referenciaDoProjeto(raiz) {
  const sistema = lerJson(join(AQUI, "dados", "tokens-wicomm.json"))?.variaveis;
  if (!sistema) return null;
  const marca = variaveisDaMarca(pastaDoTema(raiz));
  return { claro: { ...sistema.claro, ...marca.claro }, escuro: { ...sistema.escuro, ...marca.escuro } };
}

/** Os tokens do projeto contra os de referência (sistema + tema), as variáveis sem uso, `transparent` e o tema escuro. */
export function tokensDoProjeto(folhas, codigo, configTexto = "", wicomm = referenciaDoProjeto(".")) {
  const decl = folhas.flatMap((f) => declaracoes(f.texto));
  const doTema = (tema) => Object.fromEntries(decl.filter((d) => d.tema === tema).map((d) => [d.nome, d.valor]));
  const claro = doTema("claro");
  const escuro = doTema("escuro");
  const nomes = [...new Set(decl.map((d) => d.nome))];
  const tudo = [...folhas.map((f) => f.texto), ...codigo.map((c) => c.texto), configTexto].join("\n");
  const usadas = new Set([...tudo.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));
  // Só `:root` e `.dark` entram: o `@theme` do v4 não é lido, e o que ele referencia por `var()` conta como uso.
  const semUso = nomes.filter((n) => !usadas.has(n));
  const diferencas = [];
  if (wicomm) {
    for (const [tema, vars] of [["claro", claro], ["escuro", { ...claro, ...escuro }]]) {
      for (const [nome, valor] of Object.entries(vars)) {
        const delas = wicomm[tema]?.[nome];
        if (delas === undefined) continue;
        const a = lerCor(valor, vars);
        const b = lerCor(delas, wicomm[tema]);
        // Só cor se compara: gradiente, sombra e fonte mudam de forma, não de valor.
        if (!a || !b) continue;
        if (a.hex !== b.hex || Math.abs(a.alfa - b.alfa) >= 0.01) diferencas.push({ tema, nome, projeto: a && a.alfa === 1 ? a.hex : valor, wicomm: delas });
      }
    }
  }
  const temEscuro = decl.some((d) => d.tema === "escuro");
  const liga = /classList\.(?:add|toggle)\(\s*["']dark["']|setTheme|next-themes|ThemeProvider|data-theme|matchMedia\(\s*["']\(prefers-color-scheme/.test(codigo.map((c) => c.texto).join("\n"));
  const porMidia = folhas.some((f) => /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/.test(f.texto)) || /darkMode\s*:\s*["']media["']/.test(configTexto);
  return {
    declaradas: nomes.length,
    noRoot: Object.keys(claro).length,
    semUso,
    transparentes: Object.entries({ ...claro, ...escuro }).filter(([, v]) => /^\s*transparent\s*$/i.test(v)).map(([k]) => k),
    diferencas,
    faltando: wicomm ? Object.keys(wicomm.claro).filter((n) => !(n in claro)).length : null,
    temaEscuro: !temEscuro && !porMidia ? "ausente" : liga || porMidia ? "alcançável" : "declarado",
    variantesDark: (tudo.match(/(?<![\w-])dark:[\w[!-]/g) ?? []).length,
  };
}

/** A configuração da Wicomm no projeto, se houver: densidade, densidade por rota e o idioma de cor. */
function doWicomm(raiz) {
  let c;
  try {
    c = configDoProjeto(raiz);
  } catch {
    return null; // config ilegível não para a medição: ela só perde a densidade e o idioma
  }
  if (!c.temArquivo) return null;
  return { densidade: c.densidade ?? null, densidadePorRota: c.densidadePorRota ?? null, idioma: c.guardas?.regras?.["o-carimbo-tem-forma"]?.idioma ?? null };
}

/** A medição completa de um front. `idioma`: o idioma de cor, relativo à raiz (vence o do design/design-system.json). */
export function medirProjeto(raiz, pasta = ".", { idioma } = {}) {
  const front = join(raiz, pasta);
  const st = stack(front);
  const todos = arquivosDeTela(join(front, existsSync(join(front, "src")) ? "src" : "")).map((c) => ({ caminho: relative(raiz, c), texto: readFileSync(c, "utf-8") }));
  const logica = todos.filter((a) => LOGICA.test(a.caminho));
  const telas = todos.filter((a) => !LOGICA.test(a.caminho));
  const comClasse = logica.filter((a) => montaClasse(a.texto));
  const alcancavel = cssAlcancavel(todos, front);
  const cssMortos = telas.filter((a) => CSS.test(a.caminho) && !alcancavel.has(a.caminho)).map((a) => a.caminho);
  const medidos = [...telas.filter((a) => !cssMortos.includes(a.caminho)), ...comClasse].sort((a, b) => a.caminho.localeCompare(b.caminho));
  const configTexto = st.configTailwind ? readFileSync(join(front, st.configTailwind), "utf-8") : "";
  const config = configTexto ? lerConfigTailwind(configTexto) : null;
  const folhas = medidos.filter((a) => CSS.test(a.caminho));
  const vars = Object.fromEntries(folhas.flatMap((f) => declaracoes(f.texto)).filter((d) => d.tema === "claro").map((d) => [d.nome, d.valor]));
  const versao = st.tailwindVersao ?? 3;
  const raios = { ...RAIO[versao === 4 ? 4 : 3] };
  for (const [k, v] of Object.entries(config?.raios ?? {})) raios[k === "DEFAULT" ? "" : k] = emPx(v, vars);
  if (versao === 4) for (const [k, v] of Object.entries(vars)) if (k.startsWith("--radius-")) raios[k.slice(9)] = emPx(v, vars);
  const wicomm = doWicomm(raiz);
  // Relativo à raiz, onde mora o design/design-system.json: como o lê a guarda e o aviso na escrita.
  const idiomaFinal = (idioma ?? wicomm?.idioma ?? null)?.replace(/^\.\//, "") ?? null;
  const pastaUi = st.pastaUi ? join(pasta, st.pastaUi).replace(/^\.\//, "") : null;
  const m = medir(medidos, { pastaUi, idioma: idiomaFinal, tailwind: st.tailwindVersao ?? (config ? 3 : null), semAlfa: config?.semAlfa ?? [], raios });
  // Os usos de cada peça da pasta ui, contados fora dela: pela peça principal (`command` → `<Command`), ou pela soma
  // das partes quando o arquivo não exporta o nome principal.
  const fora = medidos.filter((a) => !CSS.test(a.caminho) && !(pastaUi && a.caminho.startsWith(`${pastaUi}/`)));
  const usos = st.pecas.map((p) => {
    const texto = readFileSync(join(front, st.pastaUi, `${p}${existsSync(join(front, st.pastaUi, `${p}.tsx`)) ? ".tsx" : ".jsx"}`), "utf-8");
    const exportados = new Set([...texto.matchAll(/export\s+(?:const|function)\s+([A-Z]\w*)/g)].map((x) => x[1]));
    for (const x of texto.matchAll(/export\s*\{([^}]+)\}/g)) for (const n of x[1].split(",")) if (/^[A-Z]/.test(n.trim().split(/\s+as\s+/).pop())) exportados.add(n.trim().split(/\s+as\s+/).pop());
    const principal = p.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
    const nomes = exportados.has(principal) ? [principal] : [...exportados];
    const n = nomes.reduce((soma, nome) => soma + fora.reduce((s, a) => s + (a.texto.match(new RegExp(`<${nome}(?=[\\s>/])`, "g")) ?? []).length, 0), 0);
    return [p, n];
  });
  return {
    raiz,
    pasta,
    stack: { ...st, pecas: st.pecas },
    wicomm,
    ...m,
    pecasComUso: usos,
    lidos: { telas: telas.length - cssMortos.length, logicaComClasse: comClasse.map((a) => a.caminho), cssSemImport: cssMortos },
    tema: temaDaMedida(pastaDoTema(raiz)).nome,
    tokens: tokensDoProjeto(folhas, medidos.filter((a) => !CSS.test(a.caminho)), configTexto, referenciaDoProjeto(raiz)),
    configTailwind: config ? { arquivo: st.configTailwind, fontes: config.fontes, coresSemAlfa: config.semAlfa, raios: config.raios, movimento: config.movimento, darkMode: config.darkMode, plugins: config.plugins } : null,
  };
}

const linhas = (pares, vazio = "—") => (pares.length ? pares.map(([k, v]) => `\`${k}\` ${v}`).join(" · ") : vazio);
const comLado = (lista) => (lista.length ? lista.map(([k, n, d]) => `\`${k}\` ${n} (ui ${d.ui} · tela ${d.tela})`).join(" · ") : "—");
const somaLado = (lista, l) => lista.reduce((s, [, , d]) => s + d[l], 0);

/** O relatório em markdown, para colar na auditoria. */
export function emMarkdown(m) {
  const s = m.stack;
  const vs = m.valorSolto;
  const al = m.alturas;
  const variantes = Object.entries(al.variantes).map(([peca, d]) => `\`${peca}\` ${Object.entries(d).map(([k, v]) => `${k}${v.px !== null ? ` ${v.px}px` : ""} ×${v.usos}`).join(", ")}`);
  const t = m.tokens;
  const cfg = m.configTailwind;
  return [
    `## Números de deriva — ${m.pasta}`,
    "",
    `- **Stack:** React ${s.react ?? "?"} · ${s.framework} · Tailwind ${s.tailwind ?? "ausente"}${s.tailwindVersao ? ` (v${s.tailwindVersao})` : ""}${s.configTailwind ? ` · ${s.configTailwind}` : ""} · shadcn ${s.shadcn ? `estilo ${s.shadcn.estilo ?? "?"}` : "sem components.json"}${s.avisos.length ? ` · **aviso:** ${s.avisos.join("; ")}` : ""}`,
    `- **Densidade (design/design-system.json):** ${m.wicomm ? `${m.wicomm.densidade ?? "não declarada"}${m.wicomm.densidadePorRota ? ` · por rota: ${Object.entries(m.wicomm.densidadePorRota).map(([r, d]) => `\`${r}\` ${d}`).join(", ")}` : ""}` : "sem design/design-system.json — decida por rota (skill, passo 2)"}`,
    `- **Arquivos medidos:** ${m.arquivos} (${m.lidos.telas} de tela e CSS alcançável · ${m.lidos.logicaComClasse.length} \`.ts/.js\` que montam classe${m.lidos.logicaComClasse.length ? `: ${m.lidos.logicaComClasse.slice(0, 8).map((c) => `\`${c}\``).join(", ")}` : ""})`,
    `- **CSS que ninguém importa (fora da medida):** ${m.lidos.cssSemImport.length ? m.lidos.cssSemImport.map((c) => `\`${c}\``).join(", ") : "nenhum"}`,
    `- **Valor solto:** ${vs.total} (ui ${vs.ui} · tela ${vs.tela}; a cor dentro de um composto conta uma vez no total) — ${comLado(vs.porCategoria)}`,
    `- **Piores arquivos (e o que mais se repete):** ${vs.piores.length ? vs.piores.map(([c, n, rep]) => `\`${c}\` ${n}${rep.length ? ` (${rep.map(([k, x]) => `\`${k}\` ×${x}`).join(", ")})` : ""}`).join(" · ") : "—"}`,
    `- **Paleta Tailwind usada direto (COR-05):** ${m.paleta.total} (ui ${somaLado(m.paleta.porUtilitaria, "ui")} · tela ${somaLado(m.paleta.porUtilitaria, "tela")})${m.paleta.idioma ? ` · no idioma de cor \`${m.paleta.idioma}\`: ${m.paleta.noIdioma}, permitido` : " · sem idioma de cor declarado"} — por família: ${linhas(m.paleta.porFamilia)} — por arquivo: ${linhas(m.paleta.porArquivo)}`,
    `- **Branco e preto direto:** ${m.paleta.brancoPreto.total} — ${comLado(m.paleta.brancoPreto.porClasse)}`,
    m.alfaSemCss ? `- **Cor com alfa que não gera CSS (Tailwind v3):** ${m.alfaSemCss.total} — ${comLado(m.alfaSemCss.porClasse.slice(0, 12))}` : `- **Cor com alfa que não gera CSS:** não se aplica (Tailwind ${s.tailwindVersao ?? "?"})`,
    `- **Ícones por biblioteca (arquivos que importam):** ${linhas(m.icones)} · **lucide:** ${m.iconesLucide.distintos} distintos; tamanho por uso: ${linhas(m.iconesLucide.tamanhos.map(([k, n]) => [typeof k === "number" ? `${k}px` : k, n]))}; **fora de 14/16/18: ${m.iconesLucide.foraDaEscala}** (CTRL-09)`,
    `- **Tamanhos de fonte distintos:** ${m.tamanhosDeFonte.length} — ${linhas(m.tamanhosDeFonte)}`,
    `- **Raios distintos:** ${new Set(m.raios.map(([, , px]) => px)).size} valores em px, ${m.raios.length} classes — ${m.raios.map(([k, n, px]) => `\`${k}\` ${n}${px !== null && px !== undefined ? ` (${px}px)` : ""}`).join(" · ") || "—"}`,
    `- **Altura de controle (CTRL-01):** ${al.controle.length} distintas — ${linhas(al.controle)}`,
    `- **Variantes de tamanho das peças (declarada → usos fora da ui):** ${variantes.join(" · ") || "—"}`,
    `- **Quadrados (ícone, avatar: \`size-*\`, \`h-N w-N\`):** ${linhas(al.quadrado.slice(0, 10))}`,
    `- **Outras alturas (barra, área):** ${al.outra.length} distintas — ${linhas(al.outra.slice(0, 12))}`,
    `- **Animação sem escape (MOV-02):** ${m.animacaoSemEscape.ocorrencias} ocorrências em ${m.animacaoSemEscape.arquivos.length} arquivos (\`transition-colors\` isento; o escape na mesma string) — ${comLado(m.animacaoSemEscape.porTipo.slice(0, 10))}${m.animacaoSemEscape.arquivos.length ? ` — ${m.animacaoSemEscape.arquivos.slice(0, 10).map(([c, n]) => `\`${c}\` ${n}`).join(", ")}` : ""}`,
    `- **Tokens do projeto:** ${t.declaradas} variáveis (${t.noRoot} em \`:root\`), **${t.semUso.length} sem uso**${t.semUso.length ? ` (${t.semUso.slice(0, 12).map((n) => `\`${n}\``).join(", ")}${t.semUso.length > 12 ? "…" : ""})` : ""} · \`transparent\` (CONV-03): ${t.transparentes.map((n) => `\`${n}\``).join(", ") || "nenhum"} · diferentes da referência (sistema + tema ${m.tema ?? "padrão"}): ${t.diferencas.length}${t.diferencas.length ? ` (${t.diferencas.slice(0, 8).map((d) => `\`${d.nome}\` ${d.tema} ${d.projeto} × ${d.wicomm}`).join(", ")}${t.diferencas.length > 8 ? "…" : ""})` : ""} · da referência que o projeto não tem: ${t.faltando ?? "?"}`,
    `- **Tema escuro:** ${t.temaEscuro}${t.temaEscuro === "declarado" ? " (há variáveis do escuro, mas nada liga o tema)" : ""} · variantes \`dark:\` no código: ${t.variantesDark}`,
    cfg
      ? `- **Config do Tailwind (\`${cfg.arquivo}\`):** fontes ${linhas(Object.entries(cfg.fontes))} · cores de tema sem \`<alpha-value>\`: ${cfg.coresSemAlfa.length} · raios ${linhas(Object.entries(cfg.raios))} · movimento solto: ${cfg.movimento.length ? cfg.movimento.map((x) => `${x.onde} ${x.tipo} \`${x.valor}\``).join(", ") : "nenhum"} · darkMode ${cfg.darkMode ?? "padrão"} · plugins ${cfg.plugins.join(", ") || "—"}`
      : "- **Config do Tailwind:** nenhum",
    `- **Peças em ${s.pastaUi ?? "(sem pasta ui)"} (usos fora dela):** ${s.pecas.length} — ${m.pecasComUso.map(([p, n]) => `${p} ${n}`).join(", ") || "—"}`,
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
  const args = process.argv.slice(2);
  const comValor = new Set(["--pasta", "--idioma"]);
  const raiz = args.find((a, i) => !a.startsWith("--") && !comValor.has(args[i - 1]));
  if (!raiz || !existsSync(raiz)) {
    console.error("uso: node medir-deriva.mjs <raiz do projeto> [--pasta <pasta do front>] [--idioma <arquivo>] [--json]");
    process.exitCode = 2;
  } else {
    const opcao = (n) => (args.indexOf(n) >= 0 ? args[args.indexOf(n) + 1] : undefined);
    const m = medirProjeto(raiz, opcao("--pasta") ?? ".", { idioma: opcao("--idioma") });
    process.stdout.write(args.includes("--json") ? JSON.stringify(m, null, 2) + "\n" : emMarkdown(m) + "\n");
  }
}
