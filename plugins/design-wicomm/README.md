# Plugin `design-wicomm`

O design system dos apps React **internos da Wicomm**, com a marca. Junta o `design-system` e o `tema-wicomm` do `kit-de-orquestracao` num plugin só, sem as travas do kit antigo.

## Ligar (só no projeto interno)

No `.claude/settings.json` do projeto, nunca na conta:

```json
{ "enabledPlugins": { "design-wicomm@ichikawa-plugins": true } }
```

App de cliente ou de fora da empresa não liga este plugin: a marca Wicomm não é licenciada ([`TERCEIROS.md`](TERCEIROS.md)).

## O que vem

| Peça | O que faz |
|---|---|
| [`base/`](base/) | A norma: `DESIGN.md` (como parece), `ANATOMIA.md` (o que vai onde), `CONVENCOES.md` (como o código sustenta as duas). Regra citada por código (`COR-03`, `CONV-19`). |
| [`tema/`](tema/) | O tema Wicomm: cor da marca nos dois temas, gradiente, fonte Archivo, logotipo, prefixo `@wicomm`. A skill `aplicar-tema` o copia para `design/tema/`. |
| Agente `designer` | Revisão de arquitetura **antes do código, só em tela nova** (ou redesenho). Não escreve tela. |
| Agente `critico-de-ui` | Nota em seis eixos (sete na densidade site), no máximo 5 problemas, teto 24/30 (28/35). **Obrigatório em tela nova; opcional no ajuste.** |
| Agente `auditor-de-padrao` | Mede, só lendo, um projeto existente contra a base. |
| Skills | `novo-projeto`, `auditar-projeto`, `plano-de-padronizacao`, `peca-do-kit`, `atualizar-sistema`, `acessibilidade`, `textos-de-interface`, `critica-de-ui`, `revisao-de-arquitetura-de-ui`, `aplicar-tema`. |
| Comandos | `/design-wicomm:novo`, `:auditar`, `:padronizar`, `:atualizar`, `:estado`. |
| Hooks (só avisam) | `lembrete-de-design.mjs` (no pedido de design, lembra o processo) e `valor-solto.mjs` (na escrita de tela, aponta `#hex`, `text-[15px]`, `duration-200`, paleta direto, ícone fora do `lucide-react`). Nenhum nega ferramenta nem segura o turno. |
| Scripts | `medir-deriva`, `medir-contraste`, `densidade`, `estado`, `base-do-projeto`. |
| `.mcp.json` | MCP do shadcn, para a `peca-do-kit` consultar o registro `@wicomm`. |

## Configuração do projeto: `design/design-system.json`

Escrito pelo `/design-wicomm:novo` (o nome antigo `design/wicomm.json` vale por baixo dele). Chaves: `versao`, `densidade`, `densidadePorRota`, `pasta`, `visual`, `fontes`, `kit`, `revisoes` (padrão `docs/design/revisoes`), `largura` (1280), `pecas`, `base`. Desligar avisos: `"lembrete": false`, `"valorSolto": false` ou `{ "valorSolto": { "ignorar": [globs] } }`.

## Testes

```bash
node --test 'hooks/tests/*.test.mjs' 'scripts/tests/*.test.mjs'
node evals/casos.mjs --conferir   # as pastas de eval batem com a lista
```

Os pacotes `@wicomm/tokens`, `@wicomm/guardas` e o registro moram no repositório do design system (`kit-de-orquestracao/design-system/`); as cópias que os scripts carregam (`scripts/lib/`, `scripts/dados/tokens-wicomm.json`) não têm conferência automática aqui: quando o pacote mudar, recopie à mão.
