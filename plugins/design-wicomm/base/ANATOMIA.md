---
name: design-system
versao: 0.29.0
description: A anatomia dos apps React do sistema — o que vai onde na tela, com a regra, o porquê e como cada regra se confere.
---

# Anatomia — o que vai onde

> A [`DESIGN.md`](DESIGN.md) diz **como** a tela parece: token, cor, tipo, raio, sombra, movimento. Este arquivo diz **o que** vai **onde**: os tipos de tela, as regiões de cada um, o lugar de cada mensagem e a peça do kit para cada função. Valor de token aqui é defeito (está na DESIGN); regra de aparência aqui também.
>
> Quem desenha lê os dois antes de tela nova ou de mudar um desenho decidido: o agente `designer` (revisão de arquitetura) e o `critico-de-ui` (crítica), que julga pelos dois. O formato de cada regra — **Regra · Por quê · Confere** — está explicado na [DESIGN](DESIGN.md#como-ler-uma-regra).
>
> Os nomes de peça são os do registro do sistema (em português, com o nome shadcn equivalente na descrição da peça). Enquanto o registro não existe, a peça que falta no projeto se cria no kit do projeto, com o mesmo nome e a mesma função.

<a id="principios"></a>
## 1. Os seis princípios

Cada princípio é um critério da revisão de arquitetura e da crítica.

### PRIN-01 · Uma tela, uma tarefa
- **Regra.** A tela responde a **uma** pergunta. Configuração, histórico, análise e publicação que não são a tarefa dela vão para outra tela, gaveta ou diálogo.
- **Por quê.** Duas tarefas na mesma tela dividem o primário e a pessoa não sabe por onde começar.
- **Confere.** `crítica:hierarquia` · `crítica:ação primária`.

### PRIN-02 · O canvas é sagrado
- **Regra.** No arquétipo Editor, o preview domina: estrutura à esquerda, inspector ou conversa à direita, e nada cresce por cima ou por dentro do canvas. Exceção escrita por projeto, com motivo.
- **Por quê.** O que cresce sobre o canvas esconde justamente o que a pessoa está editando.
- **Confere.** `crítica:hierarquia`.

### PRIN-03 · Avançado não é ausente
- **Regra.** A **ação** rara mora no menu do objeto dela (o `⋯`, o `▾`), nunca numa dobra fechada. O **informativo** raro pode ir para a dobra, a aba ou a gaveta. Os dois continuam alcançáveis; o bloqueado segue PESO-03.
- **Por quê.** Ação escondida em dobra é ação que ninguém acha.
- **Confere.** `crítica:clareza da ação`.

### PRIN-04 · Dado sem ação é ruído
- **Regra.** Informação que não muda o que a pessoa faz agora não tem espaço permanente. Se importa em algum momento, vira chip com detalhe sob demanda.
- **Por quê.** Cada dado fixo na tela compete com o que pede decisão.
- **Confere.** `crítica:ruído` · revisão de arquitetura (o inventário diz a decisão que cada dado gera).

### PRIN-05 · Componente antes de layout
- **Regra.** Toda região é montada com peças do kit (o registro do sistema). Se falta peça, a peça nova entra **no kit** — com partes, estados e variantes, e no ateliê — antes de entrar na tela. Arranjo à mão na tela é defeito.
- **Por quê.** O arranjo à mão vira a próxima variante que diverge, e é assim que dois apps deixam de parecer da mesma empresa.
- **Confere.** `guarda:componente-que-ninguem-monta` · `crítica:consistência`.

### PRIN-06 · Token ou não existe
- **Regra.** Cor, espaço, tipo, raio, sombra e duração saem da escala da DESIGN. Valor solto (`#hex`, `text-[15px]`, `h-[34px]`, `duration-200`) é defeito.
- **Por quê.** Valor solto não acompanha o próximo ajuste de escala nem o tema.
- **Confere.** `guarda` de valor arbitrário (aviso na escrita, reprova no CI).

---

<a id="casco"></a>
## 2. O casco

O casco é o que faz dois apps da mesma empresa parecerem um só: é a primeira coisa que o cliente vê e a que ele mais repete.

### CASCO-01 · Regiões do casco
- **Regra.** Todo app autenticado tem o mesmo casco:
  | região | o que mora | o que NÃO mora |
  |---|---|---|
  | **Barra lateral** (esquerda, recolhível) | o logotipo do tema, os destinos do app (item com ícone **e** rótulo), a conta e o tema ao pé | ação de tela, aviso, filtro |
  | **Topo da página** | a trilha (em tela de detalhe), o título (`h1`, um só), o estado do objeto quando a tela é de um objeto, os valores que o classificam (na linha de baixo, CASCO-04), o primário da tela; na Lista, os filtros que valem para a tela inteira e, abaixo deles, os recortes contados (ARQ-05) | ação rara (vai ao `⋯`) |
  | **Conteúdo** | o arquétipo da tela, em superfície | conteúdo solto no fundo |
  O **cabeçalho**, grudado acima do topo, é opcional e só leva o que vale **igual em todas as telas** e muda o app inteiro: a troca de contexto, a busca global, a conexão com um serviço de fora — nunca título, primário, conta ou tema. O **topo da página** leva o que muda quando a tela muda. Para um caso novo, o teste é: *a coisa continua valendo depois de trocar de destino?* Se sim, é do cabeçalho; se não, é do topo. O topo não rola (LAY-01). Os arquétipos **Entrada e Editor ficam fora do casco**; no Editor, a barra (ARQ-03) faz o papel dele e leva a volta, o nome do objeto e a conta.
- **Por quê.** Navegação, título e primário no mesmo lugar em todo app é o que o cliente reconhece como "a mesma empresa".
- **Confere.** Bloco do casco (registro, `@wicomm/casco`) · bloco do Editor (registro, `@wicomm/editor`) · `guarda:o-titulo-da-pagina-e-um-so` · `crítica:consistência`.

### CASCO-02 · Um menu só, o do kit
- **Regra.** Todo menu de ações é a peça `Menu` do kit (`ItemDoMenu`, `SubmenuDoMenu`). Nenhum arquivo de tela escreve a própria linha de menu nem separa grupos de menu por filete (`<hr>`).
- **Por quê.** Menus escritos à mão divergem em altura, foco e item bloqueado, e a pessoa aprende um comportamento por tela.
- **Confere.** `guarda:um-menu-so`.

### CASCO-03 · Tela de detalhe tem trilha
- **Regra.** Toda tela de um objeto (detalhe, edição) abre com a trilha até a lista de onde veio. No Editor, fora do casco, a volta e o nome da `BarraDoEditor` cumprem a trilha: a volta é obrigatória na peça. A lista das telas que existem e a das que montam a trilha são forçadas a concordar por teste.
- **Por quê.** A tela onde mais se passava tempo não tinha volta nenhuma, e a peça de trilha já existia.
- **Confere.** `guarda:toda-tela-de-detalhe-tem-trilha`.

### CASCO-04 · Estado na linha do título, valor na linha de baixo
- **Regra.** Na tela de um objeto, o topo leva o **estado** do objeto na linha do título (`estado`, um `ChipDeEstado` com voz) e os **valores que o classificam** — a categoria, o nível, a origem — numa linha própria logo abaixo (`valores` do `TopoDaPagina`, só `Badge` neutro — o de marca não entra no topo, onde disputaria a voz com o estado —, numa linha que quebra no estreito). Sem valores, a linha não existe; enquanto carregam, a peça desenha a espera já na altura final (`valores="carregando"`). Valor na linha do título, valor no `estado` e linha de valores montada à mão na tela são defeito.
- **Por quê.** O título é a única coisa da linha que encolhe: cada valor posto ao lado dele tira largura do nome, e com quatro valores e as ações o título some em tela larga e corta na comum. Estado tem voz e decide o que a pessoa faz; valor só situa, e não deve disputar o lugar do estado.
- **Confere.** Peça `TopoDaPagina` (registro, slot `valores`) · `crítica:consistência` · `crítica:hierarquia`.

---

<a id="arquetipos"></a>
## 3. Os arquétipos de tela

### ARQ-01 · Toda tela é um de cinco
- **Regra.** Toda tela é um destes arquétipos. A que não cabe em nenhum vira **arquétipo novo, aqui, antes do código** (proposta à base, não exceção local).
  | Arquétipo | Pergunta | Exemplos | Regiões |
  |---|---|---|---|
  | **Lista** | *o que pede a minha atenção?* | a fila de pedidos, os clientes, as novidades | topo (título + filtro global + primário; os recortes contados abaixo dos filtros, quando a atenção se divide em situações que se sobrepõem, ARQ-05) · lista ou quadro (no quadro, a coluna mora no chão e o cartão é a peça; a coluna vazia recolhe) · vazio |
  | **Mesa** | *em que pé está isto, e o que eu faço agora?* | o detalhe de um pedido, uma conferência | topo (nome + estado + primário) · trilho do percurso · conteúdo da etapa |
  | **Editor** | *como fica se eu mudar isto?* | editor de página, construtor de formulário | barra · estrutura · canvas · inspector ou conversa |
  | **Entrada** | *qual é o único passo?* | login, senha nova, conectar uma conta | cartão sozinho no fundo, uma ação (`xl`) |
  | **Formulário** | *o que eu preciso dizer para disparar?* | novo pedido, nova conferência | casco de formulário (largura de LAY-02) · um `Bloco` por grupo de campos (`fieldset`/`legend` por dentro, como semântica) · um primário no fim |
  A **Mesa pode não ter primário** quando a tela é de leitura e o gesto mora noutra: o topo é só nome + estado, e o caminho de ação é uma linha com link, nunca um segundo lugar para o mesmo gesto. A **Mesa com abas** põe as abas no lugar do trilho, sem apoio à direita.
  **A espera tem a forma do que vai chegar** (EST-01): a tela com mais de uma vista (abas, `BarraDeModos`) espera na forma da vista que está aberta, não na de outra — a Mesa com abas espera em abas; a lista corrida, em linhas (`EsperaDaLista`); a lista agrupada, em grupos (`EsperaDosGrupos`); o quadro, em colunas (`EsperaDoQuadro`). A troca de vista troca a espera junto. Em toda espera, a altura da linha é a da linha real com o conteúdo de verdade; na lista agrupada, o degrau, o ar, o recuo e o vão também são os da peça que vem e saem dela (`EsperaDosGrupos`), não da tela, com o grupo fechado esperando fechado.
- **Por quê.** Cinco formas conhecidas deixam a pessoa saber onde está o primário antes de ler a tela. A espera de outra forma promete uma tela que não vem, e a de medidas escritas à mão faz a lista pular quando os dados chegam.
- **Confere.** Revisão de arquitetura (declara o arquétipo) · auditoria de projeto (classifica cada rota) · `crítica:hierarquia` · `crítica:aderência` (a espera de cada vista, no ateliê, contra a vista que chega).

### ARQ-02 · Painel de análise é Lista com medidores
- **Regra.** Tela de análise (custo, uso, cota) é **Lista**: filtros globais no topo valendo para a tela inteira; cada medidor com largura pelo peso da pergunta, não por grade igual.
- **Por quê.** Grade igual dá o mesmo peso a perguntas de pesos diferentes.
- **Confere.** `crítica:hierarquia`.

<a id="editor"></a>
### ARQ-03 · O Editor, região por região
- **Regra.** Larguras em **1280px**, o pior caso:
  | Região | Largura | O que mora | O que NÃO mora |
  |---|---|---|---|
  | **Barra** — uma linha | 100%, altura de um controle + respiro | à esquerda: voltar, onde estou, o estado do rascunho (chip), desfazer/refazer; ao centro: vista e zoom; à direita: a conversa, o **primário**, o `⋯` e a conta | aviso longo, frase, segundo primário, ação rara |
  | **Estrutura** — esquerda | 240–288px, recolhível | a árvore do que existe e em que ordem, e o "adicionar" | o formulário do item (é do inspector) |
  | **Canvas** — centro | o resto, **nunca menos de 60%** | o preview e a barra flutuante do item selecionado (nome, mover, `⋯`) | aviso, faixa, painel, cartão de ajuda |
  | **Inspector** — direita | 320–340px | os campos do item selecionado, agrupados por dobra | histórico, publicação |
  | **Conversa** — direita | 320–340px, **no lugar do inspector** | o pedido à IA e o desfecho de cada pedido | os passos da máquina e o porquê técnico (vão numa dobra *Detalhes*) |
  Inspector e conversa disputam a mesma coluna: abre um, o outro dá lugar. Abaixo de 1280px a coluna da direita vira gaveta lateral. A estrutura recolhe para o trilho de ícones quando, aberta, deixaria o canvas abaixo de 60% — a regra é medida, não um ponto fixo.
- **Por quê.** Com estrutura, inspector e conversa abertos ao mesmo tempo, o canvas cai abaixo de 60% em 1280px.
- **Confere.** Bloco do arquétipo Editor (registro) · `crítica:densidade`.

### ARQ-04 · Linha de lista que se reordena
- **Regra.** A linha começa pelo botão de selecionar (ícone + nome); a alça de arrastar fica **no fim**, à esquerda do `⋯`, com `gap-1`, aparece no hover, no foco e na linha ativa, e tem a dica *Arrastar para mudar a ordem*.
- **Por quê.** No início, a alça fica sob o ícone do trilho quando a lista abre por cima dele, e o clique vira arrasto.
- **Confere.** `crítica:clareza da ação`.

### ARQ-05 · O que pede atenção em situações que se sobrepõem é uma fileira de recortes contados
- **Regra.** Quando a pergunta da Lista se responde por situações que **se sobrepõem** (atrasado, sem responsável, parado: um item pode estar em várias), o topo leva uma fileira de recortes contados no `resumo` do `TopoDaPagina`, **abaixo dos filtros**: o nome da fileira e um botão por situação, com o nome e a contagem. É **um recorte por vez**: clicar de novo desliga, e sem recorte a lista mostra tudo o que os filtros mostram. O recorte vale junto com os filtros, mora no endereço (CONV-06) e conta como filtro ativo: o *limpar* o leva, e a lista vazia diz `filtro` (EST-02); chave desconhecida no endereço vale como sem recorte. Cada número conta o que os filtros mostram e cai no recorte, pelo **mesmo predicado** que recorta a lista (CONV-15), e não muda com o recorte ativo. Todos os recortes do papel aparecem, o zero inclusive (EST-04), e o nome do recorte não muda no zero: aqui o zero informa. O recorte ativo que cai a zero continua ativo. **Não há total:** as partes se sobrepõem e não somam. O tom do número é a voz que a situação pede (COR-03), só acima de zero, e `ok` não entra. A linha mostra, numa célula dela (o prazo, a pessoa, o estado), o sinal de cada recorte em que entra. A situação que **reparte** o conjunto é a `BarraDeModos` em `abas` dos filtros, e o recorte que coincide com uma aba não se repete. O peso vem da posição e da voz do número, não do tamanho: nada de cartão de indicador, número grande ou gráfico (PRIN-04, COR-10), e *quanto* e *como evoluiu* são de outra tela (ARQ-02). A fileira cabe numa linha na largura de referência com a barra lateral aberta; se não cabe, são recortes demais.
- **Por quê.** Sem lugar na base, a fileira é montada à mão, com o rótulo à vista e o nome do grupo em duas strings que podem divergir. O número fora do predicado da lista promete uma quantidade e entrega outra; o total de situações que se sobrepõem conta o mesmo item duas vezes; e o cartão de indicador dá peso de análise a um gesto que só recorta.
- **Confere.** Peça `TopoDaPagina` (registro, slot `resumo`: a alternância, o zero, o `‒` e o nome do grupo em teste) · `crítica:hierarquia` · `crítica:aderência`.

---

<a id="mensagens"></a>
## 4. Onde mora cada mensagem

A pergunta que decide o lugar: **a quem a mensagem diz respeito, e por quanto tempo ela vale?** Ela mora o mais perto possível da coisa de que fala, e dura o tempo que vale.

### MSG-01 · A matriz das mensagens
- **Regra.**
  | Lugar | Para quê | Duração | Peça | Exemplo |
  |---|---|---|---|---|
  | **No campo** | validação de um campo, e a ajuda que gera decisão | enquanto vale | `aria-describedby` + texto em legenda abaixo do campo | "Este link leva para fora do site" |
  | **No ⓘ do campo** | ajuda que não gera decisão (formato, limite, o que o vazio significa) | enquanto o foco ou o mouse estiver nele | `DicaDeAjuda`, ao lado do controle, com o texto no `aria-describedby` dele | "JPG, PNG ou GIF até 8 MB" |
  | **No bloco** | o desfecho de uma ação daquele bloco | até a próxima ação | texto no fim do bloco, com `tom` | "Nada mudou." |
  | **No item, no canvas** | estado de UM item (trabalhando, oculto, alterado e não publicado) | enquanto vale | `Estado` (ponto/play) na barra flutuante ou na linha da árvore | o item que a IA está editando |
  | **No cabeçalho do inspector** | o pedido em andamento sobre o item aberto, e o desfecho ainda não visto | enquanto anda; o desfecho até ser visto | `ChipQueAbre`; o clique abre a conversa no pedido | "editando" |
  | **Chip da barra** | estado do conjunto inteiro, em uma palavra e com número | enquanto vale | `ChipDeEstado`; o clique abre o detalhe | "3 mudanças" |
  | **Faixa abaixo do topo** | **só** quando a tela inteira mente se a pessoa não souber (está editando algo que não está no ar, ou num escopo diferente do normal) | enquanto vale, **com a saída na própria faixa**; sem X | `Faixa` (uma só): no casco, entre o `TopoDaPagina` e a região que rola; no Editor, abaixo da barra | "Você está vendo uma versão que não está no ar" + "Voltar à versão no ar" |
  | **Conversa** | o que a IA fez, o que ela pergunta e o desfecho | o histórico do pedido | a bolha do desfecho em uma frase; o técnico na dobra *Detalhes* | "Preciso de uma escolha sua." |
  | **Diálogo** | confirmação de ação irreversível ou cara | até a pessoa responder; com `onConfirmar`, até a ação terminar, e a falha fica no diálogo | `useConfirm`, com a variante destrutiva | "Publicar agora?" |
  | **Diálogo que bloqueia** | a tela não serve até uma condição de fora mudar | até a condição mudar; a saída no rodapé | `DialogLongo` com `bloqueia` (`alertdialog`, sem X, sem Esc, sem clique fora) | "A sua conexão com o serviço venceu" |
  | **Toast** | desfecho de ação cujo bloco **sumiu** (fechou, navegou) | some sozinho | `useToast`, só `ok`/`ruim`/`neutro` | "Agendamento cancelado" |
  | **Carregando por cima** | troca de contexto: o que está na região deixou de valer até o novo chegar | enquanto dura, a partir de 120ms | `CarregandoPorCima` em volta da região que mente, nunca do casco | "Abrindo a versão" |
- **Por quê.** Mensagem longe da coisa de que fala não é lida; mensagem que dura mais do que vale vira ruído permanente.
- **Confere.** `crítica:aderência` (o crítico confere o lugar de cada mensagem da revisão contra esta matriz).

### MSG-02 · No máximo uma faixa
- **Regra.** Uma faixa por tela. A segunda condição vira linha da mesma faixa.
- **Por quê.** Duas faixas empilhadas empurram o conteúdo e competem; a pessoa para de ler as duas.
- **Confere.** `crítica:ruído`.

### MSG-03 · Mensagem para quem opera não aparece para quem usa
- **Regra.** Detalhe de máquina — fila, processo, credencial de integração, erro técnico cru, identificador interno — é de quem opera. Para quem usa o app (inclusive o cliente), o mesmo fato vira **o que ele pode fazer** ("não deu para publicar agora; tente em alguns minutos"). Exceção é declarada no projeto, com motivo, e lista exatamente o que passa.
- **Por quê.** Termo técnico na tela do cliente é ruído para ele e exposição para a empresa.
- **Confere.** `crítica:aderência` · revisão de texto.

### MSG-04 · Erro mora no bloco que o disparou
- **Regra.** O erro aparece **no bloco** da ação que falhou — nunca só no `title` nativo, nunca só no toast.
- **Por quê.** Toast diz que falhou e não diz onde consertar.
- **Confere.** `guarda:o-erro-de-submissao-alcanca-os-olhos`.

### MSG-05 · Texto de interface não cita documento
- **Regra.** Nada de `SPEC-014`, `ADR 0014`, `§3` em rótulo, dica, erro, e-mail — inclusive no texto que nasce no servidor e chega à tela. Escreva o que a coisa É.
- **Por quê.** Rastreabilidade vive em código, commit e docs; na tela, é ruído que ninguém pode abrir.
- **Confere.** `guarda:o-texto-da-tela-nao-cita-documento` (varredura de padrões `ADR \d`, `SPEC-\d`, `§`).

### MSG-06 · A mensagem que pede uma ação traz a saída
- **Regra.** Toda mensagem que pede uma ação (a faixa, a recusa de um primário) traz a saída consigo e chama **a mesma ação** do menu, não uma cópia. O andamento dela mora no botão que a disparou; disparada de um menu, que fecha, mora no chip da barra. Numa faixa com vários assuntos, uma linha por assunto, na ordem: erro, desfecho de gesto, conexão, prévia, versão, escopo.
- **Por quê.** A mensagem sem saída manda a pessoa caçar o gesto; duas cópias da mesma ação divergem.
- **Confere.** `crítica:clareza da ação`.

### MSG-07 · O botão diz o que acontece
- **Regra.** Rótulo de botão e de item de menu **que faz algo** é verbo no infinitivo, com o objeto quando o verbo sozinho não diz qual (*Salvar alterações*, *Publicar página*, *Excluir 3 arquivos*); nunca *OK*, *Sim*, *Enviar* ou *Confirmar* sozinhos. O botão que confirma um diálogo repete o verbo do título dele (`confirmar` passado ao `useConfirm`, nunca o padrão). O que só fecha sem fazer nada é *Cancelar*; a alternativa que também faz algo nomeia o que faz. O item que **leva a um lugar** ou **escolhe uma opção** (destino de navegação, tema, vista, filtro) diz o nome do lugar ou da opção (*Minha conta*, *Escuro*). Sem reticências (CTRL-07).
- **Por quê.** *OK* obriga a reler a pergunta para saber o que se aceita; o verbo no botão é a última chance de a pessoa ver o que vai acontecer antes de acontecer.
- **Confere.** `crítica:clareza da ação` · skill `textos-de-interface` (busca por `>OK<`, `"Confirmar"` e `pedir(` sem `confirmar`).

### MSG-08 · A confirmação pergunta a ação e diz o que não volta
- **Regra.** O título do diálogo de confirmação é a **ação como pergunta**, com o objeto e a quantidade (*Excluir 3 arquivos?*, *Publicar agora?*), nunca *Tem certeza?*. O corpo diz, numa frase, a consequência que a pessoa não vê na tela: o que some, quem é avisado, o que não dá para desfazer. Sem consequência a dizer, não há corpo.
- **Por quê.** *Tem certeza?* pede atenção sem dizer a quê: a pessoa clica por hábito e a confirmação vira um clique a mais, que não protege nada.
- **Confere.** `crítica:aderência` · skill `textos-de-interface` (busca por *Tem certeza*).

### MSG-09 · O erro diz o que não aconteceu e o que fazer agora
- **Regra.** Mensagem de erro tem duas partes, nas palavras de quem usa: **o que não aconteceu** e **o que a pessoa pode fazer agora** (*Não deu para salvar: já existe uma página com este nome. Escolha outro nome.*). Sem culpar quem usa, sem código, sem *Erro:* no começo e sem *Ocorreu um erro* sozinho. Quando a saída é um gesto, ele vem junto (MSG-06); quando não há o que fazer, a mensagem diz quando tentar de novo ou a quem recorrer.
- **Por quê.** *Ocorreu um erro* diz que falhou e não diz o que fazer: a pessoa repete o mesmo gesto, falha de novo e desiste.
- **Confere.** `crítica:aderência` · skill `textos-de-interface` (busca por *Ocorreu um erro*, *Erro:* e mensagem crua do servidor repassada à tela).

---

<a id="pecas"></a>
## 5. A peça de cada função

### PECA-01 · Tabela da peça por função
- **Regra.** Cada função tem **uma** peça, e a coluna "Não use" é defeito:
  | Função | Peça | Não use |
  |---|---|---|
  | Superfície de um assunto | `Card` / `Painel` / `Bloco` | `div` com borda à mão |
  | Agrupar dentro da peça | `BlocoDeTinta` (degrau de tinta) | segunda superfície, filete |
  | Título de bloco | `Secao`, `TopoDoPainel` | `h3` com classe à mão |
  | Esconder o informativo | `Dobra` (dentro de uma peça; numa linha de lista, a própria frase abre), `PainelDobravel` (a peça inteira) | esconder ação disponível |
  | Assunto da janela ou do item, antes da leitura | `MedalhaoDoIcone` (`md` no cabeçalho, `sm` no item; neutro por padrão, `tom` quando a tela diz erro ou recusa — a ausência é neutra, COR-10) | disco com ícone feito à mão |
  | Estado em uma palavra | `ChipDeEstado` (declara `tom`) | `span` colorido |
  | Estado que abre o detalhe | `ChipQueAbre` | `button` à mão em volta do chip |
  | Valor rotulado (um valor que classifica, não um estado) | `Badge`: neutro por padrão; `variant="marca"` explícito, na tinta neutra com texto em tinta e o filete da marca (CTRL-05) | chip para valor, `Badge` com `tom`, `ChipDeEstado` para valor, `Badge` de marca em tinta rosa |
  | Marcador mínimo de voz | `Estado` (`ponto`, `play`) | círculo à mão |
  | O percurso de um objeto (na Mesa) | `TrilhoDoPercurso`: as etapas em ordem, só a atual com `Estado` e `tom`, a feita com o ícone de feito, a que vem sem ponto; a cor de etapa, quando o projeto a declara, entra como `PontoDaEtapa` dentro da estação | `Estado` com `tom` em toda etapa, cor da etapa à mão, `Passos` ou `Progress` para o percurso |
  | Região sem itens | `Vazio`, declarando a causa (`nada-ainda`, `filtro`, `nao-se-aplica`, `nao-informado`) e a saída quando há | ✓ sobre nada, cartão de voz, texto solto |
  | Lista de objetos | `Table`, que declara a `densidade`: a linha cresce com o conteúdo e guarda o ar da DESIGN (SUP-03); o filete-guia entre linhas e a régua do cabeçalho são da peça; cabeçalho `t-coluna` de 40px, grudado, sem fundo; a linha inteira abre por `LinkDaLinha`; o hover tem a forma do foco e apaga o filete; a coluna que some no celular é `esconderNoCelular`; mora numa superfície (`Painel`, `Card`) | linha escrita pela tela (`divide-y`, `border-b` na linha), filete de ponta a ponta, zebra, fundo no cabeçalho, borda em volta da tabela, altura fixa na célula que espreme a segunda linha, grade de `div` à mão |
  | Grupo de linhas numa lista (etapa, semana, assunto) | `LinhaDoGrupo`: o próprio `<tbody>`, com a linha do grupo em `th scope="rowgroup"` no degrau de tinta e raio de agrupador, o vão antes do grupo (grande só depois de grupo aberto, curto entre fechados) e o ar curto depois do topo, que só existe com o grupo aberto (SUP-03), o nome um degrau acima do corpo (TIPO-02), as linhas recuadas até o nome do grupo (e, quando algum grupo da tabela tem identidade, até depois do ponto: todo grupo reserva o lugar dele), com o filete delas começando no recuo e nenhum entre o topo e a primeira linha nem depois da última, 8px (12 no site) da régua do cabeçalho ao primeiro grupo, a contagem em `t-medida` — a fração (*7 de 10*) ou a quantidade com a unidade (*3 entregas*), esta sem trilha —, a trilha compacta da marca ou o `Medidor compacto` opcionais encostados no fim, em lugar fixo (as barras de uma coluna começam no mesmo x), e as células alinhadas às colunas, que esvaziam no celular quando a coluna some (`esconderNoCelular`, a mesma prop do `TableHead` e da `TableCell`); no estreito o nome fica e o fim cede; o grupo vazio fica inerte sem opacidade e diz a causa (`semLinhas`), com ou sem contagem; a linha do grupo não acende no hover | linha de grupo à mão em cada tela, `tr` com fundo e `colSpan` à mão, filete entre grupos, opacidade no grupo vazio, barra que começa logo depois do nome, classe de coluna escondida copiada à mão, zebra, recuo à mão nas linhas, linha acesa com a mesma silhueta do degrau, fração fingida (*0 de 0*) para dizer que o grupo está vazio |
  | Lista agrupada por período (semana, mês) | `Table` com uma `LinhaDoGrupo` por período, na ordem do tempo: o nome do grupo é o período por extenso (o atual pode levar o nome relativo antes: *Esta semana · 2 a 8 de nov*), a contagem é a quantidade com a unidade (*3 entregas*); o período sem itens fica no lugar, como grupo vazio que diz a causa (*Nenhuma entrega*); períodos vazios em sequência viram um grupo só, com o intervalo no nome (*7 de dez a 10 de jan*) e a extensão na causa (*Nenhuma entrega em 5 semanas*); o período atual nunca se junta e abre de início; a espera é a `EsperaDosGrupos` | período vazio que some, um degrau por período vazio em sequência, fração no lugar da quantidade, a data repetida em cada linha no lugar do grupo, cabeçalho de período escrito à mão |
  | Quadro de tarefas (colunas de etapa com cartões que se movem) | `Quadro`, `ColunaDoQuadro` (com `CabecalhoDaColuna`, `ContagemDaColuna` e `PilhaDaColuna`), `FitaDaColuna`, `CartaoDoQuadro` com as duas zonas, o pedido (`PedidoDoCartao`: `CabecaDoCartao`, `TituloDoCartao`, `MiniaturaDoCartao`, `IdentidadeDoCartao`) e a vida (`VidaDoCartao`, a bandeja, com o `InformativoDoCartao`), `VagaDoCartao`, `EsperaDoQuadro`: a coluna mora no chão (sem superfície) e o cartão é a peça (`superficie`, `rounded-cartao`); a bandeja no pé do cartão aparece sempre, cinza em repouso e tingida pela voz só quando o item pede algo; o alvo de soltar na tinta da marca com o tracejado; a coluna vazia recolhe na fita; as medidas do frontmatter `quadro`; o arrastar é do app | `Painel` como coluna, `BlocoDeTinta` como cartão, fundo colorido no cartão inteiro, `div` com `role="button"` como cartão, coluna vazia com o `Vazio` alto |
  | Prioridade de um item | `Prioridade`: o carimbo neutro com o glifo de barras e a palavra, o glifo e a palavra na cor declarada do nível (COR-09); só a urgente fala, na voz de espera; o nível comum não se mostra; com `onAbrir`, o carimbo aplica o recorte pelo nível, com o gesto do `ChipQueAbre` (o sublinhado do link, o anel de foco, o alvo de 24px) e a palavra visível como nome; `ativo` marca o recorte ligado (`aria-pressed`, o sublinhado cheio e mais grosso, sem contorno) e o clique no ativo o desliga (`onDesligar`); na contagem, quem chama escreve o número e a palavra (*3 altas*), e o zero é `zerada`: a forma do nível, sem a cor e sem gesto | tinta do carimbo por nível, filete colorido, cor de nível fora da `Prioridade`, prioridade em texto corrido, `button` à mão em volta da `Prioridade`, `nivel={0}` para a contagem zero, `aria-label` que diga outra coisa que a palavra, `onAbrir` dentro da linha ou do cartão que já abre o item |
  | A pessoa numa linha | `Pessoa`: o `Monograma` de 20px na cor da pessoa pelo id (COR-09) e o nome na tinta de texto, o papel na legenda; a ausência no círculo tracejado com a frase de quem chama; o id sem nome é *Pessoa sem nome*; várias pessoas, `PilhaDePessoas` (até 3 monogramas e *+N*; com uma a mais que o limite, a pessoa no lugar do *+1*; a frase inteira na dica e no nome acessível) | a cor da pessoa pelo nome ou passada à mão, o nome na cor da pessoa fora da conversa, a cor da pessoa no fundo da linha (COR-09), o id cru no lugar do nome, pilha sem a frase inteira |
  | Conversa entre pessoas (comentários, mensagens de um item) | `Conversa` (rotulada por quem chama) com `BalaoDaConversa`: o meu à direita na tinta da marca, o do outro à esquerda no `muted`, `rounded-xl` e, no primeiro do grupo, o canto de quem fala menos redondo; a frase inteira (quem, de onde, quando) escondida para o leitor de tela, e nome, selo (`AutorDaConversa`) e hora (`<time>`) como enfeite; o dia em `DiaDaConversa`; só o balão que chegou com a conversa aberta entra com o fade, e o anúncio dele é do app, numa região `role="status"` que já existe (ACES-05), porque só o app sabe que a mensagem é de outra pessoa. O corpo em `TextoComLinks`: o `http(s)` vira link em nova aba, tinta com sublinhado (MARCA-02), e o resto segue texto. A cor da pessoa (COR-09) no monograma, como em todo lugar, e no nome do autor (`AutorDaConversa`, pela mesma chave); a `PilhaDePessoas` `decorativa` quando a frase ao lado já diz os nomes | o corpo como HTML cru, balão com tinta de voz (o erro de envio é texto abaixo do campo), balão na cor da pessoa, rabicho desenhado, a conversa com a IA (essa é a coluna do Editor) |
  | Prazo numa linha | `Prazo`: a data ou o intervalo em `t-medida` (o intervalo de um dia escreve o dia uma vez) e a legenda relativa embaixo (*em 12 dias*), ou ao lado (`emLinha`); só a data (`relativo={false}`) onde quem lê não deve ver a contagem; a voz só com o `tom` que quem chama declara (o limiar é do projeto); `forma="chip"` quando o prazo é o estado do objeto da linha; *Sem data* quando não há | data crua sem legenda, prazo que se pinta sozinho, uma célula de prazo diferente por tela |
  | Intervalo de dois valores (de, até: datas, valores) | `IntervaloDeCampos`: o `fieldset` com a legenda da grandeza (e a unidade) e um campo por linha, com o rótulo visível à esquerda (*De*, *Até*); as pontas amarradas no seletor; o erro abaixo do campo do lado; cabe no popover | dois campos lado a lado com *e* no meio, `fieldset` sem `min-w-0`, `aria-label` no lugar do rótulo visível, intervalo montado à mão |
  | Trocar um valor na própria célula | `EscolhaNaCelula`: a leitura no peso dela e o chevron de 14px sempre à vista; o menu (a escolha é a ação) ou o popover com o formulário (*Salvar* e Enter gravam, *Cancelar* fecha; o que impede salvar fica escrito no formulário, ligado ao *Salvar*); sem valor, a leitura vazia da peça com o chevron; gravando inerte com o valor novo na hora, a recusa desfaz e diz *Não mudou*; quem não pode trocar vê só a leitura | `Select` com contorno na célula, controle que só aparece no hover, gatilho que esconde o valor, chevron sozinho na célula vazia, *Salvar* que fecha o que o formulário recusou |
  | Coluna que rola | `RolagemDoPainel`, numa das densidades da LAY-06 | `ScrollArea`, `overflow-y-auto` com respiro à mão |
  | O topo da tela dentro do casco | `PaginaDoApp` + `TopoDaPagina` (o único que escreve o `h1`; os valores que classificam o objeto no slot `valores`, CASCO-04) | `h1` e linha de ações à mão em cada tela, `Badge` no `estado` ou ao lado do título |
  | A marca no casco e na Entrada | `Logotipo` | imagem ou texto da marca à mão |
  | Conta e tema | `MenuDaConta`, `MenuDoTema` (no pé da barra lateral) | conta ou tema no cabeçalho, `Select` de tema |
  | De quem é o menu, quando o gatilho só tem ícone | `TopoDoMenu`, primeiro filho do menu | repetir o que o gatilho já mostra; rótulo de menu em caixa alta |
  | A IA trabalhando com a conversa fechada | o contorno que corre a borda do botão de IA (`ContornoDaIa`; anel inteiro parado com movimento reduzido) e um `role="status"` escondido que diz começo e fim | ponto ou play ao lado da escrita |
  | Pares rótulo/valor | `Ficha`, `ParDaFicha` | tabela de duas colunas |
  | Número contra teto | `Medidor` (o número em `t-medida` primeiro, a barra neutra depois; `tom` pinta só o número; sem teto, `—` e sem barra), `Medidas` | `Progress` para cota, porcentagem sozinha, barra pintada pela voz |
  | Progresso de etapa | `Progress`, com o valor escrito (`3 de 8`) e o indicador no gradiente; `LinhaDeAndamento` para espera de uma linha só, sem etapas conhecidas | indicador girando sem texto, `Progress` sem valor escrito ou pintado pela voz |
  | Escolha com mais de dois desfechos e estado no servidor | `DialogLongo` (com `icone`) com o fato num parágrafo e a consequência de cada saída numa lista curta acima do rodapé (`Consequencias`), cada item encabeçado pelo termo do botão; as saídas lado a lado no rodapé (`AcoesDoDialogo`), o terciário como link | `useConfirm` com alternativa |
  | Troca de vista | `BarraDeModos` / `TrilhaDoSeletor` (`seletor-de-vista`; `abas` quando reparte o conjunto; o recorte que se sobrepõe é a linha abaixo) | botões `secondary`/`ghost` alternados, `Tabs`, `ToggleGroup` |
  | Recortes contados da lista (situações que se sobrepõem) | `resumo` do `TopoDaPagina` (a peça monta a `BarraDeModos` em `modos`, com `numero` e `tom`, e o clicar de novo que desliga; ARQ-05) | cartão de indicador, número grande, gráfico, total, `BarraDeModos` com recortes solta no topo ou no corpo, chip clicável à mão |
  | Escolha com imagem | `EscolhaVisual` | radio com imagem à mão |
  | Marcar itens de uma lista, ou o sim/não de um formulário que se grava com *Salvar* | `Checkbox`; com o texto ao lado, `OpcaoDeMarcar`; na lista, a primeira coluna, com *Marcar todos* indeterminado no cabeçalho | caixa à mão, botão que alterna com ✓, `Select` sim/não |
  | Escolher um valor de uma lista num formulário (vale com *Salvar*) | `Select` | `Command` (a escolha com busca ainda não tem regra) |
  | Ajuda curta | `Ajuda` (tooltip) no controle; `AjudaNoTexto` no texto que explica | `title` nativo para coisa importante |
  | Ajuda que não gera decisão | `DicaDeAjuda` (abre no foco e no toque) | texto escondido em hover, `HoverCard` |
  | Motivo do desabilitado | `ComMotivo` | `title` nativo, botão que some (salvo o gesto recusado pelo estado, PESO-03) |
  | Barra de topo do Editor | `BarraDoEditor`, `GrupoDaBarra`, `GrupoDaPessoa` | linha com `flex-wrap`, barra de duas linhas |
  | Colunas do Editor | `ColunasDoEditor`, `ItemDaEstrutura`, `ItemDoTrilho` (a regra dos 60% medida pela peça) | larguras escritas na tela, estrutura e inspector abertos abaixo do piso |
  | Primário com alternativas | `BotaoDividido` | dois botões soltos, menu sem o primário |
  | Menu de ações | `Menu`, `ItemDoMenu`, `SubmenuDoMenu`, `AncoraDoMenu` | `Popover` com linhas à mão |
  | Trocar de contexto num gesto (o tema, a versão) | `GrupoDeEscolhaDoMenu`: a escolha JÁ é a ação | `Select`, que só vale com *Salvar* |
  | A tela inteira mente se a pessoa não souber (versão, escopo, prévia, conexão) | `Faixa`, uma por tela: uma linha por assunto, na ordem da MSG-06, cada uma com `tom` e a saída; no casco, entre o `TopoDaPagina` e a região que rola; no Editor, entre a `BarraDoEditor` e as colunas | faixas empilhadas, parágrafo vermelho solto, aviso com X, faixa dentro da região que rola ou sobre o canvas |
  | Ícone de IA | `IconeDaIa`; em botão com cor, `IconeDaIa sobrePreenchido` (branco, sem disco) | ícone cru, disco atrás do ícone, `✦` escrito |
  | Instrução numerada | `Passos` / `Passo`, com a falha dentro do passo | `ol` à mão |
  | Detalhe sob demanda | `Popover`, numa das três larguras (`largura`: padrão, larga, a do conteúdo) | faixa permanente, `HoverCard`, largura à mão no conteúdo (`className="w-…"`), conteúdo mais largo que o popover (ele corta, sem rolagem lateral) |
  | Coluna lateral sob demanda (consultar ao lado do trabalho) | `DialogLateral`; clicar fora não fecha, salvo com `fechaAoClicarFora` (o que abre a coluna, menu, outro diálogo e o rascunho digitado nela a seguram) | painel `fixed` à mão, `Sheet` (o trabalho que pede janela é `DialogLongo`), fechar ao clicar fora à mão |
  | Conteúdo alto em janela | `DialogLongo`; tela cheia é `DialogLongo` com `tamanho="tela"` | imagem com teto de altura; camada `fixed inset-0` à mão |
  | Confirmação | `useConfirm` (`confirm-dialog`); com `onConfirmar`, a ação roda com o diálogo aberto e a falha aparece nele | `window.confirm`, rodar a ação depois de fechar sem dizer a falha, segundo diálogo para o erro |
  | Bloquear a tela até uma condição de fora | `DialogLongo` com `bloqueia` (exige o rodapé com a saída) | faixa, cartão no lugar do conteúdo |
  | Rota sem o que mostrar (erro, não encontrado, sem permissão) | `TelaDeErro` (`error.tsx`, `not-found.tsx`), com a saída de quem chama | cartão tracejado |
  | Uma região que falhou, com a tela de pé | `TelaDeErro escala="bloco"` dentro do bloco: sem título nem saída, *Tentar de novo* em `outline sm` | cartão tracejado (tracejada é ausência), a tela de erro de rota no meio da tela |
  | Desfecho depois que o bloco sumiu | `useToast` | toast para erro de formulário |
  | Carregando | `Skeleton` (lugar), na espera da vista aberta (`EsperaDaLista`, `EsperaDosGrupos`, `EsperaDoQuadro`, ARQ-01); `CarregandoPorCima` (troca de contexto: cobre a região que mente, nunca o casco) | indicador solto, véu `fixed inset-0` à mão, esqueleto de outra vista, degrau ou recuo de esqueleto à mão |
- **Por quê.** Uma função com duas peças é a origem de toda deriva visual medida no produto de origem.
- **Confere.** `crítica:consistência` · `guarda:componente-que-ninguem-monta` · `guarda:o-irreversivel-pede-confirmacao`.

### PECA-02 · De onde a peça nova parte
- **Regra.** Peça nova parte do componente equivalente do **shadcn oficial** quando existe (menu ← `DropdownMenu`, botão dividido ← `ButtonGroup`, faixa ← `Alert`, colunas ← `Resizable`; as colunas do Editor são a exceção: `ColunasDoEditor` mede a regra da ARQ-03 e não se redimensiona à mão até um projeto pedir), adaptada aos tokens e à escala da DESIGN e à forma do kit (nome em português, `tom`, motivo no desabilitado). Entra pelo **registro do sistema**; o projeto a instala com `shadcn add @wicomm/<peça>` (o prefixo é o do tema). As peças que o kit já tem não são trocadas pelas do catálogo oficial: já são shadcn por baixo e estão ajustadas à escala. Catálogo de terceiros serve só de referência visual: não se copia nem se instala. O crítico julga a peça antes de ela chegar a uma tela.
- **Por quê.** O shadcn já resolveu acessibilidade e comportamento; o que é do sistema é a forma. Peça de catálogo de terceiros traz outra marca, outra fonte e padrão de landing page.
- **Confere.** Revisão de arquitetura · `crítica:consistência`.

### PECA-03 · O gráfico desenha a forma que o dado tem
- **Regra.** O gráfico entra só quando responde uma pergunta que o número escrito não responde (comparar muitas partes de um todo, ver uma tendência) e quando o dado tem a forma que o desenho afirma. Contagens que se sobrepõem não viram pizza nem barra empilhada: as partes não somam o todo. Tendência só se desenha com o histórico gravado; a série não se reconstrói para trás a partir do estado de hoje. Número contra teto é o `Medidor`. O kit ainda não tem peça de gráfico: o primeiro entra pelo registro (PECA-02), julgado por esta regra.
- **Por quê.** A pizza de partes sobrepostas passa de 100% ou esconde a sobreposição, e a curva reconstruída inventa o passado. Os dois desenhos parecem dado e não são.
- **Confere.** Revisão de arquitetura · `crítica:aderência`.

---

<a id="peso"></a>
## 6. Peso e hierarquia

### PESO-01 · Um primário por tela, e por bloco
- **Regra.** Um primário por tela e um por bloco. A ação que fecha o trabalho de outra região (a conversa) tem o primário dela **dentro** dela, não na barra.
- **Por quê.** Dois primários dividem o olho e nenhum vence.
- **Confere.** `crítica:ação primária`.

### PESO-02 · O peso cresce com a gravidade
- **Regra.** Preenchido conclui; `secondary`/`outline` acompanha; `ghost` não grava; destrutivo é contorno (DESIGN, MARCA-05). O destrutivo não fica ao lado do primário na mesma linha: vai ao menu do objeto de que fala e pede confirmação. O gesto que só **abre** a confirmação destrutiva pode ser `ghost`; quem grava é o botão da confirmação.
- **Por quê.** Destrutivo ao lado do primário disputa o olho e o clique.
- **Confere.** `guarda:o-irreversivel-pede-confirmacao` · `crítica:ação primária`.

### PESO-03 · Gesto recusado não é desenhado; bloqueado à vista é linha com motivo
- **Regra.** O gesto que o servidor **recusa pelo estado do objeto** não é desenhado — nem apagado, nem como linha com o motivo: aparece só o que a função que decide o gesto libera. Fora disso, o gesto bloqueado que fica à vista é **linha com o motivo** (`ComMotivo`), nunca botão grande desabilitado.
- **Por quê.** Oito gestos com sete recusados eram sete controles mortos empurrando para baixo o que funciona; a lista de motivos que veio no lugar o dono do produto recusou ("só aparecer os botões do que dá pra fazer"). Os documentos de origem disseram o contrário por semanas e induziram uma revisão ao erro.
- **Confere.** `crítica:clareza da ação`.

### PESO-04 · Largura é peso
- **Regra.** Coluna que não é a tarefa da tela não passa de **25%** da largura em 1280px.
- **Por quê.** A largura diz ao olho o que importa antes de qualquer leitura.
- **Confere.** `crítica:hierarquia`.

### PESO-05 · Gesto que não grava não disputa o gesto que grava
- **Regra.** Em superfície de **conferência**, a imagem abre inteira — sem teto de altura, sem pan, sem zoom — e quem rola é a página (dentro do casco, a região do arquétipo — LAY-01). Arrastar fica só na **edição**, onde grava valor. Onde a tela empilha outros assuntos, a conferência pode morar numa janela (`DialogLongo`) aberta pela miniatura.
- **Por quê.** Com os dois gestos no mesmo pixel, quem é expulso para outra superfície é o que grava; e teto de altura deixou ~91% de uma imagem alcançável só arrastando.
- **Confere.** `crítica:clareza da ação` · guarda por projeto quando houver componente de conferência.

---

<a id="estados"></a>
## 7. Os estados que toda região declara

### EST-01 · Sete estados por região
- **Regra.** A revisão de arquitetura diz o que **cada região** mostra em cada um: **carregando · vazio · andando · erro · recusa · sucesso · sem permissão**.
- **Por quê.** O estado não desenhado é o que aparece em produção como tela em branco ou spinner eterno.
- **Confere.** Revisão de arquitetura (seção de estados) · `crítica:aderência` · `guarda:a-espera-nao-e-texto-solto` (a espera de imagem tem caixa, não texto solto).

### EST-02 · Vazio diz a causa
- **Regra.** Célula ou região vazia diz **por quê**: *não se aplica*, *não informado*, *não carregou* são três coisas com donos diferentes. Conjunto vazio nunca vira ✓.
- **Por quê.** Um ✓ sobre nada afirma uma conferência que não aconteceu.
- **Confere.** `crítica:aderência`.

### EST-03 · Ação assíncrona tem estado visível
- **Regra.** Todo botão que dispara trabalho mostra: (1) que disparou — vira "rodando", sem clique duplo; (2) sobre **o quê** — os itens marcados na própria lista; (3) o desfecho **sempre**, inclusive "nada mudou" e a falha real; (4) a rodada sobrevive ao F5 (estado no servidor, não em variável de módulo), e rodada cujo processo morreu vira desfecho, não espera eterna.
- **Por quê.** Silêncio depois do clique é lido como "não funcionou", e a pessoa clica de novo.
- **Confere.** `crítica:aderência` · guarda por projeto (quem dispara observa).

### EST-04 · Todos os contadores, e o zero é número
- **Regra.** Uma fileira de contadores mostra **todos** os da fonte, inclusive os zerados. O zero é sempre o número `0`: quando ele não informa nada, sai em `neutro` e o **rótulo** muda para a frase que diz o que o zero quer dizer. O não contado é `‒` (o travessão numérico, da largura de um algarismo), também em `neutro`. O tom é do número que pede ação.
- **Por quê.** Mostrar só os diferentes de zero faz a linha mentir por omissão.
- **Confere.** `crítica:aderência`.

### EST-05 · Nenhuma porcentagem única para números com donos diferentes
- **Regra.** Números que pertencem a pessoas ou causas diferentes não se resumem numa porcentagem só; cada um aparece com o seu dono.
- **Por quê.** A porcentagem única esconde de quem é a próxima ação.
- **Confere.** `crítica:hierarquia`.

### EST-06 · A vista que deixa itens de fora diz quantos
- **Regra.** Quando a vista escolhida não consegue desenhar parte do conjunto que os filtros e o recorte mostram (o calendário, os itens sem data; o mapa, os sem endereço), a tela diz **quantos ficaram de fora** numa linha da `Faixa` (assunto `escopo`, `neutro`, MSG-01), com a saída para a vista que mostra todos **sem desfazer o recorte nem os filtros** (MSG-06). Com zero de fora, a linha não existe. A paginação, que já diz a parte, não conta.
- **Por quê.** A vista que omite em silêncio mente como o contador que some no zero (EST-04): o topo diz 7, o calendário mostra 4, e a pessoa conclui que os outros 3 não existem. Na vista que mostra todos, o vazio dos sem data diz a causa (EST-02).
- **Confere.** `crítica:aderência`.

---

<a id="movimento"></a>
## 8. O que se move

### MOVA-01 · O que entra se move, e onde
- **Regra.** Coluna lateral desliza com `duration-painel`; popover e menu abrem com `duration-menu-abre ease-abre`; dobra com `duration-dobra-abre`; diálogo com `duration-modal-abre`. Mudança de estado só troca a cor. O canvas não anima ao trocar de item: rola até ele. Tudo com o escape de movimento reduzido (DESIGN, MOV-02).
- **Por quê.** Cada região tem um movimento só, e a pessoa aprende o que cada movimento quer dizer.
- **Confere.** `guarda:o-movimento-tem-escape` · `crítica:ruído`.

---

## Índice das regras

| Código | Regra | Confere |
|---|---|---|
| PRIN-01 | Uma tela, uma tarefa | crítica |
| PRIN-02 | O canvas é sagrado | crítica |
| PRIN-03 | Avançado não é ausente | crítica |
| PRIN-04 | Dado sem ação é ruído | crítica, revisão |
| PRIN-05 | Componente antes de layout | guarda, crítica |
| PRIN-06 | Token ou não existe | guarda |
| CASCO-01 | Regiões do casco | registro, guarda, crítica |
| CASCO-02 | Um menu só, o do kit | guarda |
| CASCO-03 | Tela de detalhe tem trilha | guarda |
| CASCO-04 | Estado no título, valor embaixo | registro, crítica |
| ARQ-01 | Cinco arquétipos | revisão, auditoria, crítica |
| ARQ-02 | Análise é Lista com medidores | crítica |
| ARQ-03 | O Editor, região por região | registro, crítica |
| ARQ-04 | Linha que se reordena | crítica |
| ARQ-05 | Recortes contados no topo da Lista | registro, crítica |
| MSG-01 | A matriz das mensagens | crítica |
| MSG-02 | No máximo uma faixa | crítica |
| MSG-03 | O técnico não chega a quem usa | crítica |
| MSG-04 | Erro no bloco que disparou | guarda |
| MSG-05 | Texto de interface não cita documento | guarda |
| MSG-06 | A mensagem traz a saída | crítica |
| MSG-07 | O botão diz o que acontece | crítica, skill |
| MSG-08 | A confirmação pergunta a ação | crítica, skill |
| MSG-09 | O erro diz o que fazer agora | crítica, skill |
| PECA-01 | A peça de cada função | crítica, guarda |
| PECA-02 | De onde a peça nova parte | revisão, crítica |
| PECA-03 | O gráfico tem a forma do dado | revisão, crítica |
| PESO-01 | Um primário | crítica |
| PESO-02 | O peso cresce com a gravidade | guarda, crítica |
| PESO-03 | Recusado não aparece; bloqueado é linha | crítica |
| PESO-04 | Largura é peso | crítica |
| PESO-05 | Gesto que não grava não disputa | crítica |
| EST-01 | Sete estados por região | revisão, crítica, guarda |
| EST-02 | Vazio diz a causa | crítica |
| EST-03 | Ação assíncrona visível | crítica, guarda |
| EST-04 | Todos os contadores, zero é número | crítica |
| EST-05 | Sem porcentagem única | crítica |
| EST-06 | A vista diz quantos deixou de fora | crítica |
| MOVA-01 | O que entra se move | guarda, crítica |
