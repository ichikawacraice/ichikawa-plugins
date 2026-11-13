---
name: design-system
versao: 0.29.0
description: A direção de design dos apps React do sistema — como a tela parece, com a regra, o porquê medido e como cada regra se confere.
colors:
  marca: "do tema (temas/<id>/tema.tokens.json, slot marca): cor, hover, sobre, tinta e gradiente, nos dois temas"
  claro:
    background: "#F9FAFC"
    card: "#FFFFFF"
    muted: "#F1F3F8"
    accent: "#EBEEF5"
    foreground: "#131722"
    foreground-2: "#4B5163"
    muted-foreground: "#565D70"
    popover: "#FFFFFF"
    secondary: "#F1F3F8"
    secondary-foreground: "#4B5163"
    destructive: "#B8113A"
    destructive-foreground: "#FFFFFF"
    terminal: "#09090B"
    terminal-foreground: "#F4F4F5"
    border: "#E6EAF1"
    input: "#7F8697"
    anel: "rgba(19, 23, 34, .10)"
  escuro:
    background: "#0D1017"
    card: "#161A22"
    muted: "#0B0E14"
    accent: "#1E232D"
    foreground: "#F2F4F8"
    foreground-2: "#98A0B0"
    muted-foreground: "#848C9D"
    popover: "#161A22"
    secondary: "#1E232D"
    secondary-foreground: "#98A0B0"
    destructive: "#FF8095"
    destructive-foreground: "#16181D"
    terminal: "#09090B"
    terminal-foreground: "#F4F4F5"
    border: "#252B36"
    input: "#737A8A"
    anel: "rgba(255, 255, 255, .10)"
  vozes:
    ok: emerald
    espera: amber
    ruim: rose
    alheio: violet
    neutro: "token muted-foreground"
