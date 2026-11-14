---
name: design-system
versao: 0.32.0
description: As convenções de engenharia do front dos apps React do sistema — o que o código faz para a direção de design e a anatomia se manterem verdadeiras.
---

# Convenções do front

> A [`DESIGN.md`](DESIGN.md) diz como a tela parece e a [`ANATOMIA.md`](ANATOMIA.md) diz o que vai onde. Este arquivo diz **como o código sustenta as duas**: Tailwind e CSS, estado de tela, formulário, texto de interface, como se escreve uma guarda e como uma tela passa pelo processo de design. Mesmo formato de regra: **Regra · Por quê · Confere** ([como ler](DESIGN.md#como-ler-uma-regra)).
>
> Estas convenções valem para todo app React do sistema (Next ou Vite) com **Tailwind v4**. O sistema é só v4: projeto em v3 migra antes de receber tokens e peças (fatia 0 do plano de padronização).

<a id="css"></a>
## 1. Tailwind e CSS

### CONV-01 · Cor de tema aceita alfa
- **Regra.** Toda cor de tema funciona com modificador de alfa (`bg-background/80`). A cor entra no `@theme inline` apontando para a var do tema (`--color-background: var(--background)`), e o v4 compõe o alfa por `color-mix`. Nunca cor de tema só no `:root`; um teste confere que a classe com alfa gera regra.
- **Por quê.** Cor fora do `@theme` não gera utilitário: `bg-background/80` não existe, o elemento fica sem fundo, e o build e o teste em jsdom passam. Sem o `inline`, a var é resolvida no `:root`, e o tema trocado num contêiner (escuro, densidade) não chega à classe.
- **Confere.** `guarda` de tema (lê o CSS e reprova cor de tema fora do `@theme inline`) · `navegador`.

### CONV-02 · A fonte do produto é a chave `sans`, e a var mora onde a regra a lê
- **Regra.** A fonte da marca substitui a família `sans` (`--font-sans` no `@theme inline`, apontando para a var da fonte) — nunca uma chave nova no `@theme` (a variável do tema, como `--font-<família>`, ali só cria o utilitário `font-<família>`); o certo é `--font-sans: var(--font-<família>)`, com a variável que o tema declara (`fonte.variavel`). A variável CSS da fonte é declarada no **`<html>`**, não no `<body>`.
- **Por quê.** Chave nova só cria um utilitário, e o preflight segue escrevendo a fonte do sistema no `<html>`. `var(--x)` ausente no elemento onde a declaração é resolvida invalida a declaração inteira, e a página vira serifada. Nenhum dos dois aparece em build ou jsdom.
- **Confere.** `guarda` de fonte · `navegador` (família computada no `<html>`).

### CONV-03 · Token de cor nunca vale `transparent`
- **Regra.** Nenhum token de tema tem valor `transparent`. Se a peça não deve ter contorno, não peça contorno.
- **Por quê.** `transparent` é válido, computa `rgba(0,0,0,0)` e ainda sobrescreve o reset de borda: o elemento fica com **menos** contorno do que sem a classe, e o token parece existir.
- **Confere.** `tokens` (nenhum valor `transparent`).

### CONV-04 · Nenhum valor solto
- **Regra.** Em código de tela: nada de `#hex`/`rgb()` literal, `text-[Npx]`, `h-[Npx]`, `rounded-[Npx]`, `duration-NNN`, `z-[N]` fora da escala. O que falta na escala entra no token, com motivo. Exceção local fica listada no projeto, com motivo, e a guarda a lê.
- **Por quê.** Valor solto não acompanha o próximo ajuste de escala nem o tema; é a deriva lenta que faz dois apps deixarem de parecer da mesma empresa.
- **Confere.** Hook de aviso do plugin (no momento da escrita) · `guarda:nenhum-valor-solto`, com catraca (no CI).

### CONV-05 · Escala tirada de largura medida lê a caixa de conteúdo
- **Regra.** Toda escala, fração ou posição tirada de um nó medido lê `clientWidth`/`clientLeft` — nunca `getBoundingClientRect()`/`offsetWidth` —, e o elemento cuja largura a escala assume declara `box-content`. Largura 0 (jsdom, antes da pintura) não vira divisor: devolve "não dá para concluir".
- **Por quê.** Com `border-box`, 1px de contorno come 2px de dentro: a escala sai 0,48% adiantada (29px no fim de uma imagem longa), e a conferência ingênua aprova o defeito, porque a caixa de borda devolve o número esperado.
- **Confere.** Revisão de código · teste com contorno.

### CONV-27 · O que se esconde por `hidden` não leva classe de display
- **Regra.** Elemento que se esconde (pelo atributo `hidden` ou pela classe) não leva utilitário de display (`flex`, `grid`, `block`, nem com prefixo de tela, `md:grid`) na mesma classe. A peça esconde um **invólucro** só com o `id` e o `hidden`, e a classe de quem chama vai num elemento de dentro. O teste passa um `className` com display responsivo e afirma o invólucro escondido (`toHaveClass("hidden")` ou o atributo), porque o jsdom não aplica CSS e `toBeVisible` passa com o corpo à vista.
- **Por quê.** A classe vence o atributo: `[hidden]` é uma regra de pouco peso do navegador, e o `flex` do Tailwind a sobrescreve. O corpo fechado de um bloco recolhível seguia aberto, com o teste verde. Pôr `hidden` por último no `cn` não basta: o `tailwind-merge` só descarta o display sem prefixo, e o `md:grid` reabre o corpo a partir de 768px.
- **Confere.** Revisão de código · teste da peça que recolhe.

<a id="estado"></a>
## 2. Estado de tela

### CONV-06 · Estado de vista vive no URL e não pede nada ao servidor
- **Regra.** O que só governa o desenho — item selecionado, aba aberta, coluna expandida — vive no URL para sobreviver ao F5, mas é escrito com `history.replaceState(null, '', url)` por uma função única do projeto, nunca por uma navegação que re-renderiza no servidor (`router.replace` no Next). Navegação de verdade continua sendo `router.push`.
- **Por quê.** Medido: um clique para mudar a linha destacada custava 1,6 s e baixava 954 KB que o navegador já tinha. O defeito compila, funciona e só demora — por isso só uma varredura o pega. O estado passado tem de ser `null`: com o `history.state` atual, o Next devolve a chamada ao método original.
- **Confere.** `guarda:estado-de-vista-nao-vai-ao-servidor` (projetos Next).

### CONV-07 · Ação assíncrona tem estado visível e sobrevive ao F5
- **Regra.** Ver ANATOMIA, EST-03. No código: o estado da rodada mora no servidor (banco ou arquivo), nunca em variável de módulo; a tela observa **a ação** (id e estado próprios), nunca um efeito colateral dela; revalida no `visibilitychange`; quem enfileira trabalho observa o que enfileirou.
- **Por quê.** Variável de módulo evapora no recompile; observar efeito colateral deixa a tela girando quando a ação falhou sem efeito.
- **Confere.** `guarda` por projeto (quem dispara observa).

### CONV-08 · O efeito entra na hora, e a recusa desfaz
- **Regra.** Gesto que grava pode mostrar o efeito na hora (otimista); se o servidor recusa, a tela **desfaz** e diz o motivo no bloco do gesto. Efeito otimista sem caminho de recusa é defeito.
- **Por quê.** O efeito que fica na tela depois da recusa afirma um estado que o banco não tem.
- **Confere.** Auditoria de clique · revisão de código.

### CONV-26 · O filtro da Lista lembrado no navegador volta como a pessoa deixou
- **Regra.** A Lista pode lembrar no navegador o recorte que a pessoa escolheu, e então: (1) a chave tem versão e dono: a tela, o registro pai quando há (o id dele, nunca token, sessão ou e-mail) e quem vê, porque o mesmo navegador abre como perfis diferentes; sem como dizer quem vê, não grava; (2) grava só no gesto da pessoa (mudar um filtro, o chip que filtra, *Limpar filtros*); ler o gravado não grava, e o recorte igual ao padrão apaga a chave; (3) grava só o recorte durável (estado, prioridade, lugar, responsável); busca de texto e data fixa nunca; (4) ao ler, confere campo a campo: o inválido volta ao padrão e os outros ficam, o gravado ilegível é apagado, e o valor que não teria gatilho à vista (opção que saiu, filtro que este perfil não vê) é descartado; (5) a volta não se anuncia, sem faixa nem toast: cada gatilho mostra o próprio valor, *Limpar filtros* aparece com o recorte fora do padrão e apaga a chave, e o vazio por filtro (EST-02) traz a mesma saída (MSG-06); (6) sem armazenamento (aba privada, cota cheia), o filtro vale só na memória, sem aviso (MSG-03); (7) enquanto não leu, a região está em *carregando*: a lista nunca aparece sem filtro para ser filtrada logo depois; a leitura é depois da hidratação (LAY-01); (8) o filtro no URL (CONV-06) vence o lembrado: a tela abre no padrão mais o do URL, sem ler nem gravar a chave, e só o gesto seguinte grava o recorte que a pessoa vê; não há sincronia entre abas.
- **Por quê.** Quem volta à fila refaz o mesmo recorte várias vezes por dia, e lembrar o recorte tira esse trabalho. Mas o que se lembra errado custa mais que o que se esquece: a data de ontem escondendo a lista de hoje parece tela travada, o filtro sem gatilho esconde itens sem dizer por quê, e o perfil que herda o recorte de outro vê uma fila que não é a dele.
- **Confere.** Testes do `filtro-lembrado` no registro (os casos de borda) · revisão de código (grava só no gesto; nada fora do esquema) · `navegador` (F5 com filtro; aba privada; dois perfis no mesmo navegador).

<a id="formulario"></a>
## 3. Formulário

### CONV-09 · O erro de submissão alcança os olhos
- **Regra.** Falha de validação é desfecho e aparece no ponto do clique: o botão entra em trabalho e volta **junto com** um resumo no bloco dele que diz **quantos** campos pedem conserto (nunca "erro ao salvar") e leva ao primeiro — `.focus()` e depois `scrollIntoView` no primeiro inválido **na ordem do DOM**. Todo campo tem `id` e todo `<label>` o `htmlFor`; campo reprovado declara `aria-invalid` e aponta a mensagem por `aria-describedby`. Campo de lista leva o índice no id, derivado do caminho do erro (`campo-itens-2-nome`).
- **Por quê.** Uma chave de erro sem nenhum JSX que a lesse deu clique com zero efeito na tela; num formulário de mil linhas não havia um `id`. Toast foi recusado: diz que falhou e não diz onde.
- **Confere.** `guarda:o-erro-de-submissao-alcanca-os-olhos` cobre a chave de erro com quem a renderize e o desfecho que não sai em cinza; `id`, `htmlFor`, `aria-invalid` e o foco no primeiro inválido ficam com revisão e `navegador` até a guarda própria (fatia de guardas).

### CONV-10 · Confirmação e dica nunca nativas
- **Regra.** Nada de `window.confirm` (usa `useConfirm`) nem de `title` nativo para coisa importante (usa `Ajuda`, `DicaDeAjuda` ou `ComMotivo`).
- **Por quê.** O nativo não segue tema, foco nem toque, e o `title` não aparece no teclado nem no celular.
- **Confere.** `guarda:o-irreversivel-pede-confirmacao` · `guarda:confirmacao-e-dica-nunca-nativas`.

<a id="texto"></a>
## 4. Texto de interface

### CONV-11 · Texto de interface não cita documento nem identificador interno
- **Regra.** Ver ANATOMIA, MSG-05. Vale também para log, detalhe de estado e erro que nascem no servidor e chegam à tela. Nome de campo do banco (`item_id`) também não é texto de interface.
- **Por quê.** Guarda de marcação prova que o texto não cita documento; não prova que ele é legível — e o verde não deve ser lido como se provasse.
- **Confere.** `guarda:o-texto-da-tela-nao-cita-documento` · revisão de texto.

### CONV-12 · O glossário da tela pode não ser o do código, e o descasamento é declarado
- **Regra.** Quando a palavra que a pessoa vê difere do nome no código (tabela, rota, tipo), o projeto escreve o par no seu `CLAUDE.md` ou `PRODUCT.md`. Texto de interface usa o glossário da tela; código, o do banco.
- **Por quê.** Sem o par escrito, a palavra do código vaza para a tela (e vice-versa) a cada tela nova.
- **Confere.** Revisão de texto.

### CONV-13 · Agente não propõe ação que a tela não tem
- **Regra.** Todo texto gerado por IA que recomenda algo a quem usa o app enumera as ações que existem de verdade na tela e proíbe o resto. Mudou o que a tela faz, o prompt muda junto.
- **Por quê.** A IA que sugere um botão que não existe ensina a pessoa a desconfiar da tela.
- **Confere.** Revisão do prompt junto com a tela.

<a id="guardas"></a>
## 5. Como se escreve uma guarda

As guardas do pacote (`@wicomm/guardas`) e as de cada projeto seguem estas regras. Elas valem para qualquer teste que afirma uma regra de design.

### CONV-14 · Guarda prova que achou o que examinar
- **Regra.** Todo teste que inspeciona um valor ou uma lista de arquivos afirma antes que o insumo **existe e não é vazio** — e o piso fica perto do total real medido, não em "maior que zero".
- **Por quê.** O vazio não reprova, atravessa: `[].filter(ruim)` devolve `[]`, que é o que o teste espera. Uma guarda dizia examinar âncoras e examinava 59 de 464.
- **Confere.** Revisão das guardas (toda guarda do pacote tem o caso "o insumo não é vazio").

### CONV-15 · Duas coisas que precisam concordar têm algo que force
- **Regra.** Quando a mesma verdade está em dois lugares (lista de telas × telas com trilha, registro × ateliê, tokens × CSS gerado), ou uma **deriva** da outra, ou um teste lê as duas dos arquivos de verdade e reprova a divergência. Combinar de "manter em dia" não é mecanismo.
- **Por quê.** Acrescentar na segunda lista não é necessário para compilar nem para passar no teste — só para funcionar. O catálogo que existe para conferir o que jsdom não vê é ele próprio uma lista gêmea, e a mais traiçoeira: a ausência parece catálogo completo.
- **Confere.** Revisão das guardas.

### CONV-16 · Guarda prova que morde
- **Regra.** Guarda nova é provada por mutação: muta-se o valor real e vê-se vermelho **na linha certa**. Ler o alvo antes de mutar.
- **Por quê.** Verde contra um alvo que não existe é indistinguível de prova.
- **Confere.** O PR da guarda mostra a mutação e o vermelho.

### CONV-17 · Número que decide é finito e positivo
- **Regra.** Medida que decide um veredito só se aceita com `Number.isFinite(x) && x > 0` (ou o intervalo declarado).
- **Por quê.** `NaN <= 0` é falso e `Infinity > 0` é verdadeiro: guarda de polaridade única deixa passar o número que ninguém mediu.
- **Confere.** Revisão das guardas.

### CONV-18 · Contraste se mede compondo a pilha
- **Regra.** A medição de contraste no navegador compõe o fundo **real** sob o texto (pilha de hit-test, com alfa), para e declara "não medível" diante de `background-image` ou `filter`, aplica o piso certo (DESIGN, COR-12), e antes de valer prova que enxerga: um caso sabidamente ruim que tem de acusar e um bom que tem de ignorar. Antes e depois na mesma viewport.
- **Por quê.** Token computa `color(srgb …)`, não `rgb()`; o ponto do texto pode não ser do elemento; a viewport pode vir zerada. Sem a prova nos dois sentidos, "zero defeitos" é indistinguível de "não examinou".
- **Confere.** A sonda de contraste do ateliê roda os dois casos de prova antes de medir.

### CONV-24 · Teste que mede uma ausência declara essa ausência
- **Regra.** Quando o desfecho de um teste depende de algo que o git não versiona — um binário ignorado, uma CLI no PATH, uma variável do shell —, o teste declara esse algo como precondição e a **afirma antes de medir**, pelo ponto de injeção que o código já tem; a afirmação cobre o ramo, não só o desfecho.
- **Por quê.** O verde passa a significar "esta máquina" e não "este código", e a falha é assimétrica: só reprova para quem tem o arquivo a mais, e nada no relatório nomeia o que decidiu.
- **Confere.** Revisão das guardas.

<a id="processo"></a>
## 6. O processo de uma tela

### CONV-19 · Quem desenha não julga
- **Regra.** Tela nova (rota, vista, aba, painel ou diálogo que não existia), redesenho pedido ou mudança de decisão de design registrada (`DESIGN.md`, `ANATOMIA.md`, revisão aprovada) começa no agente `designer`, que escreve a **revisão de arquitetura** (tarefa, inventário com a decisão que cada dado gera, arquétipo, hierarquia, lugar de cada mensagem, peças do kit, estados, movimento, o que sai) e **não edita código de tela**. Ajuste de tela que já existe (texto, ordem, campo, estado, botão, peça nova do registro) vai sem designer, direto ao código. O `critico-de-ui` julga em contexto separado, com no máximo 5 problemas, cada um com *Onde* e *Correção*. Na tela nova, a crítica é **obrigatória** depois da revisão e de novo depois do código; no ajuste de tela que já existe, é **opcional**.
- **Por quê.** Quem desenhou defende o desenho; o julgamento precisa de outro contexto. A tela que existe já tem o desenho decidido: no ajuste, a revisão custa mais que o que ela pegaria.
- **Confere.** Lembrete do plugin no pedido de design (só lembra, não trava) · revisão do PR: tela nova sem crítica gravada na pasta de revisões volta.

### CONV-20 · A nota é a porta
- **Regra.** A crítica dá nota em seis eixos de 0 a 5 — hierarquia, densidade, consistência com o design system, ruído visual, clareza da ação primária, aderência à DESIGN e à ANATOMIA. **24/30 sem ressalva alta** libera o PR da tela; no máximo duas recríticas na tela nova e uma no ajuste. Em densidade site, entra o sétimo eixo, *cara de site*, e o teto vira 28/35 (80%).
- **Por quê.** Um número dá ao dono do produto como comparar telas e projetos; a escala fixa evita a nota que muda de régua por tela.
- **Confere.** Skill de crítica (forma da entrega) · o comando `estado` do plugin (média das últimas críticas).

### CONV-21 · O protótipo aprovado é o contrato
- **Regra.** Tela com protótipo ou revisão aprovada é implementada **como aprovada**. Mudança de desenho durante a implementação volta à revisão; não se decide no código. **Quando o protótipo aprovado muda uma peça do kit** (o relayout), ele vence a peça de hoje, e o desvio não é achado **se a mudança vai na própria peça do registro** (e, quando é regra, na base), para toda tela; a variação local, só naquela tela, continua achado. O PR do relayout lista as peças que mudaram e as telas que as consomem, para a propagação virar item.
- **Por quê.** O desenho que muda no código perde a crítica que o aprovou. E a peça corrigida só numa tela vira duas peças para a mesma função (PECA-01).
- **Confere.** A crítica pós-código compara a tela com a revisão aprovada (eixo de fidelidade ao protótipo).

### CONV-22 · Ferramenta de terceiros é auxiliar, e sem rede por padrão
- **Regra.** Detector de anti-padrões de terceiros pode rodar **localmente** como insumo do crítico. Comando que consulta rede ou manda telemetria só roda com ok explícito do projeto. Catálogo de estilo de terceiros não entra (propõe outra marca, outra fonte e padrão de landing page).
- **Por quê.** O plugin roda em repositório de cliente.
- **Confere.** Configuração do plugin.
- *Assumida, a confirmar:* só o detector local.

### CONV-23 · Conferir no ateliê antes de afirmar
- **Regra.** Todo app do sistema tem a rota `/atelie` com as peças reais, dados de exemplo, os dois temas lado a lado e `data-vitrine="<nome>"` em cada peça. Mudança de cor, tipo ou peça se confere ali antes do PR (DESIGN, MED-01). A lista de peças do kit e a do ateliê concordam por teste (CONV-15).
- **Por quê.** Os piores defeitos visuais não aparecem em build nem em jsdom.
- **Confere.** `guarda` ateliê × kit · crítica.

<a id="distribuicao"></a>
## 7. Distribuição e instalação

### CONV-25 · *Revogada na 0.16.0* — o build de produção com pacote privado `@wicomm` era feito na máquina
- **Regra.** *Revogada.* Valia: projeto que instalava os pacotes `@wicomm` privados (tokens, guardas) fazia o build de produção na máquina de quem publica (`vercel build --prod && vercel deploy --prebuilt --prod`), e a Vercel não recebia o token dos pacotes. Os pacotes passaram ao npm público: o `install` em qualquer lugar os baixa sem token, e o build de produção volta a ser o da Vercel, como o de qualquer app. O que sobra da regra vale sem ela: nenhum token de pacote (`NPM_RC`, `NPM_TOKEN`, `NODE_AUTH_TOKEN`) no repositório nem na Vercel, porque nenhum é preciso.
- **Por quê.** O motivo era o 401 do registro privado na Vercel; sem registro privado, o build na máquina só tira o deploy do push e deixa o release na mão de uma pessoa. O código não se reaproveita (a base não renumera).
- **Confere.** Nada a conferir. Projeto que ainda faz o build na máquina pode voltar ao build da Vercel (o comando `atualizar` do plugin diz como).


<a id="acessibilidade"></a>
## 8. Acessibilidade

O contraste, o anel de foco e o escape do movimento já são regra da DESIGN (COR-11, COR-12, COR-13, SUP-06, MOV-02) e se medem com o alfa composto (CONV-18). Esta seção cobre o que o código decide: teclado, nome, alvo, estrutura, anúncio, o ARIA e o campo obrigatório. A régua é o nível AA; a skill `acessibilidade` audita uma tela por estas regras e pelas da DESIGN.

### ACES-01 · Tudo o que se clica se alcança e se aciona pelo teclado
- **Regra.** Todo gesto da tela funciona só com o teclado: Tab chega a ele na ordem em que se lê a tela, Enter ou Espaço aciona, Esc fecha o que flutua e **devolve o foco** a quem o abriu. Gesto mora em `button`, `a` ou peça do kit — nunca em `div` ou `span` com `onClick`. O que flutua (diálogo, menu, gaveta) prende o foco enquanto está aberto, e nenhum outro lugar o prende. `tabIndex` positivo é defeito. Todo elemento que o Tab alcança mostra o foco: o anel da SUP-06, ou, no item de menu e de select, o fundo do item ativo. `outline-none` ou `outline-hidden` sem um dos dois é defeito; o elemento que só recebe foco por programa (`tabIndex={-1}`, o título que a navegação foca) é isento.
- **Por quê.** Quem não usa mouse — por escolha, lesão ou leitor de tela — para na primeira `div` clicável; e o foco que se perde ao fechar um diálogo devolve a pessoa ao topo da página.
- **Confere.** skill `acessibilidade` (busca por `onClick` em `div`/`span`, `tabIndex` positivo, `outline-none`/`outline-hidden` sem `focus-visible:ring`, `focus-visible:after:ring`, `focus:bg-` nem `data-[highlighted]:bg-`) · navegador (percorrer a tela só com Tab, Enter e Esc).

### ACES-02 · Todo controle tem nome, e nada se diz só com cor
- **Regra.** Botão só de ícone leva `aria-label` com o verbo (MSG-07) e a dica do kit com o mesmo texto (CTRL-09); campo tem `<label>` ligado por `htmlFor` — placeholder não é rótulo; imagem que informa tem `alt` com o que ela mostra, e a que enfeita tem `alt=""` (o ícone de enfeite, `aria-hidden`, COR-13). Estado, voz e etapa nunca dependem só da cor: o carimbo tem a palavra, o ponto da etapa tem o nome ao lado (COR-08), o campo com erro tem a frase (MSG-04).
- **Por quê.** O leitor de tela anuncia "botão" sem nome e a pessoa não sabe o que ele faz; o placeholder some ao digitar e leva o rótulo junto; quem não distingue o vermelho do verde não lê um estado que só a cor diz.
- **Confere.** skill `acessibilidade` (busca por `<img` sem `alt`, botão de ícone sem `aria-label`, campo sem `label`) · navegador (a árvore de acessibilidade).

### ACES-03 · O alvo de clique mede 24×24px, ou tem folga até o vizinho
- **Regra.** A área que recebe o clique de todo controle mede pelo menos **24×24px**. O alvo menor só passa se o círculo de 24px centrado nele não toca outro alvo nem o círculo de outro alvo menor; o texto corrido e o link dentro da frase são isentos. Ícone clicável sozinho (14 ou 16px, CTRL-09) mora no botão `icon` do kit (30px); onde a caixa não cabe, vale a folga acima, ou um pseudo-elemento (`after:absolute after:-inset-*`) que estende o clique sem mexer no desenho (o fechar do aviso, o carimbo que abre) — o que nunca vale é o clique só no próprio ícone, colado no vizinho. A barra de modos (CTRL-06) mede 24px e cumpre; a tela de Entrada usa o alvo grande (CTRL-02).
- **Por quê.** O ícone de 14px solto é o alvo que a pessoa erra no touchpad e no celular. 24px, ou a folga equivalente, é o mínimo do nível AA (WCAG 2.2, critério 2.5.8); o alvo de 44px é do nível AAA e a base só o pede na Entrada.
- **Confere.** skill `acessibilidade` (ícone com `onClick` fora do botão do kit; botão com `className` que encolhe a caixa abaixo de `size-6`; alvos pequenos lado a lado) · navegador (a caixa do alvo e a distância até o vizinho).

### ACES-04 · A página diz a língua, as regiões e os títulos
- **Regra.** `<html lang="pt-BR">`. O casco marca as regiões com o elemento delas — `nav` na barra lateral, `header` no topo, `main` na região do arquétipo (CASCO-01) —, e os títulos descem a partir do `h1` único (TIPO-04) sem pular nível.
- **Por quê.** Quem usa leitor de tela anda pelas regiões e pelos títulos, não pela rolagem; sem `lang`, a voz sintetizada lê o português com a pronúncia de outra língua.
- **Confere.** skill `acessibilidade` (busca por `lang=`, `<main`, `<nav` no casco) · `guarda:o-titulo-da-pagina-e-um-so` · navegador.

### ACES-05 · O que aparece sem mover o foco é anunciado
- **Regra.** O desfecho que surge sem a pessoa mover o foco — o texto no bloco (MSG-01), o toast, o resumo dos erros de submissão (CONV-09), o fim de uma espera (EST-03) — é anunciado. Desfecho e espera vão numa região `role="status"` que **já existe vazia** quando o texto chega (a `Faixa` e a pilha dos avisos montam a região no primeiro desenho; a linha e o cartão entram nela, e `aria-atomic="false"` anuncia só o que chegou). O erro que interrompe a tarefa vai em `role="alert"`, que pode nascer junto com o texto — e renascer, para anunciar de novo a mesma falha.
- **Por quê.** Sem o anúncio, quem não vê a tela aperta o botão e não sabe se deu certo. A região `status` criada junto com o texto não é anunciada pela maioria dos leitores de tela; o `alert` é anunciado ao entrar.
- **Confere.** skill `acessibilidade` (busca por `role="status"`, `role="alert"` e `aria-live` nas peças de desfecho, e onde a região monta) · navegador com leitor de tela.

### ACES-06 · O ARIA só completa o HTML, e nunca o contradiz
- **Regra.** O elemento nativo vem primeiro: `a href` leva a outro lugar, `button` faz algo na tela, e o ARIA só entra onde o HTML não diz o que a peça é. `aria-label` só em elemento que tem papel — controle, região (`nav`, `section` com título) ou `role` declarado; numa `div` ou `span` sem papel o leitor de tela o ignora. `aria-hidden` nunca em elemento que o Tab alcança, nem em quem o contém. `role="button"` sem Enter, Espaço e `tabIndex={0}` é defeito (mas o certo é o `button`, ACES-01). O gatilho que abre e fecha um trecho escrito à mão leva `aria-expanded` e `aria-controls` apontando o trecho, como a `Dobra` do kit.
- **Por quê.** O ARIA errado é pior que nenhum: o leitor de tela acredita nele. O elemento escondido que ainda recebe foco deixa o Tab parar num lugar mudo; o link feito de botão não abre em aba nova nem aparece na lista de links; o gatilho sem `aria-expanded` não diz se o trecho abriu.
- **Confere.** skill `acessibilidade` (busca por `aria-hidden` em `button`, `a`, `input` ou no pai deles; `aria-label` em `div`/`span` sem `role`; `role="button"`; `onClick` que navega) · navegador (a árvore de acessibilidade).

### ACES-07 · O campo obrigatório se declara no código
- **Regra.** Campo obrigatório leva `aria-required="true"`; o leitor de tela anuncia "obrigatório" antes de a pessoa errar. O `required` nativo não entra: o formulário da casa valida por conta própria (CONV-09) e leva `noValidate`, porque o balão do navegador é dica nativa (CONV-10) e corre antes do resumo de erros. O sinal visual é opcional; se houver (o asterisco), vai em `aria-hidden` e o formulário diz uma vez o que ele significa — o nome que se anuncia é o do rótulo, sem o sinal.
- **Por quê.** Sem a declaração, quem não vê a tela só descobre que o campo era obrigatório no erro; o asterisco solto é lido como "asterisco" no meio do rótulo, e o balão nativo some do tema e do teclado.
- **Confere.** skill `acessibilidade` (campo com mensagem de "obrigatório" ou asterisco no rótulo sem `aria-required`; `required` sem `noValidate` no `<form>`; asterisco sem `aria-hidden`) · navegador com leitor de tela.

---

## Índice das regras

| Código | Regra | Confere |
|---|---|---|
| CONV-01 | Cor de tema aceita alfa | guarda, navegador |
| CONV-02 | Fonte é a chave `sans`, var no `<html>` | guarda, navegador |
| CONV-03 | Token nunca `transparent` | tokens |
| CONV-04 | Nenhum valor solto | hook, guarda |
| CONV-05 | Escala lê a caixa de conteúdo | revisão |
| CONV-27 | `hidden` sem classe de display | revisão, testes |
| CONV-06 | Estado de vista no URL, sem servidor | guarda |
| CONV-07 | Ação assíncrona visível | guarda |
| CONV-08 | Efeito na hora, recusa desfaz | auditoria, revisão |
| CONV-26 | Filtro lembrado volta como a pessoa deixou | testes, revisão, navegador |
| CONV-09 | Erro de submissão alcança os olhos | guarda |
| CONV-10 | Confirmação e dica nunca nativas | guarda |
| CONV-11 | Texto não cita documento | guarda, revisão |
| CONV-12 | Glossário da tela declarado | revisão |
| CONV-13 | Agente não propõe ação inexistente | revisão |
| CONV-14 | Guarda prova que achou | revisão |
| CONV-15 | Duas coisas concordam por força | revisão |
| CONV-16 | Guarda prova que morde | PR |
| CONV-17 | Número finito e positivo | revisão |
| CONV-18 | Contraste compõe a pilha | sonda |
| CONV-24 | Teste de ausência declara a ausência | revisão |
| CONV-19 | Quem desenha não julga | lembrete, revisão do PR |
| CONV-20 | A nota é a porta | skill |
| CONV-21 | Protótipo aprovado é contrato; relayout vai na peça | crítica |
| CONV-22 | Terceiros sem rede por padrão | config |
| CONV-23 | Conferir no ateliê | guarda, crítica |
| CONV-25 | *Revogada:* build de produção na máquina | — |
| ACES-01 | Tudo se alcança e se aciona pelo teclado | skill, navegador |
| ACES-02 | Todo controle tem nome; nada só com cor | skill, navegador |
| ACES-03 | Alvo de clique de 24×24px | skill, navegador |
| ACES-04 | Língua, regiões e títulos | skill, guarda, navegador |
| ACES-05 | O que aparece sem foco é anunciado | skill, navegador |
| ACES-06 | O ARIA completa o HTML, sem contradizer | skill, navegador |
| ACES-07 | Campo obrigatório declarado no código | skill, navegador |
