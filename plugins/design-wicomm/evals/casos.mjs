#!/usr/bin/env node
/**
 * **Os casos de eval de disparo das skills do plugin `wicomm`, numa fonte só.**
 *
 *   node evals/casos.mjs          — (re)gera as pastas `evals/<skill>--<sim|nao>-NN/` a partir da lista abaixo
 *   node evals/casos.mjs --conferir — sai 1 se as pastas não batem com a lista (o teste do repositório usa)
 *
 * Positivo: o pedido tem de disparar o alvo. Negativo: o pedido é vizinho (outra skill do plugin, outra tarefa de
 * front, loja fora do escopo) e o alvo não pode disparar. O alvo das skills novas é a ferramenta `Skill`; o das duas
 * skills do motor é o subagente que as carrega (`designer`, `critico-de-ui`), porque é assim que o processo as chama
 * (CONV-19: a crítica no mesmo contexto não conta).
 *
 * Rodar (custa uma sessão por caso e rodada): `claude plugin eval plugins/design-system --ablation none --no-publish --runs 3`.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PASTA = dirname(fileURLToPath(import.meta.url));

/** Cada skill: o alvo (ferramenta e o que casa no input) e os pedidos que disparam e que não disparam. */
export const SKILLS = {
  "novo-projeto": {
    alvo: { tool: "Skill", casa: "novo-projeto" },
    sim: [
      "Vou começar um painel interno novo em React para o time de atendimento. Monta a base do projeto no padrão Wicomm.",
      "Cria do zero um app Next para controle de estoque da Wicomm, já com o design system.",
      "Projeto novo: um sistema de agendamento de reuniões com clientes. Quero que nasça com a cara da Wicomm.",
      "Faz o bootstrap de um app Vite + React novo dentro do design system da Wicomm.",
      "Acabei de criar a pasta vazia de um app novo de relatórios. Configura o design system Wicomm nele.",
      "Quero iniciar um sistema novo de gestão de contratos em React seguindo o padrão visual da Wicomm.",
      "Começa um app React novo para o financeiro, com a base de design da empresa e a primeira tela.",
      "Preciso subir um projeto novo de portal do cliente. Inicializa ele no sistema de design Wicomm.",
      "Novo app interno de onboarding de colaboradores: prepara o projeto com DESIGN, ANATOMIA e a configuração do plugin.",
      "/design-wicomm:novo — app de acompanhamento de chamados",
    ],
    nao: [
      "Audita este app React existente e me diz quanto ele foge do padrão Wicomm.",
      "Monta o plano de padronização a partir da auditoria que fizemos ontem.",
      "Vou criar uma loja nova em FastStore para um cliente. Monta o storefront.",
      "Qual componente do kit eu uso para confirmar a exclusão de um registro?",
      "Atualiza o design system deste projeto para a versão nova da base.",
      "Explica a diferença entre useMemo e useCallback.",
      "Cria um endpoint de API em Node que lista os pedidos do dia.",
      "Escreve um teste unitário para a função formatarMoeda.",
      "Corrige o erro de tipagem no arquivo src/lib/datas.ts.",
      "Configura o ESLint com as regras de hooks do React neste projeto.",
    ],
  },
  "auditar-projeto": {
    alvo: { tool: "Skill", casa: "auditar-projeto" },
    sim: [
      "Audita este app React contra o padrão Wicomm e grava a auditoria.",
      "Quanto o WiControl se afasta do design system da Wicomm? Quero números.",
      "Mede a deriva visual deste projeto: cores soltas, valores arbitrários, ícones, raios.",
      "Faz um diagnóstico de design do app existente antes de a gente padronizar.",
      "/design-wicomm:auditar",
      "Antes de migrar este painel para a base Wicomm, levanta tudo o que está fora do padrão.",
      "Quero saber quantas cores literais e tamanhos de fonte diferentes este front tem, comparado com a base Wicomm.",
      "Classifica cada rota deste app num arquétipo da ANATOMIA e mapeia os componentes para os do registro.",
      "Este projeto antigo não segue o design system. Mede o tamanho do problema, só lendo.",
      "Roda a auditoria Wicomm no frontend deste repositório e me dá a nota por eixo das telas principais.",
    ],
    nao: [
      "Começa um app React novo do zero no padrão Wicomm.",
      "Desenha a tela de cadastro de clientes.",
      "Faz uma auditoria de segurança deste código atrás de injeção de SQL.",
      "Audita as dependências do package.json atrás de pacote vulnerável.",
      "Mostra a versão do design system instalada e a nota média das críticas.",
      "Instala o componente de diálogo do registro Wicomm.",
      "Melhora a performance da lista de pedidos, ela está lenta para renderizar.",
      "Revisa este PR de backend que muda a fila de mensagens.",
      "Escreve a documentação da API de faturamento.",
      "Traduz os textos da tela de login para inglês.",
    ],
  },
  "plano-de-padronizacao": {
    alvo: { tool: "Skill", casa: "plano-de-padronizacao" },
    sim: [
      "Com a auditoria pronta, monta o plano de padronização deste app para a base Wicomm.",
      "/design-wicomm:padronizar",
      "Como trazemos este projeto existente para o padrão Wicomm? Quero as fatias em ordem.",
      "A auditoria de design está em docs/design/auditoria-2026-10-30.md. Transforma em plano de PRs.",
      "Planeja a migração deste front para o design system da Wicomm, sem mudar a lógica do produto.",
      "Quais PRs, em que ordem, para padronizar o visual deste app com a base Wicomm?",
      "Faz o plano de padronização: Tailwind v4 primeiro, depois tokens com ponte, primitivas, casco e telas.",
      "Quero padronizar o WiControl no design system. Monta o plano a partir da auditoria.",
      "Divide em fatias a adequação deste painel ao padrão visual da Wicomm.",
      "Monta o roteiro de padronização do app a partir dos números de deriva que medimos.",
    ],
    nao: [
      "Audita o projeto contra o padrão Wicomm.",
      "Começa um app novo no design system Wicomm.",
      "Monta o plano de migração do banco de Postgres 14 para 16.",
      "Planeja a sprint da semana que vem.",
      "Atualiza a base do design system deste projeto para a versão nova.",
      "Qual peça do kit uso para mostrar o estado de um pedido?",
      "Refatora o serviço de autenticação para usar o novo cliente HTTP.",
      "Escreve o plano de testes de integração do checkout.",
      "Cria um script que exporta os relatórios para CSV.",
      "Explica o que é Tailwind v4 e o que mudou da v3.",
    ],
  },
  "peca-do-kit": {
    alvo: { tool: "Skill", casa: "peca-do-kit" },
    sim: [
      "Preciso de um diálogo de confirmação para excluir um cliente. Qual peça do kit Wicomm uso e como instalo?",
      "Instala o botão do registro Wicomm neste projeto.",
      "Qual componente do kit eu uso para uma ajuda ao lado do campo?",
      "Falta um componente de passos (stepper) no kit. O que faço?",
      "Adiciona do registro @wicomm a peça de toast.",
      "Que peça da base mostra o estado de uma linha da lista?",
      "Preciso de um seletor de vista (lista/quadro). Tem no kit Wicomm?",
      "Traz do registro Wicomm o menu de ações do objeto.",
      "Qual é o componente certo, pela ANATOMIA, para um aviso que fica até a pessoa fechar?",
      "Quero usar um skeleton de carregamento do kit. Instala e anota a versão.",
    ],
    nao: [
      "Desenha a tela de detalhes do pedido.",
      "Critica a tela de pedidos que acabei de mudar.",
      "Audita este projeto contra o padrão Wicomm.",
      "Instala o pacote date-fns no projeto.",
      "Atualiza todas as peças do sistema para a versão nova do registro e a base junto.",
      "Cria um hook React que busca os pedidos com paginação.",
      "Explica como funciona o registro do npm.",
      "Conserta o bug em que o modal de login não fecha no celular.",
      "Configura o Storybook neste projeto.",
      "Escreve o README do repositório.",
    ],
  },
  "atualizar-sistema": {
    alvo: { tool: "Skill", casa: "atualizar-sistema" },
    sim: [
      "Atualiza o design system deste projeto para a versão nova da Wicomm.",
      "/design-wicomm:atualizar",
      "O estado diz que estamos na versão velha da base. Sobe para a corrente.",
      "Saiu a versão nova da base Wicomm. Traz para este app sem perder o que acrescentamos na ANATOMIA.",
      "Faz o merge da base nova do design system com as nossas cópias em design/.",
      "Sobe os tokens, a base e as peças do sistema Wicomm para a última versão.",
      "Este projeto ficou para trás no sistema de design. Atualiza.",
      "A base Wicomm mudou a regra de mensagens. Atualiza o projeto para a nova versão.",
      "Atualiza as peças instaladas do registro Wicomm e me mostra as que editamos aqui.",
      "Traz a versão corrente do sistema de design para este repositório.",
    ],
    nao: [
      "Atualiza o React para a versão 19 neste projeto.",
      "Começa um app novo no padrão Wicomm.",
      "Mostra em que versão do sistema este projeto está.",
      "Audita o projeto contra a base.",
      "Atualiza o README com os passos de instalação.",
      "Roda npm update e me diz o que quebrou.",
      "Instala o componente de diálogo do registro Wicomm.",
      "Atualiza a data do relatório para hoje.",
      "Muda a cor do botão primário para azul.",
      "Escreve uma migration que adiciona a coluna status na tabela pedidos.",
    ],
  },
  "aplicar-tema": {
    alvo: { tool: "Skill", casa: "aplicar-tema" },
    sim: [
      "Aplica o tema Wicomm neste projeto.",
      "/design-wicomm:aplicar-tema",
      "Liga este app ao tema da Wicomm: marca, fonte Archivo e registro @wicomm.",
      "Copia o tema Wicomm para design/tema/ e confere o components.json.",
      "O projeto entrou no sistema; falta ligar o tema da marca.",
      "Confere se este app usa a fonte e o registro do tema Wicomm.",
      "Põe o tema da Wicomm no projeto para o medir-contraste ler a marca certa.",
      "Este app ainda não tem design/tema/. Aplica o tema da empresa.",
      "Liga o tema Wicomm aqui e me diz o que falta no layout para a fonte.",
      "Grava o tema wicomm no design/design-system.json e copia a pasta do tema.",
    ],
    nao: [
      "Muda a cor da marca para azul.",
      "Começa um app novo no padrão Wicomm.",
      "Audita o projeto contra a base.",
      "Troca o tema do VS Code para escuro.",
      "Instala o componente de tabela do registro.",
      "Liga o modo escuro na tela de configurações.",
      "Atualiza a base do design system para a versão nova.",
      "Revisa o texto do botão de confirmar exclusão.",
      "Mede o contraste dos tokens deste projeto.",
      "Escreve a migration que cria a tabela de pedidos.",
    ],
  },
  acessibilidade: {
    alvo: { tool: "Skill", casa: "acessibilidade" },
    sim: [
      "Audita a acessibilidade da tela de pedidos.",
      "Esta tela de cadastro é acessível? Confere contra o WCAG AA.",
      "Checa a11y do formulário de login antes do PR.",
      "O contraste dos textos do painel passa nos dois temas? E o foco aparece?",
      "Dá para usar a lista de clientes só com o teclado? Revisa isso para mim.",
      "Revisa como o leitor de tela anuncia os botões e os erros da tela de configurações.",
      "Os botões de ícone da tabela de pedidos têm nome acessível e alvo de toque suficiente?",
      "Faz uma auditoria WCAG 2.1 AA do app inteiro.",
      "Antes de abrir o PR da tela nova de relatórios, verifica acessibilidade: contraste, teclado, rótulos.",
      "Um cliente reclamou que não consegue usar o sistema com leitor de tela. Levanta o que está quebrado.",
    ],
    nao: [
      "Critica a tela de pedidos que acabei de mudar.",
      "Que texto eu ponho no botão que exclui um pedido?",
      "Audita este app React contra o padrão Wicomm e grava a auditoria.",
      "Faz uma auditoria de segurança deste código atrás de injeção de SQL.",
      "Desenha a tela de cadastro de clientes.",
      "Melhora a performance da lista de pedidos, ela está lenta para renderizar.",
      "Escreve um teste unitário para a função formatarMoeda.",
      "Qual componente do kit eu uso para confirmar a exclusão de um registro?",
      "Configura o ESLint com as regras de hooks do React neste projeto.",
      "Revisa a tela nova de relatórios antes do PR: hierarquia, densidade e ação primária.",
    ],
  },
  "textos-de-interface": {
    alvo: { tool: "Skill", casa: "textos-de-interface" },
    sim: [
      "Que texto eu ponho no botão que exclui um pedido?",
      "Escreve a mensagem de erro para quando o upload da imagem falha.",
      "Revisa os textos da tela de checkout interno: botões, erros e vazios.",
      "Escreve o título e os rótulos dos botões do diálogo que confirma o arquivamento de um cliente.",
      "Escreve o texto do estado vazio da lista de chamados.",
      "Esta mensagem \"Ocorreu um erro\" está ruim. Reescreve.",
      "Revisa a microcopy do formulário de cadastro de produto.",
      "Qual o rótulo certo para o botão que publica a página agora?",
      "Faz o UX writing das mensagens de sucesso e de espera da importação de planilha.",
      "Os textos da tela de configurações estão com termo técnico do banco. Reescreve nas palavras de quem usa.",
    ],
    nao: [
      "Audita a acessibilidade da tela de pedidos.",
      "Traduz os textos da tela de login para inglês.",
      "Critica a tela de pedidos que acabei de mudar.",
      "Escreve a documentação da API de faturamento.",
      "Escreve o README deste repositório.",
      "Escreve a mensagem do commit destas mudanças.",
      "Desenha a tela de cadastro de clientes.",
      "Escreve um e-mail para o cliente explicando o atraso na entrega.",
      "Cria um endpoint de API em Node que lista os pedidos do dia.",
      "Onde ponho o aviso de que a sincronização com o servidor falhou?",
    ],
  },
  "revisao-de-arquitetura-de-ui": {
    alvo: { tool: "Agent", casa: "designer" },
    sim: [
      "Desenha a tela de lista de pedidos deste app.",
      "A tela de detalhes do cliente está confusa, tem informação demais. Redesenha.",
      "Onde ponho o aviso de que a sincronização falhou?",
      "Cria a tela de cadastro de fornecedores.",
      "Reorganiza o painel inicial: está tudo com o mesmo peso.",
      "Preciso de um fluxo de convite de usuário, do botão ao e-mail enviado. Desenha.",
      "Faz a revisão de arquitetura da nova tela de configurações.",
      "Vamos mudar a barra lateral para caber os módulos novos. Pensa no desenho antes.",
      "Quero uma tela de relatório mensal com filtros e gráfico. Desenha a tela.",
      "Essa mensagem de erro aparece longe do campo. Repensa onde ela mora.",
    ],
    nao: [
      "Corrige o bug de cálculo do total do pedido no backend.",
      "Escreve o teste do serviço de e-mail.",
      "Audita o projeto contra o padrão Wicomm.",
      "Explica o que é um design system.",
      "Instala o componente de toast do registro.",
      "Monta o plano de padronização a partir da auditoria.",
      "Configura o CI do GitHub Actions para rodar os testes.",
      "Renomeia a variável usuarioAtual para usuarioLogado em todo o projeto.",
      "Cria a migration da tabela de faturas.",
      "Otimiza a consulta SQL que lista os clientes inativos.",
    ],
  },
  "critica-de-ui": {
    alvo: { tool: "Agent", casa: "critico-de-ui" },
    sim: [
      "Critica a tela de pedidos que acabei de mudar.",
      "Revisa o design da tela de login antes de eu abrir o PR.",
      "O que está ruim nesta tela de configurações? Dá a nota.",
      "Julga a revisão de arquitetura que o designer gravou em docs/design/revisoes/2026-10-30-clientes.md.",
      "Mexi no visual do painel inicial. Passa pelo crítico.",
      "Dá a nota da crítica da nova tela de relatório.",
      "Antes do PR de front, critica a barra lateral nova.",
      "A tela de cadastro ficou boa? Quero a crítica com os problemas e a correção.",
      "Revisa o componente de cartão de cliente que eu redesenhei.",
      "Terminei a tela de faturas. Critica antes de eu mergear.",
    ],
    nao: [
      "Revisa este PR de backend que muda a fila de mensagens.",
      "Faz code review do serviço de pagamentos atrás de bugs.",
      "Audita o projeto contra o padrão Wicomm.",
      "Desenha a tela de detalhes do pedido.",
      "Escreve testes para o componente de botão.",
      "Mostra a nota média das críticas deste projeto e a versão do sistema.",
      "Revisa a ortografia do README.",
      "Analisa o log do servidor e diz por que caiu às 3h.",
      "Melhora a mensagem do commit que acabei de fazer.",
      "Critica este texto de e-mail de cobrança para o cliente.",
    ],
  },
};