typography:
  familia: "a do tema (tema.json, fonte.familia), com a reserva ui-sans-serif, system-ui, sans-serif"
  eixo-wdth: "62% 125% (declarado no carregamento da fonte)"
  familia-medida: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace"
  vozes:
    t-display: { fontSize: "23px", fontWeight: 600, fontStretch: "106%", letterSpacing: "-.024em", lineHeight: 1.15 }
    t-titulo: { fontSize: "15px", fontWeight: 600, letterSpacing: "-.014em", lineHeight: 1.3 }
    t-denso: { fontSize: "12px", fontWeight: 400 }
    t-rotulo: { fontSize: "10.5px", fontWeight: 700, fontStretch: "80%", letterSpacing: ".13em", textTransform: uppercase, color: "foreground-2" }
    t-coluna: { fontSize: "10.5px", fontWeight: 500, letterSpacing: ".08em", textTransform: uppercase, color: "foreground-2" }
    t-campo: { fontSize: "13px", fontWeight: 500, lineHeight: 1.35, letterSpacing: normal, fontStretch: "100%", textTransform: none, color: "foreground" }
    t-medida: { fontFamily: "familia-medida", fontSize: "12px", fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em" }
  tamanhos-utilitarios:
    text-sm: "14px — corpo em densidade site; nome do grupo de linhas em instrumento"
    controle: "13px (botão e campo default), 12px (sm), 14px (lg)"
    text-legenda: "11px — etiqueta, legenda, carimbo"
rounded:
  container: "16px (rounded-2xl) — cartão de tela, painel, tabela, diálogo"
  cartao: "14px (rounded-cartao) — cartão de quadro e de lista"
  agrupador: "12px (rounded-xl) — popover, menu, select aberto, degrau de tinta"
  dica: "10px (rounded-lg = --radius) — tooltip"
  ctrl: "7px (rounded-ctrl) — botão default e lg, campo, select"
  md: "rounded-md — carimbo, botão sm (8px pelo config; o código de origem afirma 6px: medir no ateliê)"
  marcacao: "5px — caixa de marcação"
  full: "9999px — botão de ícone, contador, alça"
largura:
  medida: "78ch (max-w-medida) — texto corrido"
  pagina: "1600px (max-w-[100rem])"
spacing:
  hairline: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "24px"
lista:
  instrumento: { linha: "40px no mínimo; 6px de ar em cima e embaixo, e cresce com o conteúdo (as entrelinhas + 12px)", topo-do-grupo: "48px no mínimo", vao-antes-do-grupo: "16px depois de grupo aberto", vao-entre-fechados: "6px", ar-depois-do-topo: "4px só com o grupo aberto", recuo: "32px", recuo-com-identidade: "46px", cabecalho: "40px, régua de 1px border embaixo, de ponta a ponta, sem fundo", ar-depois-do-cabecalho: "8px antes do primeiro grupo", filete: "1px border entre linhas do mesmo corpo, do x do texto da primeira célula até 12px antes do fim; nenhum depois da última linha nem entre o topo do grupo e a primeira linha" }
  site: { linha: "48px no mínimo; 8px de ar em cima e embaixo, e cresce com o conteúdo (as entrelinhas + 16px)", topo-do-grupo: "56px no mínimo", vao-antes-do-grupo: "24px depois de grupo aberto", vao-entre-fechados: "8px", ar-depois-do-topo: "6px só com o grupo aberto", recuo: "32px", recuo-com-identidade: "46px", cabecalho: "40px, régua de 1px border embaixo, de ponta a ponta, sem fundo", ar-depois-do-cabecalho: "12px antes do primeiro grupo", filete: "1px border entre linhas do mesmo corpo, do x do texto da primeira célula até 12px antes do fim; nenhum depois da última linha nem entre o topo do grupo e a primeira linha" }
quadro:
  instrumento: { coluna: "256px (basis-64), cresce até 320px (max-w-80), não encolhe", fita: "46px (w-11.5), a coluna vazia recolhida", vao-entre-colunas: "6px (gap-1.5)", cabecalho: "36px (h-9), grudado", vao-do-cabecalho-a-pilha: "3px (pt-0.75)", pilha: "8px nas laterais (px-2)", vao-entre-cartoes: "8px (gap-2)", ar-no-fim-da-pilha: "28px (pb-7)", cartao: "raio 14px (rounded-cartao), 14px × 13px de ar (px-3.5 py-3.25), zonas com 8px entre si", bandeja: "14px nas laterais, 11px em cima e 12px embaixo (px-3.5 pt-2.75 pb-3)", ponto-da-etapa: "6px (size-1.5)", contagem: "pílula de largura mínima 20px (min-w-5), 7px × 1px de ar (px-1.75 py-px)" }
  site: { coluna: "256px (basis-64), cresce até 320px (max-w-80), não encolhe", fita: "46px (w-11.5)", vao-entre-colunas: "16px (gap-4)", cabecalho: "40px (h-10), grudado", vao-do-cabecalho-a-pilha: "6px (pt-1.5)", vao-entre-cartoes: "12px (gap-3)", ar-no-fim-da-pilha: "24px (pb-6)", cartao: "raio 14px (rounded-cartao), 16px de ar (p-4)", bandeja: "16px × 10px (px-4 py-2.5), a medir", ponto-da-etapa: "6px (size-1.5)", contagem: "pílula de largura mínima 20px (min-w-5), 7px × 1px de ar (px-1.75 py-px)" }
controle:
  sm: "26px, raio rounded-md (ver FORMA-01), texto 12px"
  default: "30px, raio 7, texto 13px"
  lg: "36px, raio 7, texto 14px"
  icon: "30px, redondo"
  xl: "44px raio 12 (botão) e 40px raio 10 (campo), só na tela de Entrada"
shadow:
  claro:
    superficie: "0 0 0 1px rgba(19,23,34,.05), 0 1px 2px rgba(19,23,34,.05), 0 5px 14px -6px rgba(19,23,34,.09)"
    superficie-alta: "0 0 0 1px rgba(19,23,34,.07), 0 2px 5px rgba(19,23,34,.07), 0 12px 26px -10px rgba(19,23,34,.15)"
    superficie-flutuante: "0 0 0 1px rgba(19,23,34,.08), 0 24px 56px -16px rgba(19,23,34,.26), 0 4px 12px -4px rgba(19,23,34,.12)"
  escuro:
    superficie: "0 0 0 1px rgba(255,255,255,.055), 0 1px 2px rgba(0,0,0,.4), 0 5px 14px -6px rgba(0,0,0,.5)"
    superficie-alta: "0 0 0 1px rgba(255,255,255,.09), 0 2px 6px rgba(0,0,0,.5), 0 12px 28px -10px rgba(0,0,0,.6)"
    superficie-flutuante: "0 0 0 1px rgba(255,255,255,.1), 0 26px 60px -16px rgba(0,0,0,.75), 0 4px 12px -4px rgba(0,0,0,.5)"
motion:
  modal-abre: "220ms"
  modal-fecha: "140ms"
  menu-abre: "160ms"
  menu-fecha: "110ms"
  dica: "120ms"
  painel: "200ms"
  dobra-abre: "200ms"
  dobra-fecha: "150ms"
  cor: "150ms"
  revela: "150ms"
  veu: "120ms (atraso)"
  espiada-abre: "250ms (atraso, abrir no passar do mouse)"
  espiada-fecha: "300ms (atraso, tolerância ao sair)"
  ease-abre: "cubic-bezier(0.16, 1, 0.3, 1)"
  ease-fecha: "cubic-bezier(0.4, 0, 1, 1)"
---

# Direção de design

> **O que é este arquivo.** A regra de **como a tela parece** em todo app React do sistema: cor, tipo, espaço, superfície, forma, controle, movimento e densidade. **O que vai onde** — tipos de tela, regiões, o lugar de cada mensagem, a peça de cada função — mora na [`ANATOMIA.md`](ANATOMIA.md); as regras de engenharia do front, na [`CONVENCOES.md`](CONVENCOES.md). Os três não se repetem.
>
> **É norma, não descrição.** Cada regra tem um código (`COR-03`), o texto que obriga, o porquê em uma ou duas frases, **como se confere** e **de onde veio**. O designer e o crítico citam o código; as guardas em teste levam o código no nome do caso.
>
> **Os valores do frontmatter são a referência** até o pacote de tokens existir; a partir dele, quem vale é o pacote, e este frontmatter é gerado dele.

## Como ler uma regra

- **Regra** — o que a tela tem de fazer. "Deve" e "nunca" são literais.
- **Por quê** — o fato medido que originou a regra. Mudar a regra pede medir de novo.
- **Confere** — onde a regra é cobrada:
  - `guarda:<nome>` — teste que lê os arquivos do projeto e reprova (pacote de guardas);
  - `tokens` — teste que calcula a partir dos valores dos tokens (pacote de tokens);
  - `navegador` — só se mede no navegador, no ateliê, nos dois temas (jsdom e build não veem CSS calculado);
  - `crítica:<eixo>` — o crítico de UI cobra na nota.

## Visão geral

O sistema é **reservado**: a cor fala pouco, e quando fala responde uma pergunta só. A profundidade é **superfície opaca com sombra baixa**; a separação entre assuntos é o **ar**, não a linha. Todo número que se compara vai em mono, e toda afirmação da tela tem a prova ao lado. O movimento é curto, por token, e sempre tem escape.

**Características:**
- Duas densidades oficiais, escolhidas por app: **instrumento** (quem opera o dia todo) e **site** (quem usa de vez em quando) — ver [Densidade](#densidade).
- Profundidade por superfície opaca — nunca por translucidez.
- Separação por ar, por degrau de tinta e por rótulo — quase nunca por linha.
- Cor semântica de cinco vozes, reservada a dizer *o que isto pede de você?*.
- A marca preenche, tinge e desenha; ela nunca é letra.

---

<a id="marca"></a>
## 1. Marca

### MARCA-01 · A cor da marca é declarada e não cede a contraste
- **Regra.** A cor da marca é a que o tema declara (`marca.cor` em `temas/<id>/tema.tokens.json`), uma só, igual nos dois temas, nos papéis `marca` (desenha) e `primary` (preenche). Nenhum piso de contraste move esse valor; quando o piso e a marca discordam, a marca vence e a razão aceita fica declarada no tema (`contrasteAceitoSobreAMarca`) e registrada no teste. Hover muda só a luz, na mesma matiz da cor (`marca.hover`, com a variante do escuro).
- **Por quê.** A tinta sobre a marca pode medir abaixo dos 4,5 de texto normal (acima dos 3:1 de objeto gráfico), e isso é aceito. Escurecer a marca para pagar 4,5 produziu uma segunda cor que o dono do produto não reconheceu como a marca.
- **Confere.** `tokens` (o tema é validado: a matiz do hover; não cobra razão da tinta sobre a marca).

### MARCA-02 · A marca não escreve
- **Regra.** A cor da marca nunca é cor de texto: nada de `text-primary`, nem de texto em `--marca`. Link é **tinta com sublinhado** (o `sublinhado-de-link`, CTRL-03); item ativo de menu é fundo `bg-primary/10` com letra em **tinta**; sobre tinta da marca, escreve-se tinta.
- **Por quê.** Medida como texto, a cor da marca pode ficar indistinguível de uma voz (o vermelho de erro, `rose`, chegou a **1,17:1** de uma marca vermelha). A separação entre as duas só sobrevive se for de **forma**, não de matiz.
- **Confere.** `guarda:a-marca-nao-carrega-texto`.

### MARCA-03 · O gradiente é a assinatura, e vive em desenho
- **Regra.** O gradiente da marca (as três paradas do tema, `marca.gradiente`, a 118°) só aparece em **desenho e preenchimento** — indicador de progresso, filete, símbolo, preenchimento de destaque —, nunca em texto. As pontas pagam pelo menos **2:1** de luminância entre si.
- **Por quê.** Duas cores cruas de marca podem estar quase na mesma luminância (já mediram 1,04:1): sem a viagem de luz, não há degradê, há uma cor chapada.
- **Confere.** `tokens` (razão entre as pontas) · `guarda:a-marca-nao-carrega-texto`.

### MARCA-04 · Raster com a cor da marca nasce de script
- **Regra.** Favicon, logotipo em PNG e qualquer raster com a cor da marca são gerados por script a partir dos tokens, com um modo `--conferir` que roda na suíte. Nada exportado à mão. **Exceção declarada:** o arquivo oficial da marca (o logotipo que a dona da marca publica) é a fonte, desde que more no tema com a origem declarada (`logotipo.imagem.origem` e `logotipo.simbolo.origem` do `tema.json`). Ele entra como veio, sem redesenho pelos tokens; o script só o leva para onde é usado e confere byte a byte. Quando a marca publica só o positivo de um desenho, o negativo para o fundo escuro sai do oficial por script, trocando só a tinta neutra por branca e mantendo o alfa e a cor da marca; nunca é refeito à mão. Trocar a cor da marca obriga a trocar o arquivo oficial no mesmo PR.
- **Por quê.** Raster não lê token: depois de uma troca de cor, favicon e logotipos ficaram dois dias na cor antiga sem nenhum teste ver. O logotipo oficial não é do sistema para redesenhar: refeito pelos tokens, deixa de ser a marca. A cor da marca não muda sem o logotipo mudar junto, e a conferência byte a byte pega a cópia que ficou velha. O negativo por script é o mesmo desenho com a tinta trocada: não há redesenho, e ele acompanha o oficial quando o oficial muda.
- **Confere.** `guarda:o-raster-da-marca-sai-do-token` · o teste do registro que compara o desenho embutido com o arquivo do tema, byte a byte, e o negativo com o que o script tira do oficial.

### MARCA-05 · Destrutivo é contorno; preenchido é primário
- **Regra.** O botão destrutivo **nunca é preenchido**: é contorno com a tinta do token `destructive` (a voz `ruim` como token de tema: `#B8113A` no claro, `#FF8095` no escuro) e anel a 38% dela. Preenchimento na cor da marca é sempre o primário.
- **Por quê.** Quando a marca e o destrutivo têm matiz próxima, confirmar e excluir preenchidos se confundem (com uma marca vermelha, mediram **1,32:1** entre si). A forma é o que separa, e nenhum ajuste de matiz desfaz isso.
- **Confere.** `guarda:a-marca-nao-carrega-texto` (varredura de destrutivo preenchido).

---

<a id="cor"></a>
## 2. Cor

### COR-01 · Duas paletas, por decisão
- **Regra.** Neutros e marca são **tokens de tema** (mudam entre claro e escuro). As vozes `ok`, `espera`, `ruim` e `alheio` são da **paleta fixa** (`emerald`, `amber`, `rose`, `violet`) com o par `dark:` escrito no mapa de vozes. A voz `neutro` é **token** (`muted-foreground`), nunca `zinc`/`gray` fixo.
- **Por quê.** Verde, âmbar e rosa significam o mesmo nos dois temas; cinza precisa clarear no escuro. Cinza fixo esquecido sem o gêmeo `dark:` mede 1,72:1 no escuro e nenhum teste vê.
- **Confere.** `guarda:o-carimbo-tem-forma` (matiz e vocabulário) · `tokens`.

### COR-02 · Neutros frios
- **Regra.** Toda a rampa neutra puxa para o azul (valores no frontmatter). O chão (`background`) não é branco puro; a superfície (`card`) é.
- **Por quê.** Ao lado de uma marca quente, cinza morno vira tingido. O chão a 1,04 do branco dá ao cartão o degrau para se levantar sem virar painel cinza.
- **Confere.** `tokens` (valores).

### COR-03 · O matiz responde uma pergunta só: *o que isto pede de você?*
- **Regra.** Toda cor de estado responde a mesma pergunta, em toda tela:
  | voz | família | responde |
  |---|---|---|
  | `ok` | emerald | **nada** — acabou e deu certo |
  | `espera` | amber | **decisão sua** — alguém está bloqueando, e é você |
  | `ruim` | rose | **conserto** — quebrou |
  | `alheio` | violet | **nada, porque está com outra pessoa** — pendência de outro time |
  | `neutro` | token | **nada ainda** — está andando, ou foi deliberadamente não feito |
  Não existe segunda régua cromática em lugar nenhum; a cor de identidade declarada (COR-09) não é régua de estado e não responde esta pergunta.
- **Por quê.** Duas linguagens de cor (estado de processo × veredito) se encontraram na mesma tela, com o mesmo verde querendo dizer duas coisas, e com classes copiadas à mão de um mapa para o outro.
- **Confere.** `guarda:o-carimbo-tem-forma` · `crítica:consistência`.

### COR-04 · Estado em curso não tem matiz; desfecho tem
- **Regra.** Estado **em curso** (processando, enviando, gerando) é palavra em `neutro` com o indicador de progresso. **Desfecho** tem voz: concluído é `ok`, falhou é `ruim`, o que espera uma pessoa é `espera`. Cancelado e pulado ficam `neutro`: não pedem nada. Esperar uma janela que reabre sozinha também é `neutro`.
- **Por quê.** "Rodando" não pede nada a quem lê; pintar o andamento cria uma sexta voz.
- **Confere.** `crítica:consistência`.

### COR-05 · O componente declara TOM, nunca classe de cor
- **Regra.** Componente que mostra voz recebe `tom: Tom` (`'ok' | 'espera' | 'ruim' | 'neutro' | 'alheio'`, ou um recorte derivado com `Extract<Tom, …>`) e compõe a classe de **um arquivo só**, o idioma de cor, com cinco mapas: `COR_DO_TOM` (número ≥ 24px), `COR_DO_TOM_DENSO` (texto menor), `BADGE_DO_TOM` (texto sobre a tinta do carimbo), `TINTA_DO_TOM` (fundo de bloco), `PONTO_DO_TOM` (marcador de 6px) — e `FILETE_DO_TOM` para a barra vertical e `TEXTO_SOBRE_A_TINTA` para o texto sobre a tinta de bloco (o `BADGE_DO_TOM` deriva dele). Literal de paleta (`text-emerald-700`) fora desse arquivo é defeito, salvo exceção listada com motivo; a exceção declarada da base é o mapa de etapas do projeto, que o `PontoDaEtapa` recebe (`criarPontoDaEtapa`), num arquivo só e listado na configuração das guardas (COR-09). A cor do nível da prioridade não é voz: mora na própria `Prioridade` (`COR_DO_NIVEL`, COR-09), como peça do kit. Vocabulário próprio (`atencao`, `bom`, `erro`) é defeito.
- **Por quê.** Foram medidos oito vocabulários de cor no mesmo produto e 40 pílulas em 22 construções antes do mapa único.
- **Confere.** `guarda:o-carimbo-tem-forma`.

### COR-06 · Dois degraus de tinta para texto, e um terceiro para carimbo
- **Regra.**
  - Número de voz com **24px ou mais**: `COR_DO_TOM` (`{cor}-600` no claro, `{cor}-400` no escuro).
  - **Qualquer texto menor**: `COR_DO_TOM_DENSO` (`{cor}-700` no claro — **`amber-800`** na voz `espera`, porque o 700 mede 4,32 sobre `accent` —, `{cor}-400` no escuro).
  - Número grande que mora sobre o degrau `muted` usa o **denso**: ali o âmbar 600 cai a 2,87:1.
  - Texto **dentro do carimbo** (sobre `bg-{cor}-500/15`): `BADGE_DO_TOM` (`{cor}-800` no claro, `{cor}-300` no escuro).
  - O denso é mais escuro que o de número no claro e igual no escuro.
- **Por quê.** No claro, `emerald-600` mede 3,77 e `amber-600` 3,19 sobre o cartão — só passam como texto grande. Dentro do carimbo, o `amber-700` cai a 4,48 (cartão) e 4,31 (chão), abaixo dos 4,5.
- **Confere.** `guarda:os-tokens-pagam-o-piso` (ordem dos degraus) · `navegador` (as razões com a tinta composta).

### COR-07 · O carimbo neutro tem tinta, com alfa fixado
- **Regra.** O carimbo `neutro` é preenchido: `bg-foreground/[0.07]` com texto `muted-foreground` (claro) e `foreground-2` (escuro). O alfa é fixado em teste: subir a tinta exige medir de novo.
- **Por quê.** Contorno vazio ao lado de chip preenchido é outra construção, e numa lista longa de estados a tela vira um varal de contornos. Com 7% a razão é 4,86 no claro (`muted-foreground`) e 4,90 no escuro no pior fundo (`foreground-2`; com `muted-foreground` cairia a 4,32), margem estreita.
- **Confere.** `guarda:o-carimbo-tem-forma` (alfa) · `navegador`.

### COR-08 · Três canais, três perguntas
- **Regra.** Cada canal visual responde uma pergunta e não empresta o canal do outro:
  | canal | pergunta | como |
  |---|---|---|
  | **tinta** (fundo e texto) | *o que isto pede de você?* | as cinco vozes |
  | **forma** (glifo) | *que tipo de coisa é esta?* | um ícone por tipo, **sem matiz próprio** — herda a tinta do texto ao lado |
  | **etapa** (ponto de 6px) | *onde no percurso?* | a cor **declarada** da etapa, só no `PontoDaEtapa`, sempre com o nome ao lado — nunca a marca, nunca uma voz |
  A **marca** não responde pergunta de estado: ela é a assinatura (MARCA-03) e o primário.
  As exceções declaradas são duas (COR-09): a `Prioridade`, cujo glifo e palavra levam a cor do nível (salvo a contagem zerada), com a tinta do carimbo na voz; e a cor da pessoa, no monograma em todo lugar que a represente e, na conversa entre pessoas, no nome de quem fala.
  Proibido: glifo com matiz próprio fora dessas exceções; fundo tingido pela posição; glifo sem a palavra ao lado.
- **Por quê.** Dar um matiz a cada categoria "porque a tela está cinza demais" abre uma segunda régua cromática no mesmo cartão.
- **Confere.** `crítica:consistência`.

### COR-09 · Cor de identidade é declarada, num lugar só
- **Regra.** Cor que identifica (etapa do percurso, categoria) é **token declarado por parada**, com o contraste medido ao lado, num mapa `Record<Tipo, …>` para o TypeScript cobrar o item novo — nunca rampa interpolada pela posição, nunca a marca, nunca uma voz emprestada. Cada identidade (a etapa, o nível da prioridade, a pessoa) tem **um lugar só** (a etapa vive só no ponto do `PontoDaEtapa`; o nível da prioridade, só na `Prioridade`; a pessoa, só no `Monograma` e no nome do `AutorDaConversa`) e nenhuma escreve texto, salvo o nível da prioridade e o nome de quem fala na conversa (a cor da pessoa, abaixo), que pinta a palavra e o glifo do carimbo neutro com o contraste de texto medido (4,5:1 sobre a tinta do carimbo, no cartão) e mora na própria peça (`COR_DO_NIVEL`), fora do idioma de cor das vozes. A cor do nível só existe dentro do carimbo neutro da `Prioridade`: na palavra, nas barras e no sublinhado da que abre, que é a tinta da palavra. Fora dele (texto solto, ponto, filete, linha, legenda), nunca. O zero de uma contagem (`zerada`) fica sem a cor. Onde a etapa e a voz dizem a mesma coisa (ninguém pegou, é a sua vez, acabou), a parada coincide com a voz (`neutro`, `espera`, `ok`).
  A **cor da pessoa** é a outra exceção: o monograma leva a cor da pessoa **em todo lugar que a represente** (a linha, a pilha, o cartão, a conta, a escolha de pessoas, a conversa), para a mesma pessoa ser reconhecida de relance de uma região à outra. São 8 famílias sem dono (nenhuma voz, nem o vermelho e o laranja da prioridade, nem a marca), escolhidas pela chave estável da pessoa (o id, nunca o nome) dentro do próprio `Monograma`: quem chama passa a chave (`chave`, ou `id` nos dados da pessoa), nunca a cor. Sem id estável, quem chama diz que não tem (`null`), e o monograma fica neutro. A pessoa que não há segue no tracejado neutro. A cor é pista, não identificador: duas pessoas podem cair na mesma família, e o que as separa são as iniciais, o nome ao lado ou a dica, nunca a cor sozinha. O **nome** só ganha a cor na conversa entre pessoas, no cabeçalho do grupo de balões, onde ele é o único sinal de quem fala. Fora dela, o nome segue na tinta de texto, porque o monograma ao lado já responde *quem é*. As identidades se separam pela **forma**, não pela exclusividade da matiz: o `sky` também é do nível baixo da prioridade (lá, o carimbo com o glifo de barras), e o mapa de etapas do projeto pode usar as mesmas famílias (lá, o ponto de 6px com o nome); a pessoa é o círculo de 20px com as iniciais e o nome do autor. As 8 famílias são declaradas num lugar só, no `Monograma` (`CORES_DA_PESSOA`, `MONOGRAMA_DA_PESSOA`, `NOME_DA_PESSOA`, `corDaPessoa`). A cor pinta só o monograma (fundo opaco, iniciais a 6:1 sobre ele, em qualquer superfície) e o nome do autor na conversa (4,5:1 sobre `muted` e `card`). Nunca pinta o fundo da linha, do item de menu, do cartão ou do balão, nem a seleção, o foco, a borda, o filete, o carimbo ou o glifo.
- **Por quê.** A rampa interpolada pela posição foi considerada e recusada: identidade com cor emprestada da marca ou de uma voz faz a mesma tinta dizer duas coisas. Numa conversa com várias pessoas do outro lado, o nome cinza obriga a ler cada cabeçalho; a cor no monograma e no nome responde "quem é" de relance, sem tingir a mensagem. Com a cor só na conversa, o nome de quem escreveu tinha cor e o monograma da mesma pessoa no quadro e na presença não tinha: a pista não atravessava a tela. Por isso a peça calcula a cor pela chave, e quem chama não pode esquecer de dizer se tem a chave. Fora do carimbo, a Alta e a voz `ruim` são o mesmo vermelho: ΔEok 0,04 no claro e 0,03 no escuro, contra o texto denso da voz. Dentro, a tinta neutra × rosada, o glifo e o texto (0,07 e 0,13) as separam. Trocar a família da Alta tiraria o 'alta = vermelho' sem ganho, porque as famílias livres já são da pessoa.
- **Confere.** `crítica:consistência` · registro (cada peça que desenha a pessoa, com o mesmo id, dá a mesma família; sem chave, neutro; o `NOME_DA_PESSOA` só na conversa; a `zerada` sem `COR_DO_NIVEL`) · revisão de código.

### COR-10 · O peso vem de posição e tamanho, nunca de saturação
- **Regra.** Ausência e lacuna ganham peso por **posição, tamanho e movimento**, em `neutro`. Nunca se pinta uma lacuna de `ruim` para "chamar atenção".
- **Por quê.** Lacuna em vermelho lê como defeito, e é a mentira que a tela existe para não contar.
- **Confere.** `crítica:hierarquia`.

### COR-11 · Contorno de controle paga 3:1; separação decorativa não deve nada
- **Regra.** Dois tokens de linha com empregos diferentes: `input` é **contorno de controle** e paga **3:1** contra `background`, `card`, `muted` e `accent`, nos dois temas; `border` e `anel` são decorativos. A utilitária que desenha o contorno de controle usa `input`, nunca `anel`.
- **Por quê.** O contorno de controle já foi `transparent` (doze campos invisíveis) e, depois, a utilitária gastava o token decorativo: todo botão `outline` branco sobre branco (1,23:1).
- **Confere.** `tokens` (razão do `input`) · `guarda:os-tokens-pagam-o-piso`.

### COR-12 · Piso de contraste
- **Regra.** Texto normal **4,5:1**; texto grande (≥ 24px, ou ≥ 18,66px com peso ≥ 700) **3:1**; ícone que carrega informação **3:1**; controle desabilitado é isento. Rampa de tinta medida no pior fundo: `foreground` ≥ 14, `foreground-2` ≥ 5,9, `muted-foreground` ≥ 4,6.
- **Por quê.** Os dois piores defeitos do produto de origem eram invisíveis para centenas de testes verdes: só a medição pega.
- **Confere.** `tokens` (pares opacos) · `navegador` (pares com alfa).

### COR-13 · Ícone isento de contraste só se for enfeite, e a isenção é cobrada
- **Regra.** Ícone que é o **único sinal** de uma função (o chevron de um select) paga 3:1. Isenção só para enfeite, com `aria-hidden` e o alvo de clique mais próximo sendo o próprio elemento rotulado — e quem isenta escreve a condição que mata a isenção.
- **Por quê.** O chevron do select media 2,33:1 no escuro e era o único sinal de que o retângulo abre uma lista.
- **Confere.** `guarda` específica por isenção · `navegador`.

### COR-14 · Opacidade não dá hierarquia sobre fundo tingido
- **Regra.** Sobre superfície tingida, hierarquia é tamanho, peso ou degrau de **token** — nunca `opacity`. E a cor de um bloco tingido se declara **uma vez, no contêiner**, para os filhos herdarem.
- **Por quê.** `opacity: .82` sobre a tinta âmbar do claro derrubou a razão a 4,01; um rodapé acrescentado depois ficou cinza sobre âmbar porque ninguém o tingiu.
- **Confere.** `navegador` · `crítica:consistência`.

### COR-15 · O terminal não segue o tema
- **Regra.** O valor cru colhido de fora (log, prova, saída de comando) mora na superfície `terminal` (`#09090B`, texto `terminal-foreground` `#F4F4F5`), **igual nos dois temas**, usada a 95% (`bg-terminal/95`). Nenhuma outra peça usa esses tokens.
- **Por quê.** O valor cru precisa se separar do texto ao redor, inclusive dentro de um degrau de tinta; o par mede no mínimo 16,59 no claro e 17,99 no escuro sobre os quatro fundos.
- **Confere.** `tokens` (piso e igualdade entre temas) · `guarda:os-tokens-pagam-o-piso`.

---

<a id="tipo"></a>
## 3. Tipografia

### TIPO-01 · Uma família, mono para medida
- **Regra.** Fonte do produto: **a família do tema** (`fonte.familia` no `tema.json`), de preferência variável com eixo `wdth`, reserva `ui-sans-serif, system-ui, sans-serif`. Fonte de medida: a mono do sistema. Nenhuma segunda família.
- **Por quê.** Uma família só, de altura-x generosa e legível em corpo pequeno, segura a hierarquia sem ruído; o eixo de largura dá uma terceira voz (rótulo condensado) sem fonte nova. Família sem o eixo gera com aviso, e o rótulo cai no peso.
- **Confere.** `guarda` de fonte (a família computada no `<html>`) · `navegador`.
- *Assumida, a confirmar:* a família de cada tema (o tema a declara; o sistema não escolhe).

### TIPO-02 · As vozes da família, e quem escolhe é o papel
- **Regra.** Todo texto usa uma voz do frontmatter (classes `t-*`, na camada `components`), escolhida pelo **papel**:
  | voz | papel |
  |---|---|
  | `t-display` | o título da página — um por tela (no Editor, o `h1` da barra vai em `t-titulo`, TIPO-04) |
  | `t-titulo` | o nome de bloco, de cartão e de diálogo; em densidade site, também o nome do grupo de linhas e o nome da coluna do quadro |
  | `t-denso` | o corpo em densidade instrumento: célula, metadado, linha de lista |
  | `t-rotulo` | nomeia um **conjunto** (seção dentro de um bloco, faixa, grupo de campos) — aparece uma vez, sozinho |
  | `t-coluna` | nomeia um **valor** que se repete (cabeçalho de coluna, legenda de imagem, unidade) — mais leve que o rótulo |
  | `t-campo` | o rótulo de campo em densidade **site** (frase de quem usa, sem caixa alta) |
  | `t-medida` | número que se compara (TIPO-03) |
  Fora das vozes, só os tamanhos utilitários do frontmatter (`text-sm` para corpo em densidade site e, com peso 600, para o nome do grupo de linhas e da coluna do quadro em densidade instrumento; `text-controle font-medium leading-snug`, 13/500, para o título do item de quadro, que identifica o item sem pesar como nome de bloco; os tamanhos de controle do kit; `text-legenda`). `text-[15px]` e afins são defeito; voz escrita à mão (`text-xl font-bold tracking-tight` no lugar de `t-display`) também.
- **Por quê.** O papel de cabeçalho de coluna nunca teve voz e era escrito à mão em 47 lugares, de 11 formas; um título de tela na voz anterior passou por uma varredura que só olhava um tipo de arquivo. O nome do grupo no mesmo corpo da linha (12px, só com o peso a mais) não se achava ao rolar uma lista de seis grupos.
- **Confere.** `guarda:o-rotulo-tem-duas-vozes` · `guarda:o-titulo-da-pagina-e-um-so` · `guarda` de valor arbitrário (aviso na escrita; reprova no CI).

### TIPO-03 · Medida em mono
- **Regra.** Todo número que alguém vai comparar com outro número — custo, quantidade, id, chave, delta — vai em `t-medida` (mono, algarismos tabulares).
- **Por quê.** O olho alinha dígitos por largura fixa; em proporcional, duas linhas de números não se comparam.
- **Confere.** `crítica:consistência`.

### TIPO-04 · O título da página é um só, e é `h1`
- **Regra.** Uma tela tem **um** título, `h1` na voz `t-display`, onde quer que a tela o monte (página ou componente). No Editor, o `h1` é o nome do objeto dentro da `BarraDoEditor`, na voz `t-titulo`. Título nunca é vazio nem um símbolo só: quando a parte distintiva do nome é vazia, ele ganha um nome.
- **Por quê.** Dois títulos disputam a resposta a "onde estou"; um título de um caractere (`/`) cumpriu a letra de "não vazio" e não o espírito. No Editor, 23px numa barra de 44px disputariam o canvas (PRIN-02).
- **Confere.** `guarda:o-titulo-da-pagina-e-um-so`.

---

<a id="densidade"></a>
## 4. Densidade

Cada app declara a sua densidade no arquivo do projeto, `design/design-system.json` (`"densidade": "instrumento" | "site"`). Uma área de um app pode declarar a outra densidade — e então tudo o que se abre dali (diálogo, gaveta, aviso) herda a densidade dela.

### DENS-01 · Instrumento: o corpo é o `t-denso`
- **Regra.** Em densidade **instrumento**, o corpo real é `t-denso` (12px); o ritmo é `flex` + `gap` em passos de 6 e 8px; `t-rotulo` e `t-coluna` organizam seções e colunas.
- **Por quê.** Quem opera confere listas longas o dia todo, num notebook disputando a tela; o custo de rolar é maior que o de aproximar.
- **Confere.** `crítica:densidade`.

### DENS-02 · Site: o corpo é o `text-sm`, e não há voz de sistema
- **Regra.** Em densidade **site** (quem usa de vez em quando, inclusive o cliente):
  - o texto corrido é `text-sm` (14px); `t-denso` e `text-legenda` só para metadado;
  - **sem voz de sistema**: nada de `t-rotulo` nem `t-coluna` em diálogo ou aviso; rótulo de campo é `t-campo`; o título diz a situação nas palavras de quem usa;
  - **uma decisão por vez**: diálogo de escolha com as saídas lado a lado no rodapé, primário à direita, e a consequência de cada saída numa frase acima dos botões;
  - **mais ar, menos moldura**: nunca caixa dentro de diálogo;
  - **o técnico fica na dobra** *Detalhes*, fechada;
  - **coluna estreita não encolhe a letra**: mede-se em 1280px e decide-se o que sai.
  Os tokens, a marca e as peças são os mesmos das duas densidades; muda o ritmo.
- **Por quê.** O ritmo de painel diante de quem não confere listas o dia inteiro lê como ferramenta interna, não como produto.
- **Confere.** `crítica:cara-de-site` (o eixo extra do crítico, só em densidade site).

---

<a id="layout"></a>
## 5. Layout e ritmo

### LAY-01 · O casco não rola; o conteúdo rola
- **Regra.** Raiz `h-screen overflow-hidden`. Dentro da página, o **topo fica parado** e quem rola é a **região do arquétipo**, pela peça de rolagem do kit (`RolagemDoPainel`); o `<main>` rola só como reserva, quando a janela fica mais baixa que o mínimo da página. Barra lateral de **224px** que recolhe para **64px**; recolhe sozinha em tela estreita (< 768px) e em telas declaradas densas, e a largura só anima no gesto do botão (troca de tela e F5 mudam de uma vez). Abaixo de 768px, a barra aberta passa **por cima** do conteúdo, na camada de gaveta (LAY-05). O estado guardado no navegador é lido **depois** da hidratação; antes dela, um script no `<head>` do layout raiz (no Vite, no `index.html`) marca o `<html>` com a preferência, e a barra se desenha pelo CSS a partir dessa marca — sem pulo no F5.
- **Por quê.** Ler o estado antes da hidratação faz servidor e cliente discordarem, e o React descarta a árvore; lê-lo só depois, sem a marca, faz a barra nascer larga e encolher no F5. O topo que rola junto leva embora o título e o primário quando a lista desce.
- **Confere.** Bloco do casco (registro) · `crítica:consistência`.

### LAY-02 · Largura de página
- **Regra.** Container de página `mx-auto w-full max-w-[100rem]` (1600px). Formulário longo vai a `max-w-3xl`, alinhado à esquerda do casco; página de leitura pública, `max-w-5xl`. Exceção nova é declarada no projeto, com motivo.
- **Por quê.** Campo espalhado em 1600px é pior de preencher; linha de leitura longa demais cansa.
- **Confere.** `crítica:densidade`.

### LAY-03 · Ritmo por gap, e o de fora é o dobro do de dentro
- **Regra.** `flex` + `gap`, quase nunca `space-y`. **O espaço entre blocos é ≥ 2× o espaço dentro do bloco** (padrão: `gap-6` fora, `gap-3` dentro; dentro de linha, `gap-2`/`gap-1.5`). Padding lateral do casco: 24px.
- **Por quê.** `gap-4` fora com `gap-3` dentro mediu 1,33 e foi a causa de "as seções se confundem".
- **Confere.** `guarda:composicao-tem-grau` · `crítica:hierarquia`.

### LAY-04 · Responsivo: desktop e notebook primeiro
- **Regra.** O alvo é 1280–1600px; **1280px é o pior caso que se mede**. `xl:` é o breakpoint estrutural; `sm:` ajusta o que empilha. Densidade site que atende celular declara o caminho estreito no projeto.
- **Por quê.** Quem usa os apps opera em notebook dividindo a tela com outra ferramenta.
- **Confere.** `crítica:densidade` (a crítica é feita a 1280px).

### LAY-05 · Empilhamento declarado
- **Regra.** Camadas: fundo 0 · `main` 10 · barra lateral 20 · cabeçalho grudado 30 · gaveta 40 · sobreposições 50. O que precisa passar por cima da barra lateral sai por **portal**, não por `z` maior.
- **Por quê.** O `main` abre contexto de empilhamento; `z` maior dentro dele não passa da barra.
- **Confere.** Revisão de código · `navegador`.

### LAY-06 · Largura de leitura e respiro de rolagem são token
- **Regra.** Texto corrido vai a `max-w-medida` (78ch). O respiro de uma coluna que rola vem da peça de rolagem do kit, em uma de três densidades (`padrao` `px-5 pb-6`, `compacta` `px-4 pb-5`, `solta` só `pb-6`), nunca de padding à mão.
- **Por quê.** Linha de leitura longa demais cansa; padding de coluna escrito à mão diverge entre colunas vizinhas.
- **Confere.** `crítica:densidade` · `guarda` de valor arbitrário.

---

<a id="superficie"></a>
## 6. Superfície e profundidade

### SUP-01 · Três alturas, e só três
- **Regra.** **Chão** (a página: `background`, nada mais) · **peça** (cartão, painel, tabela, bloco: `card` opaca + `superficie` de sombra) · **flutuante** (diálogo, menu, dica, aviso, item arrastado: `card` + `superficie-flutuante`). `superficie-alta` só para hover e seleção de peça. Não existe peça dentro de peça.
- **Por quê.** Graus a mais de superfície foram retirados no mesmo dia em que nasceram: a hierarquia ficava ilegível.
- **Confere.** `guarda:conteudo-mora-em-superficie` · `crítica:ruído`.

### SUP-02 · Nada de vidro
- **Regra.** Nenhuma translucidez como profundidade: sem `backdrop-blur`, sem fundo com alfa como superfície, sem bisel.
- **Por quê.** O vidro sobre halos foi o sistema anterior, e saiu inteiro: a leitura dependia do que estava atrás.
- **Confere.** `guarda:nada-de-vidro`.

### SUP-03 · A separação é o ar
- **Regra.** O que separa assunto de assunto é, nesta ordem: **vão** entre peças · **degrau de tinta** dentro da peça (`bg-muted`, raio de agrupador, sem contorno) · **ar mais rótulo** entre seções. **Numa lista, a linha se separa da vizinha pelo ar:** a célula guarda o ar de cima e de baixo (`lista`, no frontmatter), e a linha cresce com o conteúdo, nunca o espreme. **Na `Table`, a peça desenha um filete-guia** entre linhas vizinhas do mesmo corpo: 1px no token `border`, no meio desse ar, do x do texto da primeira célula (dentro do grupo, o recuo) até 12px antes do fim; nunca depois da última linha do corpo ou do grupo, nunca entre o topo do grupo e a primeira linha; some na linha acesa (hover e foco) e na de cima dela. **O cabeçalho da `Table` fecha numa régua** de 1px `border` de ponta a ponta, que gruda com ele, sem fundo. **O grupo de linhas se separa pelo degrau**, com o vão antes dele maior que o ar depois: o topo pertence às linhas de baixo. O vão grande só vem depois de grupo aberto; entre grupos fechados fica o espaço curto, para a lista toda fechada continuar um índice. Nunca zebra, nunca filete entre grupos nem entre seções, nunca contorno de coluna, nunca fundo no cabeçalho, nunca contêiner com borda própria em volta da tabela; linha de lista escrita pela tela (`divide-y`, `border-b` na linha) é defeito, porque o filete é da peça. A linha de 1px sobrevive só no anel da própria peça, no filete e na régua da `Table` e no que é diagrama. O degrau mede **pelo menos 1,10:1 contra o cartão**, e o `border` **entre 1,15 e 1,30:1**, nos dois temas.
- **Por quê.** Linha demais vira grade, e grade é planilha: por isso o filete é um traço só, horizontal, recuado até o texto, e nunca vertical. Mas o ar separa uma linha da vizinha sem levar o olho do nome a um valor do outro lado da tabela: numa lista larga, com centenas de pixels de vazio entre as colunas, a linha se perdia no caminho, e o cabeçalho grudado sem fronteira deixava o corpo rolar por baixo sem limite. O filete é guia de leitura, não divisória: a pertença continua do ar e do degrau, e ele fica abaixo do degrau no peso (1/48 da área). Abaixo de 1,15:1 a guia some; acima de 1,30 disputa com o degrau. Numa lista de seis grupos e 36 linhas de duas linhas, a célula de 40px deixava 4px entre os textos vizinhos e o grupo encostava na primeira linha: a lista virou um bloco só, sem filete nenhum faltando. No escuro, o degrau media 1,057:1 contra o cartão, metade do claro (1,110), e o grupo sumia. Zebra seria uma segunda tinta disputando com o degrau a mesma pergunta.
- **Confere.** `crítica:ruído` · `guarda:composicao-tem-grau` · `tokens` (`muted` × `card` ≥ 1,10; `border` × `card` entre 1,15 e 1,30; nos dois temas) · `navegador` (a lista grande e a tabela do ateliê, nos dois temas e nas duas densidades: ar entre textos de linhas vizinhas ≥ 12px; filetes por corpo = linhas − 1, começando no x do texto; nenhum na linha acesa; a régua gruda com o cabeçalho).

### SUP-04 · Toda superfície se declara
- **Regra.** Quem monta superfície emite **`data-superficie`** — inclusive a que não vem do kit. O conteúdo de toda página mora numa superfície; faixa de destaque e ação primária podem ficar fora de propósito.
- **Por quê.** A âncora anterior era nome de classe; quando a classe saiu, a regex passou a casar qualquer tag e as duas guardas aprovavam tudo, caladas.
- **Confere.** `guarda:conteudo-mora-em-superficie`.

### SUP-05 · Controle sem sombra
- **Regra.** Botão, campo, seletor e carimbo levam o **anel por dentro** e nada mais. Sombra é de peça.
- **Por quê.** Sombra em controle pequeno faz a barra inteira parecer levitando.
- **Confere.** `crítica:ruído` · `guarda` de sombra em controle.

### SUP-06 · Anel só para foco, e numa escala só
- **Regra.** `ring` é foco, nunca elevação. Foco = anel de **2px na cor da marca, com deslocamento de 2px**, igual em botão, campo e item; o elemento não muda de tamanho ao focar.
- **Por quê.** Duas escalas de anel para a mesma ideia é o defeito puro.
- **Confere.** `guarda` de anel (classes de foco do kit) · `navegador`.

### SUP-07 · O que flutua cabe na tela
- **Regra.** Todo flutuante ancorado (menu, submenu, seletor, popover, cartão de hover, dica) troca de lado quando falta espaço, para a **8px da borda** da janela (`collisionPadding`) e limita a altura ao espaço visível (`max-h-(--radix-…-available-height)`), rolando por dentro (`overflow-y-auto`). Nunca se desliga a troca de lado (`avoidCollisions={false}`). As peças do kit já cumprem; quem monta o primitivo direto cumpre à mão.
- **Por quê.** Um menu longo que sempre abre para baixo, aberto perto do fim da tela, corta a lista: as últimas linhas ficam fora da janela e não se clicam. Os testes em jsdom não medem layout, e o defeito só aparece na tela de quem usa.
- **Confere.** `guarda:o-que-flutua-cabe-na-tela` · `navegador` (o menu longo perto da borda de baixo, no ateliê).

---

<a id="forma"></a>
## 7. Forma

### FORMA-01 · O raio sobe com o tamanho da superfície
- **Regra.** Um raio por classe de peça, do frontmatter `rounded`: **container** 16px (cartão de tela, painel, tabela, diálogo) · **cartão de quadro e de lista** 14px (`rounded-cartao`: menor que o painel que o contém) · **agrupador** 12px (popover, menu, degrau de tinta) · **dica** 10px · **controle** 7px (botão default e lg, campo, select) · **`rounded-md`** (carimbo, botão `sm`) · **caixa de marcação** 5px · **pílula** (botão de ícone, contador, alça, trilha de progresso). Raio fora dessa escala é defeito.
- **Por quê.** Raio por classe de peça mantém a família visual entre telas que nunca foram desenhadas juntas.
- **Confere.** `tokens` · `guarda` de valor arbitrário.

### FORMA-02 · A tracejada é ausência, e só
- **Regra.** `border-dashed` só para **ausência**: placeholder, coluna vazia, caixa sem conteúdo. Nunca "novo", "em edição" ou "atenção".
- **Por quê.** Usar a tracejada para agrupar o que pede ação foi um defeito real: a forma já tinha dono.
- **Confere.** `crítica:consistência` · `guarda` de tracejada.

### FORMA-03 · Borda não é o padrão
- **Regra.** Peça se separa por sombra; assunto, por ar. Contorno sobra para o **controle** (`border-input`) e para o que é **diagrama**. Card sem `border`.
- **Por quê.** Ver SUP-03.
- **Confere.** `crítica:ruído`.

---

<a id="controle"></a>
## 8. Controles

### CTRL-01 · A escala do kit
- **Regra.** Botão `sm` 26px · `default` 30px · `lg` 36px · `icon` 30px redondo; campo e select 30px, raio 7. O `default` tem a altura do campo. Altura de controle **não se escreve à mão** (`h-8`, `h-[34px]`): usa-se a variante ou `h-ctrl`. Campo nativo que não pode ser o `Input` usa a função de classe do campo, nunca uma cópia da lista.
- **Por quê.** Botão e campo em linha alinham sem classe à mão; quem escreve altura à mão fica fora do próximo degrau.
- **Confere.** `guarda` de altura de controle · `tokens`.

### CTRL-02 · A tela de Entrada tem o botão grande
- **Regra.** Na tela de **Entrada** (ver ANATOMIA, arquétipo Entrada) o botão que conclui é `xl` (44px), os campos `xl` (40px), e nada é `sm`. Dentro do casco, o primário segue `lg`. Toda tela de Entrada entra na lista da guarda.
- **Por quê.** Um passo só, feito de vez em quando, pede alvo grande.
- **Confere.** `guarda:a-tela-de-entrada-tem-o-botao-grande`.

### CTRL-03 · As variantes de botão
- **Regra.**
  - **primary**: preenchimento `primary`, texto branco, sem sombra; hover pelo `primary-hover`.
  - **destrutivo**: contorno (MARCA-05).
  - **outline/secondary**: superfície de cartão com o anel de controle; hover vai ao `accent`.
  - **ghost**: transparente até o hover.
  - **link**: tinta com sublinhado em linha cheia a 50% da tinta, a 2,5px do texto, que fecha no hover; sem cor de marca. O sublinhado é o utilitário `sublinhado-de-link` do `@wicomm/tokens`, em toda peça do registro que sublinha (botão, conversa, bloco, carimbo que abre — o `ChipQueAbre` e a `Prioridade` com `onAbrir` —, trilha) — nunca uma cópia das classes. O pontilhado é só da ajuda no texto.
  - **ajuda no texto** (`AjudaNoTexto`, não é botão): pontilhado a 35% da tinta que **não** fecha no hover (o utilitário `sublinhado-de-ajuda`), `cursor-help`, abre a dica no hover e no foco — o link leva a algum lugar; a ajuda só diz.
  - **dividido** (primário com alternativas): as duas metades com o mesmo preenchimento e altura, separadas por 1px de ar; com o primário bloqueado **ou em curso**, o `▾` passa a `secondary` sem mudar de altura nem de cantos, e o estado fica fora do preenchimento, colado ao `▾`.
- **Por quê.** O peso cresce com a gravidade (ver ANATOMIA, PESO-02).
- **Confere.** Registro (as variantes existem só no `button` do kit; o sublinhado, só nos dois utilitários do pacote de tokens: `registro.test` reprova `underline` e `decoration-dotted` escritos à mão numa peça) · `crítica:ação primária`.

### CTRL-04 · Campo
- **Regra.** Mesma altura e raio do botão, superfície de cartão, contorno `input`. Foco = o anel de SUP-06. Desabilitado: `cursor-not-allowed` e 45% de opacidade. Campo que grava tem `<label>`, não placeholder.
- **Por quê.** Placeholder some quando a pessoa começa a digitar, e com ele o que o campo pede.
- **Confere.** Revisão · `navegador` (a guarda de submissão cobre a chave de erro e o desfecho, não o `id`/`htmlFor`; guarda própria a escrever na fatia de guardas).

### CTRL-05 · O carimbo tem uma forma só
- **Regra.** Um casco só para todo carimbo: `inline-flex items-center gap-[5px] rounded-md px-2 py-[3px] text-[11px] font-[650] leading-[1.4] [font-stretch:96%]`, tinta chapada da voz, **sem contorno, sem desfoque, sem bisel**. `ChipDeEstado` diz um **estado** e declara `tom`; `Badge` diz um **valor**, sempre na tinta neutra, e é neutro ou de marca (`variant="marca"`, explícito; o padrão é neutro). O carimbo de estado `neutro` — o `ChipDeEstado` e o `ChipQueAbre` — abre com o **ponto de 6px na tinta do próprio texto**; o em curso tem o giro no lugar dele, e as vozes com matiz não levam ponto. O `Badge` nunca tem ponto; o `Badge` de marca abre com o **filete da marca** (2×10px, no gradiente da marca, MARCA-03) e escreve em `foreground`; o neutro não tem marcador. Tinta da cor da marca em carimbo é defeito: a tinta do carimbo é voz (COR-08). Numa coluna de estados, o alinhamento é o do casco, não o da palavra (o ponto e o giro empurram a palavra). Monograma (iniciais) é quadrado de 16px ou círculo de 20px. Raio, padding, tamanho e tinta **não são escolha de quem usa**.
- **Por quê.** 40 pílulas em 22 construções, com o mesmo estado em `text-[10px]` numa tela e `text-[11px]` na outra. O estado neutro e o valor neutro têm a mesma tinta no mesmo casco: lado a lado (o estado no topo, os valores logo abaixo), o estado se lia como mais um valor. As vozes com matiz já se separam do `Badge` neutro pela tinta, e ponto nelas seria marcador repetido. Já o `Badge` na tinta da marca e o carimbo de uma voz de matiz próxima se confundem (com uma marca vermelha, o de marca e o `ruim` mediram ΔE2000 0,75–2,7 no escuro e 4–6 no claro com a tinta composta), e só a letra os separava: o selo de marca falava com a tinta do erro. Como a marca e a voz (MARCA-02), a separação é de forma — o selo sai da tinta da marca, e o que o separa do estado é o traço da marca dentro do carimbo — forma e lugar: a 2px o gradiente se lê como traço da marca, e o ponto do estado neutro é redondo e na cor do texto. A barra da voz (`FILETE_DO_TOM`) nunca entra num carimbo, para o traço ser só da marca. Na tinta neutra, as duas tintas ficam a ΔE76 13–18 nos dois temas, e o texto do de marca paga 13,2:1 no pior fundo; o filete, decorativo (a palavra carrega o sentido), fica entre 2,3 e 5,4:1 conforme a ponta.
- **Confere.** `guarda:o-carimbo-tem-forma` · registro (o ponto do neutro, o `Badge` sem ponto e o filete só no de marca, em teste) · `navegador` (no ateliê: o de marca ao lado do `ruim` e do estado neutro, nos três fundos) · `crítica:consistência`.

### CTRL-06 · Troca de vista tem uma forma
- **Regra.** Aba de tela e barra de modos são o mesmo controle (`seletor-de-vista`) em duas densidades (`abas` 30px, `modos` 24px): trilha de tinta (`bg-foreground/[0.08]`) e pílula levantada (`bg-card` + sombra baixa) que desliza; **o estado vai no TEXTO** (`foreground-2` → `foreground` + peso 650). Botões `secondary`/`ghost` alternados num grupo são defeito.
- **Por quê.** A pílula contra a trilha mede 1,23:1; quem carrega o estado precisa ser o texto (6,44 → 17,90). Foram medidos 17 menus, 11 do mesmo padrão escritos à mão em quatro cascas.
- **Confere.** `guarda:a-troca-de-vista-tem-uma-forma`.

### CTRL-07 · Nenhum botão tem reticências
- **Regra.** Nem o rótulo que abre um passo a mais (*Editar componente*, não *Editar componente…*), nem o andamento (*Publicando*, não *Publicando…*). Vale para botão do kit, nativo, item de menu e de abas, `aria-label`, `title` e constante de rótulo.
- **Por quê.** O botão desabilitado e o gerúndio já dizem que está rodando; as reticências viram ruído em toda barra.
- **Confere.** `guarda:nenhum-botao-tem-reticencias`.

### CTRL-08 · Item de navegação
- **Regra.** Item de **40px** com ícone de 18px **e rótulo ao lado**. Ativo: `bg-primary/10` com texto em tinta. Barra recolhida: o rótulo vira dica — o único lugar em que hover como pista se justifica.
- **Por quê.** Ícone sozinho é adivinhação; a marca não escreve (MARCA-02).
- **Confere.** Bloco do casco (registro) · `crítica:consistência`.

### CTRL-09 · Ícones
- **Regra.** Uma biblioteca: **`lucide-react`**. Ícone de função tem rótulo ao lado (ou `aria-label` quando é botão de ícone com dica). Tamanhos: 14, 16 e 18px; traço padrão da biblioteca. O ícone de IA é a única peça com degradê próprio (`IconeDaIa`), fora da marca e das vozes; usar degradê em outro ícone pede ADR.
- **Por quê.** Duas bibliotecas de ícone dão dois traços e duas métricas na mesma barra.
- **Confere.** `guarda:icone-de-uma-biblioteca` (aviso na escrita; reprova no CI).
- *Assumida, a confirmar:* os tamanhos 14/16/18 como tokens.

---

<a id="movimento"></a>
## 9. Movimento

### MOV-01 · Movimento por token
- **Regra.** Duração e curva saem dos tokens do frontmatter (`duration-modal-abre`, `duration-menu-abre`, `duration-painel`, `ease-abre`…), nunca `duration-200` solto. O que entra desacelera (`ease-abre`), o que sai acelera (`ease-fecha`), e sair é mais curto que entrar — exceção escrita: `painel` abre e fecha em 200ms, porque uma etapa sai enquanto a outra entra. Atrasos de abrir no passar do mouse (`espiada-abre`/`espiada-fecha`) também são token. Escala inicial: 0,97 no modal, 0,98 no menu.
- **Por quê.** Durações soltas divergem de peça para peça e o sistema perde o ritmo.
- **Confere.** `guarda:o-movimento-tem-escape` (duração solta no kit e em código novo).

### MOV-02 · Toda animação tem escape
- **Regra.** `animate-*` leva `motion-reduce:animate-none`; `transition*` (menos `transition-colors`) leva `motion-reduce:transition-none`, na mesma string. **Com variante** (`data-[state=open]:animate-in`, `hover:`), o escape é `motion-reduce:!animate-none` / `motion-reduce:!transition-none`.
- **Por quê.** A variante tem especificidade 0,2,0 e o escape simples 0,1,0: sem o `!`, o escape perde e a animação roda para quem pediu movimento reduzido.
- **Confere.** `guarda:o-movimento-tem-escape`.

### MOV-03 · O que entra se move; o que sai some
- **Regra.** Transição nova entra só na chegada (`animate-in fade-in-0`), sem animação de saída. Mudança de estado só troca a cor (`duration-cor`). O que aparece no hover/foco usa `duration-revela`. Véu de carregamento só aparece se a espera passar de 120ms (`delay-veu`), **também com movimento reduzido: o escape tira o esmaecer, não a espera**.
- **Por quê.** Animação de saída atrasa a resposta ao gesto que a pessoa já fez.
- **Confere.** `crítica:ruído` · `guarda:o-movimento-tem-escape`.

---

<a id="medir"></a>
## 10. Como se mede

### MED-01 · Cor e tipo se conferem no navegador, no ateliê
- **Regra.** Toda afirmação sobre cor computada, contraste com alfa ou fonte aplicada é conferida **no navegador**, no ateliê do projeto (`/atelie`), nos dois temas lado a lado, com cada peça marcada por `data-vitrine="<nome>"`. Mede-se com as **transições paradas** e depois de **reiniciar o servidor de desenvolvimento** quando a config do Tailwind mudou.
- **Por quê.** jsdom não calcula CSS. Trocar o tema põe a página em transição e o navegador congela o que está fora da tela na cor antiga; classe nova da config não existe até reiniciar, e o que se mede é a ausência dela.
- **Confere.** O crítico pede a medição do ateliê quando a mudança é de cor ou tipo.

---

## Índice das regras

| Código | Regra | Confere |
|---|---|---|
| MARCA-01 | A cor da marca é declarada | tokens |
| MARCA-02 | A marca não escreve | guarda |
| MARCA-03 | O gradiente vive em desenho | tokens, guarda |
| MARCA-04 | Raster da marca nasce de script (o arquivo oficial da marca, com origem, é a exceção; o negativo dele sai por script) | guarda |
| MARCA-05 | Destrutivo é contorno | guarda |
| COR-01 | Duas paletas | guarda, tokens |
| COR-02 | Neutros frios | tokens |
| COR-03 | O matiz responde uma pergunta | guarda, crítica |
| COR-04 | Em curso não tem matiz | crítica |
| COR-05 | Componente declara tom | guarda |
| COR-06 | Dois degraus e o do carimbo | guarda, navegador |
| COR-07 | Carimbo neutro com alfa fixado | guarda, navegador |
| COR-08 | Três canais | crítica |
| COR-09 | Identidade declarada, num lugar só | crítica |
| COR-10 | Peso sem saturação | crítica |
| COR-11 | Contorno de controle a 3:1 | tokens, guarda |
| COR-12 | Piso de contraste | tokens, navegador |
| COR-13 | Isenção de ícone cobrada | guarda, navegador |
| COR-14 | Opacidade não dá hierarquia | navegador, crítica |
| COR-15 | O terminal não segue o tema | tokens, guarda |
| TIPO-01 | Uma família, mono para medida | guarda, navegador |
| TIPO-02 | As vozes da família | guarda |
| TIPO-03 | Medida em mono | crítica |
| TIPO-04 | Um título por página, `h1` | guarda |
| DENS-01 | Instrumento | crítica |
| DENS-02 | Site | crítica |
| LAY-01 | O casco não rola | registro, crítica |
| LAY-02 | Largura de página | crítica |
| LAY-03 | Fora ≥ 2× dentro | guarda, crítica |
| LAY-04 | 1280px é o pior caso | crítica |
| LAY-05 | Empilhamento declarado | revisão, navegador |
| LAY-06 | Largura de leitura e respiro | crítica, guarda |
| SUP-01 | Três alturas | guarda, crítica |
| SUP-02 | Nada de vidro | guarda |
| SUP-03 | A separação é o ar | crítica, guarda, tokens, navegador |
| SUP-04 | Superfície se declara | guarda |
| SUP-05 | Controle sem sombra | crítica, guarda |
| SUP-06 | Anel só para foco | guarda, navegador |
| SUP-07 | O que flutua cabe na tela | guarda, navegador |
| FORMA-01 | O raio sobe com a superfície | tokens, guarda |
| FORMA-02 | Tracejada é ausência | crítica, guarda |
| FORMA-03 | Borda não é o padrão | crítica |
| CTRL-01 | A escala do kit | guarda, tokens |
| CTRL-02 | Entrada tem o botão grande | guarda |
| CTRL-03 | Variantes de botão | registro, crítica |
| CTRL-04 | Campo | revisão, navegador |
| CTRL-05 | Carimbo com uma forma | guarda |
| CTRL-06 | Troca de vista com uma forma | guarda |
| CTRL-07 | Nenhum botão com reticências | guarda |
| CTRL-08 | Item de navegação | registro, crítica |
| CTRL-09 | Ícones | guarda |
| MOV-01 | Movimento por token | guarda |
| MOV-02 | Toda animação tem escape | guarda |
| MOV-03 | Entra se move, sai some | crítica, guarda |
| MED-01 | Mede-se no navegador | crítica |
