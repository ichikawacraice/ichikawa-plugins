/**
 * **O tema que as medidas usam** — o que é da marca: a cor dela e a razão aceita da tinta sobre ela (MARCA-01).
 *
 * O projeto que aplicou o tema tem a cópia em `design/tema/` (a skill `aplicar-tema` a grava); sem ela, vale o tema
 * Wicomm que o plugin carrega em `tema/`. O plugin se instala sozinho: não lê o pacote de tokens nem outro plugin.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const TEMA_PADRAO = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "tema");

/** `{ id, nome, marca, contrasteAceito }` da pasta de um tema (ou do padrão). Pasta sem os dois arquivos é erro. */
export function temaDaMedida(pasta = TEMA_PADRAO) {
  for (const f of ["tema.json", "tema.tokens.json"]) {
    if (!existsSync(join(pasta, f))) throw new Error(`o tema em ${pasta} não tem ${f}`);
  }
  const meta = JSON.parse(readFileSync(join(pasta, "tema.json"), "utf-8"));
  const cores = JSON.parse(readFileSync(join(pasta, "tema.tokens.json"), "utf-8"));
  return { id: meta.id, nome: meta.nome, marca: String(cores.marca?.cor?.$value ?? "").toUpperCase(), contrasteAceito: meta.contrasteAceitoSobreAMarca };
}

/** O tema do projeto: `design/tema/` quando existe, senão o padrão. */
export const temaDoProjeto = (raiz) => temaDaMedida(pastaDoTema(raiz));

/** O valor de um token do tema no tema dado: o `$value`, ou a variante do escuro em `$extensions` quando há. */
const valor = (token, tema) => String((tema === "escuro" && token?.$extensions?.["com.wicomm"]?.escuro) || token?.$value || "").toUpperCase();

/**
 * As variáveis CSS que vêm da marca do tema, por tema (`{ claro, escuro }`): o que a medida de deriva compara com a
 * cor do tema, e não com a do sistema. Os nomes são os do sistema (o que o pacote de tokens gera a partir do slot).
 */
export function variaveisDaMarca(pasta = TEMA_PADRAO) {
  const m = JSON.parse(readFileSync(join(pasta, "tema.tokens.json"), "utf-8")).marca ?? {};
  const doTema = (tema) => {
    const v = {};
    for (const n of ["--primary", "--marca-viva", "--ring", "--sidebar-primary", "--sidebar-ring", "--chart-1"]) v[n] = valor(m.cor, tema);
    v["--primary-hover"] = valor(m.hover, tema);
    for (const n of ["--primary-foreground", "--sidebar-primary-foreground"]) v[n] = valor(m.sobre, tema);
    v["--marca-tinta"] = valor(m.tinta, tema);
    v["--primary-gradient-start"] = valor(m.gradiente?.inicio, tema);
    v["--primary-gradient-mid"] = valor(m.gradiente?.meio, tema);
    v["--primary-gradient-end"] = valor(m.gradiente?.fim, tema);
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x));
  };
  return { claro: doTema("claro"), escuro: doTema("escuro") };
}

/** A pasta do tema do projeto: `design/tema/` quando existe, senão a do padrão. */
export const pastaDoTema = (raiz) => (existsSync(join(raiz, "design", "tema", "tema.json")) ? join(raiz, "design", "tema") : TEMA_PADRAO);
