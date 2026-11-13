---
name: typescript
description: TypeScript estrito e idiomático — tsconfig, unknown em vez de any, união discriminada, validação com schema na borda, erros tipados e Result, async (allSettled, concorrência limitada, cancelamento), satisfies, branded types. Use ao escrever ou revisar .ts/.tsx, ao ligar strict num projeto, ao tipar resposta de API ou ao tratar erro e promessa.
---

# TypeScript

Texto adaptado de affaan-m/ECC (MIT). O tipo é uma prova, não burocracia: se um erro de tipo resiste a uma anotação razoável, o que está errado costuma ser o desenho.

## tsconfig de base

```jsonc
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,   // arr[i] e record[k] podem ser undefined
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,       // import type explícito; casa com bundlers e type stripping
    "isolatedModules": true,
    "moduleResolution": "bundler",      // Vite/Next; use "nodenext" em Node puro
    "noEmit": true                      // o bundler compila; tsc só confere
  }
}
```

- `strict` não é opcional. Projeto que não compila em strict tem tarefa de migração, não motivo para desligar. Migre por pasta (`tsconfig` extra) se for grande.
- `noUncheckedIndexedAccess` gera ruído no começo; o remédio é estreitar (`const [primeiro] = itens; if (!primeiro) …`), não remover a flag.
- Build do Vite e do Next **não** checam tipo: rode `tsc --noEmit` no CI e no gate.
- Node 22.18+/24 roda `.ts` direto (remove tipos, não compila). Para isso, `erasableSyntaxOnly: true` proíbe `enum`, `namespace` e parâmetro-propriedade.

## `any` é bug, `unknown` é a porta

```ts
// ruim
function mensagem(e: any) { return e.message; }
// bom
function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : "Erro inesperado";
}
```

- Dado de fora (corpo de requisição, JSON, `process.env`, `localStorage`) entra como `unknown` e é **validado**, não afirmado com `as`.
- `as` que cala o compilador sem conferir nada é onde nasce `undefined is not an object`. Se precisar, o cast fica dentro do módulo que validou.
- `!` (não nulo) só depois de uma guarda que o justifique.
- `// @ts-expect-error` com motivo, nunca `@ts-ignore` (o `expect` avisa quando o erro some).

## API pública com tipo explícito, local com inferência

- Exporte funções com parâmetros e retorno tipados; deixe o TS inferir variável local.
- `interface` para forma de objeto que se estende; `type` para união, tupla, mapeado. Literais de string em vez de `enum`.
- Props de componente: `interface Props` nomeada; sem `React.FC`.
- Mais de 2–3 parâmetros: objeto de opções. Evite objeto de opções 100% opcional (engole erro de digitação).

## União discriminada como máquina de estados

```ts
type Pedido =
  | { tipo: "rascunho"; id: string }
  | { tipo: "enviado"; id: string; enviadoEm: Date }
  | { tipo: "pago"; id: string; pagoEm: Date; centavos: number };

function descrever(p: Pedido): string {
  switch (p.tipo) {
    case "rascunho": return "Salvo, não enviado";
    case "enviado":  return `Enviado em ${p.enviadoEm.toISOString()}`;
    case "pago":     return `Pago ${p.centavos} centavos`;
    default:         return assertNever(p); // novo membro quebra a compilação aqui
  }
}
function assertNever(x: never): never { throw new Error(`Caso não tratado: ${JSON.stringify(x)}`); }
```

Em vez de `{ carregando: boolean; erro?: string; dados?: X }` (estados impossíveis), use `{ status: "carregando" } | { status: "erro"; erro: string } | { status: "ok"; dados: X }`.

## Valide na borda, confie por dentro

Um schema (Zod, Valibot) é a checagem em runtime **e** o tipo.

```ts
import { z } from "zod";

const Entrada = z.object({
  email: z.email(),                 // Zod 4: z.email(); z.string().email() é o estilo antigo
  idade: z.number().int().min(0).max(150),
});
type Entrada = z.infer<typeof Entrada>;

const r = Entrada.safeParse(corpo);
if (!r.success) return { erro: z.flattenError(r.error) }; // Zod 4; no 3 era r.error.flatten()
const entrada: Entrada = r.data;
```

- Valide uma vez, na entrada (rota, Server Action, consumidor de fila, leitor de arquivo, `process.env` no start). Daí para dentro o tipo é confiável.
- Resposta de API de terceiro também é entrada de fora.
- Guarda de tipo (`x is Config`) ou `asserts` no lugar de cast quando não há schema.

