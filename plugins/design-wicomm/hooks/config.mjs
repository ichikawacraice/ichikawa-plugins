/**
 * **A configuração do plugin `design-wicomm` num projeto, lida do disco.**
 *
 * O contrato é um arquivo só: `design/design-system.json` na raiz do projeto (versão do sistema, densidade, pasta do
 * front, peças instaladas). O nome antigo, `design/wicomm.json`, vale no projeto que já o tem: com os dois, o antigo vale
 * por baixo do novo, chave a chave.
 *
 * Precedência de cada chave: `design/design-system.json` > `design/wicomm.json` > opção do plugin > padrão.
 *
 * Aqui também mora o que diz "isto é tela" (`telasDoProjeto`, `eCodigoDeTela`): o lembrete e o aviso de valor solto
 * usam a mesma régua.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const PLUGIN = "design-wicomm";
export const ARQUIVO_DO_PROJETO = join("design", "design-system.json");
export const ARQUIVO_ANTIGO = join("design", "wicomm.json");

/** As opções do plugin (`userConfig` do plugin.json); o teste confere que as duas listas concordam. */
export const OPCOES_DO_PLUGIN = ["pasta_do_front", "largura"];

/** As extensões que o padrão derivado de `pasta` conta como tela. */
const EXTENSOES_DE_TELA = ["tsx", "jsx", "vue", "svelte", "css", "scss", "html"];

/** Exclusões do padrão derivado de `pasta`: teste não é tela. */
const TESTES_FORA = ["*.test.*", "*.spec.*", "__tests__/**"];

const objeto = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const lista = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.length > 0) : []);

/**
 * O arquivo de configuração deste projeto: o nome novo se existe; senão o antigo, se existe; senão o novo (para criar).
 */
export function arquivoDoProjeto(raiz) {
  if (existsSync(join(raiz, ARQUIVO_DO_PROJETO))) return join(raiz, ARQUIVO_DO_PROJETO);
  if (existsSync(join(raiz, ARQUIVO_ANTIGO))) return join(raiz, ARQUIVO_ANTIGO);
  return join(raiz, ARQUIVO_DO_PROJETO);
}

/** JSON de um arquivo de settings, ou `null` se falta ou não lê (nunca lança: erro de leitura é "sem opção"). */
export function lerSettings(caminho) {
  try {
    if (!existsSync(caminho)) return null;
    const lido = JSON.parse(readFileSync(caminho, "utf-8").replace(/^\uFEFF/, ""));
    return objeto(lido) ? lido : null;
  } catch {
    return null;
  }
}

/** JSON de um arquivo do projeto: `{}` quando falta; ilegível é erro (config quebrada não fica calada). */
export function lerJsonDoProjeto(caminho) {
  if (!existsSync(caminho)) return {};
  let lido;
  try {
    lido = JSON.parse(readFileSync(caminho, "utf-8").replace(/^\uFEFF/, ""));
  } catch (e) {
    throw new Error(`${caminho} ilegível: ${e.message}`);
  }
  return objeto(lido) ? lido : {};
}

/** A pasta de configuração da conta: `CLAUDE_CONFIG_DIR` quando o env o diz, senão `<home>/.claude`. */
export const pastaDeConfig = (home = homedir(), env = process.env) => (env?.CLAUDE_CONFIG_DIR ? env.CLAUDE_CONFIG_DIR : join(home, ".claude"));

/** As opções gravadas para `design-wicomm@*` em `pluginConfigs` do settings da conta (`{}` sem nada gravado). */
export function opcoesDoPlugin(home = homedir(), env = process.env) {
  const configs = lerSettings(join(pastaDeConfig(home, env), "settings.json"))?.pluginConfigs;
  if (!objeto(configs)) return {};
  const chave = Object.keys(configs).find((id) => id.split("@")[0] === PLUGIN && id.includes("@"));
  const opcoes = chave ? configs[chave]?.options : null;
  return objeto(opcoes) ? opcoes : {};
}

