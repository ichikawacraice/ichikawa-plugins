---
name: revisao-de-arquitetura-de-ui
description: A revisão de arquitetura de UI da Wicomm — antes de desenhar tela nova (ou redesenhar uma) no front de um app React, decide a tarefa da tela, o inventário do que ela mostra (cada dado com a decisão que ele gera), a hierarquia, onde mora cada mensagem e quais componentes DO KIT montam cada região, e entrega no formato fixo para o crítico julgar. Use antes de criar tela, painel, diálogo ou fluxo novo, ou de mudar o desenho decidido de um que existe ("desenha", "redesenha", "reorganiza", "a tela está confusa", "tem informação demais", "onde ponho este aviso"). Ajuste de tela que já existe (texto, ordem, campo, estado, botão) não passa por aqui: vai ao código e a uma crítica (CONV-19). Não escreve código de produto; quem implementa é a sessão que pediu, a partir da revisão aprovada.
---

> **O arquivo do projeto** é o `design/design-system.json`; no projeto que já tem o `design/wicomm.json` (o nome antigo) e não o novo, é o `design/wicomm.json`. Abaixo, `design/design-system.json` quer dizer esse arquivo: leia e grave nele, e nunca crie o outro nome ao lado (`node "${CLAUDE_PLUGIN_ROOT}/scripts/estado.mjs" <raiz>` diz qual vale).

# Revisão de arquitetura de UI

Quem desenha decide **o que a tela é** antes de decidir **como ela parece**. Esta revisão vem antes de qualquer JSX, e o resultado dela é um documento — não um componente. Por quê: decidir o estilo antes da tarefa produz tela bonita que responde pergunta nenhuma.

## Onde estão os caminhos

Leia o `design/design-system.json` do projeto: `fontes` (lista de arquivos; padrão `design/PRODUCT.md`, `design/ANATOMIA.md`, `design/DESIGN.md`, `design/CONVENCOES.md`), `kit` (pasta dos componentes), `revisoes` (padrão `docs/design/revisoes`), `densidade` (`instrumento` ou `site`) e `densidadePorRota` (app misto: a densidade da tela é a da primeira rota que casa com o caminho dela, como `{ "/p/*": "site" }`; sem casar, vale `densidade`). **A densidade da tela** sai de `node "${CLAUDE_PLUGIN_ROOT}/scripts/densidade.mjs" <raiz> <rota da tela> --de <arquivo da tela>`: o script lê as duas chaves do design/design-system.json e, só para a chave que ele não diz, da seção `densidade` do `DESIGN.md` do projeto (`<a id="densidade"></a>` e a tabela `Rota | Densidade`, a primeira rota que casa vence, `*` é o resto). É assim que o projeto que não entrou no sistema declara a densidade de cada rota. Sem nada declarado, decida por rota (rota atrás de sessão, de quem opera o dia todo → `instrumento`; link público → `site`), marque *assumida, a confirmar* e ponha a decisão em *Decisões ao operador*. Fora dessas chaves: a largura de referência é `largura` do design/design-system.json; sem a chave vale a opção `largura` do plugin, hoje ${user_config.largura} px (se este texto chegar sem o número, use 1280); a pasta do front é `pasta` do design/design-system.json; sem a chave vale a opção `pasta_do_front` do plugin, hoje `${user_config.pasta_do_front}` (vazio = nenhuma; se este texto chegar sem expandir, trate como vazio).

**A base é a norma do projeto que entrou no sistema** (tem o `design/design-system.json`). Nele, fonte que o projeto não tem cai na base do plugin: `${CLAUDE_PLUGIN_ROOT}/base/ANATOMIA.md`, `${CLAUDE_PLUGIN_ROOT}/base/DESIGN.md` e `${CLAUDE_PLUGIN_ROOT}/base/CONVENCOES.md`. Só o PRODUCT é do projeto: sem ele, pergunte quem usa e com que frequência antes de opinar (ou proponha rodar o `/design-wicomm:novo`, que o escreve). Projeto sem `design/design-system.json`: as fontes são as dele (o `CLAUDE.md`, os documentos de design, o código), e a base do plugin entra só como referência citada; sem pasta do front também, pergunte ao operador onde está o front; não invente caminho.

## As fontes, nesta ordem (leia antes de opinar)

1. **PRODUCT** — quem usa, em que tela, para quê.
2. **ANATOMIA** — **o que vai onde**: arquétipos de tela, regiões, o lugar de cada mensagem, o componente de cada função.
3. **DESIGN** — **como parece**: tokens, tipo, cor, raio, sombra, movimento, a densidade.
4. **CONVENCOES** da base e as convenções do front no `CLAUDE.md` do projeto (as que têm teste).
5. A spec da tela (pasta de specs do projeto, quando houver).
6. **O código de hoje** da tela, e não a captura antiga: o código vence a captura quando os dois divergem.

Conflito entre fontes: a decisão registrada (ADR, spec aprovada, convenção com teste) vence a sua preferência. Se ela parece errada, a revisão diz isso numa linha em *Decisões ao operador* — não a contorna.

## Os seis princípios (ANATOMIA, PRIN-01 a PRIN-06 — cada um é um critério, não um enfeite)