## `satisfies`, `as const`, readonly

```ts
const acaoParaStatus = { nova: "aberto", reabrir: "aberto", fechar: "fechado" } as const satisfies Record<Acao, Status>;
```

`satisfies` confere a forma sem alargar o tipo; o literal fica preciso. Parâmetro que a função não muda é `readonly T[]`. Atualize por cópia (`{ ...u, nome }`), não mutando.

## IDs e unidades que não podem se misturar

Dois `string` de significados diferentes (`ClienteId` e `PedidoId`) ou dinheiro em centavos × reais: marca (`brand`) criada **só** no módulo que valida.

```ts
declare const marca: unique symbol;
export type ClienteId = string & { [marca]: "ClienteId" };
export function clienteId(v: string): ClienteId {
  if (!/^cus_[a-z0-9]+$/.test(v)) throw new TypeError(`ClienteId inválido: ${v}`);
  return v as ClienteId;
}
```

Dinheiro: inteiro em centavos (ou `numeric` no banco), nunca `number` de ponto flutuante com casas.

## Erros

- **Inesperado** (bug, rede caiu): lance `Error` (nunca `throw "texto"`), com causa: `new Error("falha ao carregar pedido", { cause: e })`.
- **Esperado** (validação, não achou, conflito): devolva um `Result`, o tipo mostra que pode falhar.

```ts
type Result<T, E = AppError> = { ok: true; valor: T } | { ok: false; erro: E };
```

- Hierarquia curta de erros de domínio com `code` e `status`: `AppError` → `NotFoundError`, `ValidationError`, `UnauthorizedError`. `instanceof` funciona; em alvo antigo, `Object.setPrototypeOf(this, new.target.prototype)`.
- Mensagem ao usuário ≠ mensagem ao desenvolvedor: no servidor logue o contexto inteiro (sem segredo), ao cliente devolva texto amigável e um `code`.
- `catch` sempre faz algo: trata, relança ou registra. `catch {}` vazio é achado. `JSON.parse` vai em try/catch.
- **`redirect()` e `notFound()` do Next lançam de propósito**: não os embrulhe em `try/catch` que engole.

## Async

```ts
// independentes e uma falha não derruba as outras
const rs = await Promise.allSettled(ids.map(buscar));
// tudo ou nada
const [a, b] = await Promise.all([x(), y()]);
```

- `forEach(async …)` não espera: use `for…of` ou `Promise.all(map)`.
- Promessa solta (sem `await` nem `.catch`) vira rejeição não tratada. Ative `@typescript-eslint/no-floating-promises`.
- Centenas de promessas de uma vez estouram conexão: limite a concorrência (`p-limit`, ou um pool de N trabalhadores).
- Chamada externa leva `AbortSignal` e timeout: `fetch(url, { signal: AbortSignal.timeout(5000) })`. Cancelamento que o chamador controla: `AbortController`.
- Função `async` sempre rejeita; função comum que devolve promessa pode lançar síncrono (dois formatos de erro). Mantenha `async`.

## Módulos

- Arquivos pequenos e nomeados; sem barrel `index.ts` em código de aplicação (importação circular e bundle maior); `import type` para tipos.
- Dependência que aponta numa direção só (UI → domínio → dados), nunca o contrário.
- Antes de adicionar dependência, veja se a plataforma já faz (`structuredClone`, `fetch`, `crypto.randomUUID`, `Intl`, `Array.prototype.toSorted`).

## Teste de tipo

Tipo público que não pode afrouxar sem aviso ganha teste: `expectTypeOf<Result<User>>().toEqualTypeOf<…>()` (Vitest).

## Ferramentas

`tsc --noEmit` (ou `tsc -b` com project references), `typescript-eslint` com o conjunto `recommendedTypeChecked`, Prettier. Se o lint tipado está lento, é sinal de estrutura de projeto, não motivo para desligar.

## Antipadrões

`any` para ganhar tempo; `as` que mente; `enum` (reverse mapping, artefato em runtime); "tipo deus" que modela vários formatos (separe em união); `console.log` esquecido (use logger); `==` no lugar de `===`; `var`; estado mutável de módulo (compartilhado entre requisições no servidor); `process.env.X` espalhado sem validar no start.

Fonte: adaptado de affaan-m/ECC (MIT)
