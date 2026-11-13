# ICH-F7 · Entregues mais leves de ler

Pedido do operador (13/11/2026), página de perguntas, seção Entregues.

## Pronto quando

Testes em `plugins/orquestracao/tests/` cobrindo 1–3, conferido na tela, PR para `develop` mergeado.

## Tarefas

1. **Cartão abre e fecha** (`Risco: não`). Cada entrega vira `<details class="entrega">`; o `<summary>` traz projeto, id, título e desfecho; o corpo, resultado, medido, sem medir, próximos, PR e hora. Fechado por padrão. O recarregamento automático de 30 s guarda quais cartões estavam abertos (`sessionStorage`, ids `entrega-<projeto>-<id>`) e os reabre — sem isso o cartão fecharia sozinho a cada 30 s.
2. **Ver mais** (`Risco: não`). Mostra as 10 entregas mais recentes (pela data da entrega) *assumida, a confirmar*; o resto fica num `<details class="ver-mais">` com "Ver mais (N)". Dentro de cada bloco a ordem segue a de F, como hoje. Sem JS.
3. **Limpeza** (`Risco: não` — move, não apaga). Regra *assumida, a confirmar*: **o que sai da página vai para o arquivo**. Item com entrega há mais de `DIAS_DE_ENTREGAS` (30) dias e etapa final (`feito`, `parado`, `descartado`) é movido de `itens/<projeto>/F<n>.json` para `itens/<projeto>/arquivo/F<n>.json`. Nada é apagado; voltar é mover o arquivo de volta.
   - Quando roda: ao abrir a página (GET `/`), no máximo uma vez por dia por processo da página, e à mão com `perguntas arquivar`.
   - `criar` passa a contar também os números do `arquivo/`, para não reusar um F arquivado.
   - Contrato atualizado em `docs/contratos.md`.

## Medida

Hoje a máquina tem 15 itens e 11 perguntas (~100 KB): não pesa. A limpeza é para o ano que vem, não para hoje.

## Fora

Perguntas respondidas antigas também acumulam; ficam para outro item, se um dia pesarem.