1. **Uma tela, uma tarefa** (PRIN-01). A tela responde uma pergunta só. Configuração, histórico, analytics e publicação que não são a tarefa vão para outra tela, gaveta ou diálogo.
2. **O canvas é sagrado** (PRIN-02). Onde há um objeto central (canvas, documento, tabela), ele domina; estrutura de um lado, inspetor e conversa do outro, e nada cresce por cima ou por dentro dele.
3. **Avançado não é ausente** (PRIN-03). A ação rara pode morar no menu do objeto dela (`⋯`, `▾`), nunca numa dobra fechada; o informativo raro pode ir para dobra, aba ou gaveta — e os dois continuam alcançáveis e dizem o motivo quando está bloqueado.
4. **Dado sem ação é ruído** (PRIN-04). Se a informação não muda o que a pessoa faz agora, ela não tem espaço permanente.
5. **Componente antes de layout** (PRIN-05). Cada região é montada com peças que existem no kit do projeto ou no registro `@wicomm` (ou as do arquétipo, na ANATOMIA). Falta peça? A revisão propõe a peça nova **para o registro**, nunca um arranjo à mão na tela (PECA-02).
6. **Token ou não existe** (PRIN-06). Cor, espaço, tipo, raio, sombra e duração saem da escala da DESIGN. Valor solto (`h-[34px]`, `text-[15px]`, hex) é defeito, não detalhe.

## O procedimento

1. **A tarefa e o arquétipo.** Uma frase com um verbo: *"quem atende muda o status de um pedido e vê o histórico"*. Quem usa (papel do PRODUCT), em que largura (a de referência é o pior caso real), com que frequência, em que densidade (DENS-01 instrumento, DENS-02 site). E qual dos arquétipos da ANATOMIA (ARQ-01) a tela é — o arquétipo dá as regiões.
2. **O inventário.** Toda informação, controle e mensagem que a tela mostra HOJE (ou que a proposta mostraria), numa tabela: *o quê* · *onde está* · *que decisão gera* · *frequência de uso* · *veredito*. O veredito é um de: **fica** (permanente), **sob demanda** (`⋯`, dobra, popover, gaveta — diga qual), **outra tela**, **sai**. Linha sem decisão que ela gere é **sai**, salvo motivo escrito.
3. **A hierarquia.** Uma ação primária por tela (e por bloco), as secundárias, as terciárias. Para cada região: **peso visual** (largura relativa ou altura em px na largura de referência), o que ela mostra primeiro, e o que cabe sem rolar.
4. **Onde mora cada mensagem.** Para cada mensagem do inventário, o lugar pela matriz da ANATOMIA (*no campo · no bloco · chip da barra · faixa abaixo da barra · conversa · diálogo*), a duração (enquanto vale · até a pessoa fechar · some sozinha) e o tom (`ok`, `espera`, `ruim`, `neutro`, `alheio`). Mensagem para quem opera não aparece para o cliente.
5. **Os componentes.** Para cada região, os componentes do kit que a montam, pelo nome do arquivo. Lacuna = proposta de componente novo para o kit, com a anatomia dele (partes, estados, variantes).
6. **Os estados.** Carregando, vazio, andando, erro, recusa, sucesso, sem permissão — o que cada região mostra em cada um. Ação assíncrona dispara, diz sobre o quê, tem desfecho sempre e sobrevive ao recarregar.
7. **O movimento.** O que entra, o que sai, por qual token de duração e curva, e o que acontece com `prefers-reduced-motion`.
8. **O corte.** O que **sai** da tela, em lista. Uma revisão que só acrescenta não terminou.

## A entrega (formato fixo — o crítico lê por estes títulos)

```markdown
# Revisão de arquitetura — <tela>
## Tarefa
## Quem e onde          (papel, largura, frequência, densidade, arquétipo)
## Inventário            (tabela: o quê · onde · decisão que gera · frequência · veredito)
## Hierarquia e peso     (primária, secundárias; peso de cada região na largura de referência)
## Mensagens             (tabela: mensagem · lugar · duração · tom · quem vê)
## Regiões e componentes (região → componentes do kit; lacunas → peça nova do kit)
## Estados
## Movimento
## O que sai
## Decisões ao operador  (cada uma: o caso · se não decidir · recomendação)
```

Grave em `<revisoes>/AAAA-MM-DD-<tela>.md` quando a revisão sustenta trabalho; rascunho fica no scratchpad. Depois dela vem o **crítico** (`critico-de-ui`), em contexto separado: quem desenhou já acredita no desenho (CONV-19). Achado do crítico volta para esta revisão antes de qualquer código, até o teto (CONV-20): com 24/30 ou mais (28/35 na densidade site) e sem ressalva alta, a revisão está liberada para execução, e a ressalva média ou baixa vai para a lista de pendências (a alta volta para conserto); no máximo 2 recríticas, e na terceira o que estiver abaixo do teto vai a quem pediu a revisão (skill `critica-de-ui`, seção *O teto da crítica*). Implementada a tela, ela é como a revisão aprovou (CONV-21), e o crítico julga de novo o código. **Cada crítica é gravada por quem a pediu**, ao fim do arquivo da revisão (skill `critica-de-ui`, seção *Quem grava a crítica*): é a linha `Nota:` dela que o `/design-wicomm:estado` lê.

## O que esta revisão não faz

- Não escreve componente, JSX nem CSS de produto.
- Não escolhe outra marca, fonte ou paleta: a marca é sempre a Wicomm e o estilo é o da DESIGN (catálogo de estilos de terceiros não entra: propõe outra marca, CONV-22).
- Não reabre decisão registrada sem dizer qual e por quê, em *Decisões ao operador*.
- Não cita spec nem ADR em texto que vai para a tela: o texto de UI fala com quem usa, não com quem mantém (CONV-11).
