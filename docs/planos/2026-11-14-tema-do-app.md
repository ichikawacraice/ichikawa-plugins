# ICH-F31 — tema do app na barra

**Pedido (14/11, operador).** O tema do app que nasceu como mod de teste (`ceu-estrelado`) passa a vir com o kit, ligado por padrão no escuro: o céu da página atrás da conversa (noite: via láctea, galáxias, estrelas que piscam como as da barra, cadentes sorteadas e o planeta; dia: céu azul, nuvens pequenas e o sol), a paleta do app puxada para cada céu, e um botão na barra, à esquerda, oposto ao de claro/escuro, para ligar e desligar o tema. O primary do Painel e do painel de contas no claro vira o azul bebê sólido (opção A).

## Desenho

- **Mora na `barra`.** Ela já lê o `tema.json` e tem o botão de claro/escuro; um plugin à parte duplicaria a leitura e o relógio.
- **Cenas:** `hooks/fundo-noite.ts` e `hooks/fundo-dia.ts` montam o SVG (só CSS, sem script; até 131 072 caracteres). As cadentes sorteiam ponto, ângulo, lado e ciclo a cada carga (`Math.random`); o resto do céu é fixo.
- **Paletas:** `hooks/paleta.ts` com `makeColors` (cópia sem mudança do `make-colors.js` da skill de mods do Claude Code). Noite só `dark` (quase preto com um fio de roxo); dia só `light` (quase branco com um fio de azul, texto azul-tinta `#1f3a5f`, que também é o primary do app). Papéis e git ficam os do app.
- **Liga/desliga:** `tema-do-app.json` em `ICHIKAWA_HOME` (`{ "ligado": false, "em", "por" }`); sem arquivo, ilegível ou qualquer outro valor, **ligado**. Um para a máquina, como o `tema.json`.
- **Aplicar:** a barra relê `tema.json` e `tema-do-app.json` a cada 2 s (antes, o tema era relido a cada 30 s) e chama `$.theme.set` com o look do céu, ou `$.theme.clear` quando desligado, só quando muda.
- **Botão:** à esquerda do relógio do cache, só onde o tema se desenha (desktop e mobile; no terminal, não). Rótulo do que o clique faz: `◐ Desligar tema` / `◐ Ligar tema`.
- **Páginas:** em `estilo.css` (base comum, cópia idêntica no `contas`), o primary do dia passa a `#b8dcf7` sólido, texto `#0d2443`, borda `rgba(13, 36, 67, 0.22)`, hover `#a6d2f4`.

## Tarefas

1. `logica.ts`: `lerTemaDoApp`, `textoDoTemaDoApp` (teste primeiro em `logica.test.ts`).
2. Cenas, paleta e `make-colors` na `barra/hooks`; `ceu.ts` ganha o ícone.
3. `register.tsx`: átomos `temaDoApp` e `trocandoTemaDoApp`, leitura de 2 s, aplicar/limpar o tema, botão, hook do `Backdrop` (testes em `barra.test.tsx`).
4. `estilo.css` nas duas cópias; `docs/contratos.md` com o `tema-do-app.json` e a leitura de 2 s.
5. Gate do repositório, PR para `develop`, squash, release.

## Riscos

- O Desktop "por enquanto" ignora o modo forçado (`only`): se for o caso, os painéis seguem o modo do sistema e só o fundo segue o botão. Não há como medir isso em teste; fica para o operador olhar.
- Cada sessão aberta com a barra aplica o próprio tema; todas leem o mesmo arquivo, então ficam iguais.