/** Booleano de um valor: `false`/"false" desliga; ausente ou outra coisa fica no padrão. */
export function booleanoDaOpcao(valor, padrao = true) {
  if (valor === false || /^(false|0|no|off)$/i.test(String(valor ?? ""))) return false;
  if (valor === true || /^(true|1|yes|on)$/i.test(String(valor ?? ""))) return true;
  return padrao;
}

/**
 * O valor de uma opção do plugin: a variável `CLAUDE_PLUGIN_OPTION_<CHAVE>` que o app exporta para o hook; sem ela, o
 * que o app gravou em `pluginConfigs`; sem nenhum dos dois, `undefined` (vale o padrão de quem lê).
 */
export function opcao(chave, { home = homedir(), env = process.env } = {}) {
  const doEnv = env[`CLAUDE_PLUGIN_OPTION_${chave.toUpperCase()}`];
  if (doEnv !== undefined && doEnv !== "") return doEnv;
  return opcoesDoPlugin(home, env)[chave];
}

/**
 * A configuração do projeto, já com a precedência aplicada entre os dois nomes do arquivo. `temArquivo` diz se o
 * projeto entrou no sistema. Arquivo ilegível é erro.
 */
export function configDoProjeto(raiz) {
  const antigo = lerJsonDoProjeto(join(raiz, ARQUIVO_ANTIGO));
  const novo = lerJsonDoProjeto(join(raiz, ARQUIVO_DO_PROJETO));
  return { ...antigo, ...novo, temArquivo: existsSync(arquivoDoProjeto(raiz)) };
}

/**
 * Os globs do que é tela neste projeto: `visual` do arquivo; sem ele, derivados da pasta do front (`pasta`, senão a
 * opção `pasta_do_front`): as telas por extensão, sem os testes. `null` quando o projeto não diz onde está o front.
 * `ambiente`: `{ home, env }`, trocáveis nos testes.
 */
export function telasDoProjeto(raiz, ambiente = {}) {
  const amb = { home: ambiente.home ?? homedir(), env: ambiente.env ?? process.env };
  const projeto = configDoProjeto(raiz);
  const visual = lista(projeto.visual);
  if (visual.length > 0) return { visual, projeto };
  const doProjeto = typeof projeto.pasta === "string" ? projeto.pasta : "";
  const daOpcao = typeof opcao("pasta_do_front", amb) === "string" ? opcao("pasta_do_front", amb) : "";
  if (!doProjeto && !daOpcao) return null;
  const pasta = (doProjeto || daOpcao).replace(/^(?:\.\/)+(?=.)/, "").replace(/\/+$/, "") || ".";
  const derivado = pasta === "."
    ? [...EXTENSOES_DE_TELA.map((e) => `**/*.${e}`), ...TESTES_FORA.map((g) => `!**/${g}`)]
    : [...EXTENSOES_DE_TELA.map((e) => `${pasta}/**/*.${e}`), ...TESTES_FORA.map((g) => `!${pasta}/**/${g}`)];
  return { visual: derivado, projeto };
}

/** Glob (`**`, `*`, `?`) → RegExp sobre caminho com `/`. */
export function globParaRegex(glob) {
  let r = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        i++;
        if (glob[i + 1] === "/") {
          i++;
          r += "(?:.*/)?";
        } else r += ".*";
      } else r += "[^/]*";
    } else if (c === "?") r += "[^/]";
    else r += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${r}$`);
}

/**
 * Código de tela segundo os globs. Casa em qualquer ponto do caminho (sufixo depois de `/`), para pegar também o
 * caminho absoluto de outro worktree.
 */
export function eCodigoDeTela(caminho, globs) {
  if (typeof caminho !== "string" || caminho.length === 0) return false;
  const partes = caminho.split("\\").join("/").split("/");
  const incluidos = globs.filter((g) => !g.startsWith("!")).map(globParaRegex);
  const excluidos = globs.filter((g) => g.startsWith("!")).map((g) => globParaRegex(g.slice(1)));
  for (let i = 0; i < partes.length; i++) {
    const sufixo = partes.slice(i).join("/");
    if (incluidos.some((r) => r.test(sufixo)) && !excluidos.some((r) => r.test(sufixo))) return true;
  }
  return false;
}
