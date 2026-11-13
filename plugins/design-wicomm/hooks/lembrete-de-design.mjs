#!/usr/bin/env node
/**
 * **O lembrete do processo de design, no pedido.** Hook `UserPromptSubmit` do plugin `design-wicomm`.
 *
 * Se o pedido fala de design e o projeto diz onde está o front (`visual` ou `pasta` do `design/design-system.json`, ou
 * a opção `pasta_do_front`), injeta uma linha de contexto: tela nova passa pelo `designer` antes do código e pelo
 * `critico-de-ui` depois; ajuste de tela que já existe vai direto, com a crítica opcional (CONV-19).
 *
 * **Só lembra.** Não nega ferramenta, não segura o turno, não grava estado. `lembrete: false` no arquivo do projeto
 * desliga. Erro nunca prende: sai 0 sem saída e a mensagem vai para o stderr.
 */
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { telasDoProjeto } from "./config.mjs";

/** Pedido que fala de design. Largo de propósito: o custo de um lembrete a mais é uma linha. */
export const PEDIDO_DE_DESIGN =
  /\b(design|ui|ux|layout|visual|tela|telas|interface|componente|componentes|anima[çc][ãa]o|transi[çc][ãa]o|hierarquia|densidade|painel|bot[ãa]o|cores?|tipografia|espa[çc]amento|redesenh\w*|desenh\w*)\b/i;

export const textoDoLembrete = (temArquivo) =>
  "Demanda de design no front. **Tela nova** (rota, vista, aba, painel, diálogo que não existia) ou redesenho: antes do código, " +
  "o agente `designer` faz a revisão de arquitetura (skill `revisao-de-arquitetura-de-ui`); depois do código, o `critico-de-ui` " +
  "julga em contexto separado — obrigatório na tela nova. **Ajuste de tela que já existe** (texto, ordem, campo, estado, botão): " +
  "vai direto ao código, sem designer; a crítica é opcional. Só o texto da tela: skill `textos-de-interface`. " +
  "Acessibilidade: skill `acessibilidade`. " +
  (temArquivo
    ? "Fontes: as de `fontes` do `design/design-system.json` (ou `design/wicomm.json`); sem elas, a base do plugin."
    : "Este projeto não tem `design/design-system.json`: as fontes são as dele, e a base do plugin entra como referência (`/design-wicomm:novo` ou `/design-wicomm:auditar` o põem no sistema).");

/** O lembrete, ou `null`. `ctx.telas(cwd)` é trocável no teste. */
export function decidir(evento, ctx = { telas: (r) => telasDoProjeto(r) }) {
  if (evento?.hook_event_name !== "UserPromptSubmit") return null;
  if (!PEDIDO_DE_DESIGN.test(String(evento?.prompt ?? ""))) return null;
  const telas = ctx.telas(evento?.cwd || process.cwd());
  if (!telas || telas.projeto?.lembrete === false) return null;
  return { hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: textoDoLembrete(Boolean(telas.projeto?.temArquivo)) } };
}

export function main(entrada) {
  try {
    const decisao = decidir(JSON.parse(entrada));
    if (decisao) process.stdout.write(JSON.stringify(decisao));
  } catch (e) {
    console.error(`[lembrete-de-design] ${e?.message ?? e}`);
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