/**
 * O contexto de toda rodada: o eval começa num workspace vazio, e pedido como "critica a tela que acabei de mudar"
 * não teria tela nenhuma para achar. O mesmo texto vai a positivos e negativos, então não puxa para um lado.
 */
export const CONTEXTO =
  "Contexto desta rodada: você está no repositório de um app React da Wicomm (Next 15, Tailwind v4, front em web/, " +
  "plugin design-wicomm ligado, design/design-system.json na raiz). Os arquivos do projeto não estão disponíveis aqui: decida o " +
  "que fazer pelo pedido, sem procurar arquivos.";

/** O nome da pasta de um caso. */
export const nomeDoCaso = (skill, tipo, i) => `${skill}--${tipo}-${String(i + 1).padStart(2, "0")}`;

/** O regex do grader sobre o input da chamada (JSON): `"skill": "design-wicomm:x"` ou `"subagent_type": "design-wicomm:x"`. */
export function inputMatch({ tool, casa }) {
  const campo = tool === "Skill" ? "skill" : "subagent_type";
  return `"${campo}"\\s*:\\s*"(?:[\\w-]+:)?${casa}"`;
}

/** Os arquivos de cada caso: `{ "<pasta>/prompt.md": texto, "<pasta>/graders/disparo.md": texto }`. */
export function arquivosEsperados() {
  const arquivos = {};
  for (const [skill, { alvo, sim, nao }] of Object.entries(SKILLS)) {
    for (const [tipo, pedidos] of [["sim", sim], ["nao", nao]]) {
      pedidos.forEach((pedido, i) => {
        const nome = nomeDoCaso(skill, tipo, i);
        arquivos[`${nome}/prompt.md`] = [
          "---",
          `name: ${nome}`,
          `description: ${tipo === "sim" ? "dispara" : "não dispara"} ${alvo.tool === "Skill" ? "a skill" : "o subagente"} ${alvo.casa}`,
          `tags: [disparo, ${skill}, ${tipo === "sim" ? "positivo" : "negativo"}]`,
          "max_turns: 2",
          "timeout_seconds: 180",
          `allowed_tools: [${alvo.tool === "Agent" ? "Skill, Agent" : "Skill"}, Read, Glob, Grep]`,
          `append_system_prompt: ${JSON.stringify(CONTEXTO)}`,
          "---",
          "",
          pedido,
          "",
        ].join("\n");
        arquivos[`${nome}/graders/disparo.md`] = [
          "---",
          "type: tool_used",
          `tool: ${alvo.tool}`,
          `input_match: '${inputMatch(alvo)}'`,
          ...(tipo === "sim" ? ["min: 1"] : ["min: 0", "max: 0"]),
          "---",
          "",
          tipo === "sim" ? `O pedido tem de chamar ${alvo.tool} com ${alvo.casa}.` : `O pedido é vizinho: ${alvo.tool} com ${alvo.casa} não pode ser chamado.`,
          "",
        ].join("\n");
      });
    }
  }
  return arquivos;
}

