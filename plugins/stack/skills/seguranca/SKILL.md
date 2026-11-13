---
name: seguranca
description: Checklist de consulta rápida ao escrever código seguro — segredos, validação de entrada, SQL injection, XSS e CSP, CSRF, autenticação e sessão, autorização e RLS do Supabase, pagamento, rate limit, log e erro sem vazamento, dependências, OWASP Top 10:2025. Use ao implementar login, permissão, upload, endpoint novo, webhook, integração de pagamento, ao mexer com segredo/token/cookie, ou antes de commitar código que recebe dado de fora. Para auditar um diff existente, use o agente stack:seguranca.
---

# Segurança (consulta ao escrever)

Para revisar um diff ou o projeto, o agente `stack:seguranca`. Mudança de risco (auth, permissão, segredo, dinheiro) passa também por `orquestracao:revisar`. Tabela OWASP 2025, ASVS e LLM: `referencias/owasp-2025.md`.

## 1. Segredos

- Nada de chave, token ou senha no código, em exemplo, em teste ou no histórico do git. Variável de ambiente ou gerenciador (Secret Manager do GCP, variáveis da Vercel/Supabase).
- `.env*` no `.gitignore`; `.env.example` só com os nomes. Valide na subida que as variáveis existem (`stack:deploy`).
- Chave do servidor (`service_role` do Supabase, chave de pagamento secreta) nunca vai para o navegador nem para variável `NEXT_PUBLIC_*`.
- Vazou? Rotacione primeiro, depois limpe o histórico. Nunca cole segredo em mensagem a outra sessão: mande o nome da variável.

## 2. Entrada

Toda entrada de fora (body, query, params, headers, cookies, webhook, resposta de API de terceiro, arquivo) é hostil até validada **no servidor**.

```typescript
const Entrada = z.object({ email: z.string().email().max(254), nome: z.string().min(1).max(100) });
const dados = Entrada.parse(entrada);       // lista de permitidos; nunca de proibidos
```

- Upload: limite de tamanho, tipo conferido pelo conteúdo (não só pela extensão ou `file.type`), nome gerado por você, fora do diretório servido. Storage com política própria.
- Redirecionamento (`?next=`) só para caminhos do próprio site (SSRF/open redirect). URL buscada pelo servidor a pedido do usuário: lista de hosts permitidos, bloqueie IP interno e `169.254.169.254`.

## 3. Injeção

```typescript
// nunca
await db.query(`select * from usuarios where email = '${email}'`);
// sempre parametrizado (no Postgres os marcadores são numerados: $1, $2…)
await db.query('select * from usuarios where email = $1', [email]);
```
- Supabase/Prisma/Drizzle parametrizam; o perigo está no `rpc`/`$queryRawUnsafe`/`sql` montado com `+` ou template. Nome de coluna/tabela vindo do usuário: lista fechada.
- Comando de sistema: `execFile('cmd', [arg])`, nunca `exec(`cmd ${x}`)`. Sem `eval`/`new Function` com dado de fora.

## 4. XSS e CSP

- React escapa por padrão. O risco é `dangerouslySetInnerHTML`, `href={url_do_usuario}` (`javascript:`) e HTML vindo do CMS/VTEX: sanitize com DOMPurify e lista curta de tags.
- CSP começa estrita (`default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`) e abre só o necessário, com nonce em vez de `'unsafe-inline'`. Scripts de terceiros (tag manager, chat) entram por origem explícita.
- Cabeçalhos: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.

## 5. Autenticação e sessão

- Senha: Argon2id ou bcrypt (nunca MD5/SHA1/SHA-256 puro). Se o provedor (Supabase Auth, Google) faz isso, use o provedor e não reimplemente.
- Sessão/JWT em cookie `HttpOnly; Secure; SameSite=Lax` (ou `Strict`), não em `localStorage`. Invalide no logout; troque o token ao logar.
- No servidor, confira o usuário pelo método que **valida** o token (no Supabase, `getUser()`/`getClaims()`), não confie em `getSession()` lido de cookie. Detalhe e armadilhas do `@supabase/ssr`: plugin `supabase@claude-plugins-official`.
- Anti-força-bruta no login e na recuperação de senha; mensagem igual para "usuário não existe" e "senha errada".

## 6. Autorização (a falha mais comum)

- **Negar por padrão; checar em toda requisição, no servidor, por recurso.** Esconder o botão não é autorização.
- IDOR: `/api/pedidos/:id` confere que o pedido é do usuário logado, não só que está logado.
- Papel e permissão vêm do servidor/token assinado, nunca de campo que o cliente envia nem de `user_metadata` editável.
- Supabase: RLS ligada em toda tabela exposta, com política por `(select auth.uid())`; `service_role` só no servidor; função `security definer` com `search_path` fixo. Ver `stack:postgres`.
- Se um middleware centraliza a checagem, confirme que ele cobre a rota (matcher) antes de dizer que "falta auth".

## 7. CSRF

Cookie de sessão com `SameSite` + checagem de `Origin` em método que escreve. Server Actions do Next já conferem origem; rota `POST` própria que usa cookie precisa da mesma checagem ou de token.

## 8. Pagamento e dinheiro

- Valor, moeda e desconto são calculados **no servidor** a partir do carrinho/pedido; nunca aceite o preço do cliente.
- Webhook: valide a assinatura do provedor, ignore evento repetido (chave de idempotência/ID do evento), responda rápido e processe depois.
- Nunca guarde nem logue número de cartão/CVV; use o checkout/tokenização do provedor (escopo PCI fica com ele).
- Dinheiro em centavos (inteiro) ou `numeric`, nunca `float`. Operação que move saldo dentro de transação, com trava da linha.

## 9. Limite de taxa

Login, recuperação de senha, busca, envio de e-mail/SMS, endpoints caros: limite por IP **e** por usuário/chave, `429` com `Retry-After`. Em serverless o contador vive no Redis, não na memória (`stack:api`).

## 10. Log e erro

- Não logue senha, token, cartão, CPF, corpo inteiro de requisição. Registre ID do usuário e do evento.
- O usuário vê mensagem genérica com um ID; stack e detalhe ficam no log do servidor. Falhou a checagem de permissão, **negue** (fail-closed), não libere.
- Registre login, falha de permissão e mudança sensível.

## 11. Dependências

`npm audit` (ou o scanner do repositório), lockfile commitado, `npm ci` no CI, Dependabot/Renovate ligado. Cuidado com nome parecido (typosquatting) ao instalar; pacote novo com poucos downloads e script `postinstall` merece olhar antes.

## Antes de commitar

- [ ] Sem segredo no diff (`git diff` e `git log -p` do que vai subir)
- [ ] Toda entrada nova validada no servidor
- [ ] Consulta parametrizada; HTML de fora sanitizado
- [ ] Cada rota nova tem auth e autorização por recurso, com teste de 401/403
- [ ] RLS nas tabelas novas
- [ ] Erro e log sem dado sensível
- [ ] Achou problema grave? Pare, corrija antes de seguir e rotacione o que vazou

Fonte: adaptado de affaan-m/ECC (MIT) — `security-review`; e de agamm/claude-code-owasp (MIT, © agamm) — `owasp-security`. Licença em `plugins/stack/licencas/LICENSE-agamm`.
