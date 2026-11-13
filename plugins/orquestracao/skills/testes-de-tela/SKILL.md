---
name: testes-de-tela
description: O que testar numa tela de React e onde cada teste mora — componente (Testing Library no JSDOM) ou ponta a ponta (Playwright num navegador de verdade) —, como consultar, simular a rede, esperar sem relógio, tratar teste instável e quais comandos rodar durante o trabalho. Use ao escrever ou consertar teste de componente, hook, página ou fluxo, ao decidir se um caso vai para o componente ou para o ponta a ponta, ou quando um teste de tela falha às vezes. Não serve para teste de API ou de função pura.
---

# Testes de tela

Teste de tela confere o que a pessoa **vê e faz**, não como o componente se organiza por dentro. Monta a peça com os mesmos provedores da produção, age pelos papéis e rótulos acessíveis e afirma o que aparece na tela ou o efeito observável de fora (a chamada que saiu, o callback que disparou). Estado interno, props do filho, quantas vezes renderizou e a forma do DOM ficam de fora.

## Onde cada teste mora

O JSDOM não tem motor de layout nem de CSS. A fronteira sai daí:

| O caso | Onde |
|---|---|
| Hook, componente de apresentação, formulário com regra | **Componente** |
| Estados de uma ação assíncrona (carregando, feito, falhou) e a recusa que desfaz | **Componente**, com a rede simulada |
| Layout que importa, rolagem, arrastar e soltar, colar, animação | **Ponta a ponta** |
| iframe, janela nova, download, fluxo entre origens | **Ponta a ponta** |
| O fluxo de várias páginas que não pode quebrar (entrar, achar, gravar, ver gravado) | **Ponta a ponta**, poucos e escolhidos |
| Contraste de cor | **Ponta a ponta** ou a ferramenta de acessibilidade do projeto (o axe no JSDOM desliga essa regra) |

Um corredor de componente por projeto (vitest ou jest, o que já existe).

## Teste de componente

**Consulta, nesta ordem:** papel e nome acessível (`getByRole('button', { name: /salvar/i })`), rótulo (`getByLabelText('E-mail')`), texto; depois `alt` e `title`; `getByTestId` só como saída de emergência. Consulta por papel que falha costuma ser defeito de acessibilidade, não do teste.

**Variantes:** `getBy*` falha se não acha; `queryBy*` devolve `null` (para afirmar ausência); `findBy*` espera o que vem depois de trabalho assíncrono.

**Gestos com `userEvent`,** não `fireEvent`: um `userEvent.setup()` por teste e todo gesto com `await`.

**Esperar sem relógio:** `await screen.findByText(...)`, `await waitFor(() => expect(...))`, `waitForElementToBeRemoved(...)`. Espera fixa passa na máquina folgada e falha na carregada.

**Rede simulada na camada de rede** (MSW ou o que o projeto usa), não `fetch` trocado à mão. Pedido que nenhum simulador atende **falha o teste** (no MSW, `onUnhandledRequest: 'error'`). Cada teste troca a resposta que precisa (500, demora, recusa) e o simulador volta ao padrão depois.

**Provedores num lugar só:** um `renderComProvedores` no utilitário de teste, com o cliente de dados criado **uma vez por teste** e sem nova tentativa automática.

**Hook:** `renderHook` com o `wrapper` dos provedores, só pela API pública; o que muda estado dentro de `act`. Aviso de `act()` no console é defeito de verdade.

**Acessibilidade:** axe no teste de todo componente interativo (rótulo faltando, ARIA inválido, imagem sem `alt`, ordem de títulos).

**Sem snapshot de DOM:** quebra a cada ajuste e é aprovado sem leitura. Snapshot só para saída de função pura.

## O que toda tela que grava cobra

Um teste por gesto que grava:
- **Ação assíncrona tem estado visível:** cada desfecho provocado pela resposta simulada, afirmado **no lugar onde a pessoa agiu** — carregando (com a resposta segurada), feito, falhou.
- **O efeito entra na hora e a recusa desfaz:** com a resposta segurada, a tela já mostra o resultado; com a recusa do servidor, volta ao que era e diz o motivo.

O código parece certo e o gesto "não faz nada"? `orquestracao:auditoria-de-clique` segue o clique até o estado gravado; o defeito que ela achar vira teste aqui.

E sempre:
- **Insumo antes da afirmação:** a lista tem item, o elemento lido existe.
- **Ausência com prova de presença:** antes de `expect(queryByText('Erro')).toBeNull()`, mostre que o texto aparece quando deve.
- **Vermelho pelo motivo certo** (`orquestracao:tdd`): o teste falha pela razão do defeito, não por import quebrado ou consulta errada.

## Ponta a ponta (Playwright)

- **Localizador pelo papel:** `page.getByRole('button', { name: 'Salvar' })`, `page.getByLabel('E-mail')`.
- **Espera pelo que importa:** localizadores e `expect(...).toBeVisible()` já esperam; para a rede, `page.waitForResponse` com a rota do gesto. Nada de `waitForTimeout` nem `networkidle`.
- **Um navegador por padrão** (chromium); outro só com motivo escrito.
- **Servidor da tela:** o `webServer` do config sobe o dev server e reaproveita o que já está no ar fora do CI.
- **Rastro só na falha:** `trace: 'retain-on-failure'`, captura e vídeo idem. Relatório HTML não abre sozinho (`--reporter=list` na sessão).
- **Dado de teste próprio:** o fluxo cria o que lê; não depende da ordem dos outros nem de dado de produção.
- **Instalar o navegador** (`npx playwright install`) baixa arquivo grande: é preparo do projeto, com o ok do operador.

## Teste instável

Falha às vezes é defeito, não azar.
1. **Meça:** `npx playwright test --repeat-each=10 <arquivo>` (ou o arquivo de componente rodado várias vezes). Uma falha em dez já é instável.
2. **Ache a causa** (`orquestracao:depurar`), quase sempre: espera fixa; clique antes do elemento pronto ou durante animação; estado compartilhado entre testes; dado que outro teste apagou; relógio real em máquina carregada.
3. **Conserte a causa.** Quarentena (`test.fixme`, `test.skip`) só com o motivo e quem conserta escritos ao lado, por prazo curto. Nova tentativa automática esconde o defeito; vale só no CI e não conta como conserto.

## Os comandos

**Durante o trabalho, só o que a mudança afeta:** o comando de testes afetados e o typecheck que o `CLAUDE.md` do projeto declara, apontando o arquivo quando der:

```bash
npx vitest run src/componentes/Formulario.test.tsx
npx jest src/componentes/Formulario.test.tsx
npx playwright test --reporter=list e2e/gravar-pedido.spec.ts
```

A suíte inteira e todos os ponta a ponta são do gate do release, não de cada rodada.

Na sessão, não:
- **Modo watch** (`vitest` sem `run`, `jest --watch`, `playwright test --ui`): segura a sessão aberta.
- **Cobertura a cada rodada:** pesa o dobro; rode quando a pergunta for cobertura.
- **Muitos workers no ponta a ponta:** cada worker leva um navegador; `--workers=2` costuma bastar na máquina local.

## O que vai no relato

O comando que rodou e a saída real (as últimas linhas e o código de saída), não o resumo dela. Teste de tela que "passou" sem a tela no ar (servidor não subiu, rota deu 404) não passou: diga o que o teste viu (`orquestracao:verificar-antes-de-concluir`).
