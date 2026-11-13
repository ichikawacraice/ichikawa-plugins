---
name: textos-de-interface
description: Escreve ou revisa, em PT-BR, o texto de interface de um app React da Wicomm — rótulo de botão e de menu, título e corpo de diálogo de confirmação, mensagem de erro, vazio, espera, desfecho, dica, faixa, rótulo de campo — pelas regras de como o texto se escreve na base (MSG-07 a MSG-09, MSG-03, EST-02, CTRL-07, CONV-11, CONV-12). Use quando pedirem "o que este botão deve dizer?", "escreve a mensagem de erro", "revisa os textos desta tela", "texto do vazio", "copy da confirmação", "microcopy", "UX writing", ou ao nomear uma ação nova. Use esta, não `design:ux-copy`: esta segue o glossário do projeto e a matriz de mensagens Wicomm. Não traduz para outra língua.
---

> **O arquivo do projeto** é o `design/design-system.json`; no projeto que já tem o `design/wicomm.json` (o nome antigo) e não o novo, é o `design/wicomm.json`. Abaixo, `design/design-system.json` quer dizer esse arquivo: leia e grave nele, e nunca crie o outro nome ao lado (`node "${CLAUDE_PLUGIN_ROOT}/scripts/estado.mjs" <raiz>` diz qual vale).

# Textos de interface

Escreve ou revisa o texto que aparece na tela, nas palavras de quem usa. A régua é a base (`${CLAUDE_PLUGIN_ROOT}/base/`; com `fontes` no `design/design-system.json`, as cópias do projeto vencem; no projeto sem esse arquivo, a base é referência citada, e a norma é a do projeto): **como** o texto se escreve são as regras abaixo; **onde** a mensagem mora (MSG-01) já vem decidido pela revisão do `designer` — a linha *Mora em* só o repete. Se a pergunta é onde pôr a mensagem, é com o `designer`, não com esta skill. Todo achado ou proposta cita a regra pelo código.

## Antes de escrever

- **O glossário da tela** (CONV-12): o par *palavra da tela × nome no código* no `CLAUDE.md` ou `PRODUCT.md` do projeto. A palavra da tela vence; o nome do banco (`item_id`), a rota e o tipo nunca aparecem (CONV-11). Sem glossário, use a palavra que a tela já usa para a mesma coisa e diga que assumiu.
- **Quem lê** (MSG-03): quem usa o app nunca vê fila, processo, credencial nem erro técnico cru; vê o que pode fazer.
- **A densidade** (DENS-01, DENS-02): no instrumento, o rótulo curto de quem opera o dia todo; no site, a frase de quem vem de vez em quando, sem voz de sistema nem caixa alta.

## As regras, por tipo de texto

| Texto | Regra | Como |
|---|---|---|
| Botão, item de menu | MSG-07 · CTRL-07 | o que faz algo: verbo no infinitivo + objeto quando o verbo não basta (*Salvar alterações*); nunca *OK*, *Sim*, *Enviar*, *Confirmar* sozinhos; o que leva a um lugar ou escolhe uma opção: o nome dele (*Minha conta*, *Escuro*); sem reticências, nem no andamento (*Publicando*) |
| Diálogo de confirmação | MSG-08 · MSG-07 | título = a ação como pergunta, com objeto e quantidade (*Excluir 3 arquivos?*); corpo = a consequência que não se vê, numa frase, ou nada; o confirmar repete o verbo (`confirmar` no `useConfirm`); *Cancelar* só fecha |
| Erro | MSG-09 · MSG-04 · MSG-03 | o que não aconteceu + o que fazer agora; no bloco que disparou; sem *Erro:*, sem código, sem culpar quem usa |
| Pedido de ação (faixa, recusa) | MSG-06 · MSG-02 | a saída vem junto e chama a mesma ação do menu; uma faixa por tela |
| Vazio | EST-02 | a causa (*nada ainda*, *o filtro esconde tudo*, *não se aplica*, *não informado*) e a saída quando há |
| Espera, andamento | COR-04 · CTRL-07 | a palavra no gerúndio, sem matiz e sem reticências (*Gerando*); com etapas, o número (*3 de 8*) |
| Desfecho | MSG-01 · ACES-05 | no bloco, até a próxima ação; toast só quando o bloco sumiu |
| Dica, ajuda | MSG-01 | ajuda que gera decisão fica à vista no campo; a que não gera vai no ⓘ (`DicaDeAjuda`); nunca o óbvio |
| Rótulo de campo | ACES-02 · TIPO-02 | `<label>` sempre; placeholder é exemplo, não rótulo |
| Qualquer texto | MSG-05 · CONV-11 | não cita documento, código de regra nem identificador interno |

**O tom acompanha o desfecho:** sucesso diz o que ficou feito, sem festa (*Página publicada*); erro é calmo e diz a saída; aviso diz o risco e o gesto; o neutro informa e para.

## Escrever

```markdown
## Texto — <tela · elemento>
**Mora em:** <lugar da matriz MSG-01> · **Peça:** <peça do kit>

**Proposta:** <o texto>

| Opção | Texto | Quando serve |
|---|---|---|
| A | … | … |
| B | … | … |

**Por quê:** <a regra (código) e quem lê>
**Glossário:** <palavras que vieram do glossário, ou "assumido: <palavra>">
```

Duas opções no máximo, só quando há escolha real (o tom, o comprimento para caber). Medida de caber: o texto cabe na largura da peça na largura de referência; se não cabe, encurte o objeto, nunca o verbo.

## Revisar

Liste o texto de cada tela (busque as strings no JSX e nas chamadas de `useToast`, `pedir(` e `Faixa`) e devolva só o que fere regra:

```markdown
# Textos — <tela> (AAAA-MM-DD)
| # | Onde | Hoje | Regra | Proposta |
|---|---|---|---|---|
| 1 | `web/app/pedidos/excluir.tsx:18` | "Tem certeza?" / OK | MSG-08 · MSG-07 | "Excluir o pedido 1042?" / Excluir pedido |
```

Busca de partida (abra cada ocorrência antes de chamá-la de achado): `>OK<`, `"Confirmar"`, `pedir(` sem `confirmar`, *Tem certeza*, *Ocorreu um erro*, *Erro:*, `…` e `...` em rótulo, `error.message` repassado à tela.

Fora daqui: tradução para outra língua; texto de e-mail e de marketing; nome do produto. Termine dizendo quantos textos foram lidos e quantos ferem regra.

---
Adaptada de `ux-copy`, do plugin `design` de [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) (Apache-2.0): reescrita em PT-BR e presa à matriz de mensagens e ao glossário da base. Atribuição em [`TERCEIROS.md`](../../TERCEIROS.md).
