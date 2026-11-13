# ICH-F24 · Botão de tema claro/escuro

**Pedido:** o tema deixa de trocar sozinho (barra pela hora, ICH-F22; páginas pelo modo ausente, ICH-F21). Só um botão (sol/lua) na barra e no topo do Painel e do painel de cotas; clica, troca e fica salvo.

**Pronto quando:** nenhuma das três superfícies decide o tema por hora nem por `ausente.json`; botão com ícone nas três; escolha salva em `tema.json` e lida pelas três; sem arquivo = escuro; testes de leitura/gravação e da troca.

## Decisões
- Arquivo único `~/.claude/ichikawa/tema.json` (ou `ICHIKAWA_HOME`): `{ "tema": "claro" | "escuro", "em": ISO, "por": "barra" | "painel" | "cotas" }`. `claro` → `data-ceu="dia"`; qualquer outra coisa, sem arquivo ou ilegível → escuro (`noite`). *assumida, a confirmar*: uma escolha só para tudo; padrão escuro.
- Os tokens e os nomes `data-ceu="dia|noite"` ficam (paletas fora do escopo).
- Ícone do botão mostra **para onde vai** (sol quando está escuro, lua quando está claro), com rótulo acessível "Mudar para o tema claro/escuro". *assumida, a confirmar*.
- O botão de ausente da barra deixa o sol/lua (que agora são do tema): `◌ Ficar ausente` / `↩ Estou de volta`. *assumida, a confirmar*.
- Propagação: quem clica troca na hora; a barra relê a cada 30 s, o Painel no recarregamento de 30 s, o painel de cotas a cada 10 s (`/api/ceu`).
- Cliente comum `tema.js` na base copiada (`orquestracao/lib/publico` → `contas/.../publico`), coberto pelo teste de cópia idêntica.

## Tarefas
1. Barra: tirar `modoDaHora`/`fusoDoDate`/`lerFuso`; `lerTema`/`textoDoTema` em `logica.ts`; átomo `tema`, leitura no ciclo de 30 s, botão que grava. Testes. Risco: não.
2. Painel (`orquestracao`): `estado.lerTema/gravarTema`; `data-ceu` pelo tema; `POST /tema` (origem local); botão no topo. Testes. Risco: não.
3. Cotas (`contas`): `ceuDoTema`/`gravarTema`; `/` e `/api/ceu` pelo tema; `POST /api/tema` na guarda das ações; botão no topo. Testes. Risco: não.
4. Base: `tema.js` + estilo do botão em `estilo.css`, copiados para o painel de cotas. `docs/contratos.md`: contrato do `tema.json` e o layout sem ausente.