/** As pastas de caso que existem no disco. */
export const pastasNoDisco = () => readdirSync(PASTA, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name.includes("--")).map((e) => e.name).sort();

/** As diferenças entre a lista e o disco (vazio = concordam). */
export function conferir() {
  const esperados = arquivosEsperados();
  const pastas = [...new Set(Object.keys(esperados).map((c) => c.split("/")[0]))].sort();
  const erros = [];
  const noDisco = pastasNoDisco();
  for (const p of noDisco) if (!pastas.includes(p)) erros.push(`pasta sobrando: ${p}`);
  for (const [rel, texto] of Object.entries(esperados)) {
    const c = join(PASTA, rel);
    if (!existsSync(c)) erros.push(`falta: ${rel}`);
    else if (readFileSync(c, "utf-8") !== texto) erros.push(`diferente: ${rel}`);
  }
  return erros;
}

export function gerar() {
  for (const p of pastasNoDisco()) rmSync(join(PASTA, p), { recursive: true, force: true });
  for (const [rel, texto] of Object.entries(arquivosEsperados())) {
    mkdirSync(dirname(join(PASTA, rel)), { recursive: true });
    writeFileSync(join(PASTA, rel), texto);
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
  if (process.argv.includes("--conferir")) {
    const erros = conferir();
    if (erros.length) {
      console.error(erros.join("\n"));
      process.exitCode = 1;
    } else console.log("os casos batem com a lista");
  } else {
    gerar();
    console.log(`${pastasNoDisco().length} casos gerados`);
  }
}
