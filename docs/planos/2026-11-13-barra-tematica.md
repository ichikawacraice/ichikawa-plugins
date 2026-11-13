# ICH-F15 · Barra de utilitários temática

Pronto quando: a barra tem fundo escuro, estrelas e uma cintilação leve (no máximo um quadro por segundo, parada quando o ambiente pede menos movimento); os botões seguem legíveis e funcionando. Risco: não (só desenho; comportamento dos botões fora do escopo).

## Medido antes (tipos do engine 2.1.321 e kit de testes)

- `Box.backgroundColor` e `Text.color` aceitam hex cru (`Color = ThemeKey | string`).
- `Box position="absolute"` pinta atrás dos irmãos seguintes sem mexer no layout.
- Desktop/mobile/vscode têm `Svg` (desenhado como imagem: CSS e SMIL animam); o terminal não.
- `Button` não tem `color`: no desktop o botão é nativo; no terminal o rótulo vai num `Text` colorido.
- Não há API de "reduzir movimento": no desktop vale a media query do SVG; no terminal, `BARRA_SEM_ANIMACAO` e `defaults read com.apple.Accessibility ReduceMotionEnabled`.
- A tabela do terminal responde `'Svg' in tabela` com um marcador vazio: a escolha é por `e.surface`.

## Tarefas

1. `hooks/ceu.ts` puro: linha de estrelas por quadro, SVG do céu, leitura de "menos movimento" — testes em `tests/ceu.test.ts`. Risco: não.
2. `register.tsx`: fundo, céu absoluto atrás dos botões, átomo `fase` avançado pelo tique de 1 s existente (só o terminal lê). Risco: não.
3. Testes de desenho nas duas superfícies e de parada por menos movimento. Risco: não.

## Fora

- Fundo da janela inteira (`Backdrop`/`$.theme.set`): mudaria o app todo, não a barra.
- `Client` (módulo web próprio no desktop): mais pesado que o SVG para o mesmo efeito.
