# OWASP 2025 — consulta

Adaptado de agamm/claude-code-owasp (MIT, © agamm; licença em `plugins/stack/licencas/LICENSE-agamm`) e de affaan-m/ECC (MIT).

## Top 10:2025

| # | Risco | Prevenção em uma linha |
|---|---|---|
| A01 | Controle de acesso quebrado | Negar por padrão, checar no servidor, conferir dono do recurso |
| A02 | Configuração insegura | Endurecer padrões, desligar o que não usa, sem debug em produção |
| A03 | Falhas na cadeia de suprimentos | Lockfile, verificar integridade, auditar dependência |
| A04 | Falhas criptográficas | TLS 1.2+, AES-256-GCM, Argon2/bcrypt para senha |
| A05 | Injeção | Consulta parametrizada, validar entrada, API segura |
| A06 | Design inseguro | Modelar ameaça, limite de taxa, controle desde o desenho |
| A07 | Falhas de autenticação | MFA, senha vazada barrada, sessão segura |
| A08 | Integridade de software ou dado | Assinar pacote, SRI em CDN, desserialização segura |
| A09 | Falha de log e alerta | Logar evento de segurança, formato estruturado, alerta |
| A10 | Mau tratamento de condição excepcional | Falhar fechado, não vazar interno, logar com contexto |

## Antes de relatar um achado

Padrão que casa não é vulnerabilidade. Confirme:

1. **A entrada é controlada por atacante?** Rastreie até a origem real (parâmetro, header, cookie, upload, webhook, mensagem de fila, resposta de terceiro). Constante, enum e config interna não são fonte de injeção.
2. **O destino é alcançável com essa entrada?** Veja validação, lista de permitidos, ORM ou middleware no caminho (`middleware.ts`, decorators) antes de dizer que falta auth: a checagem costuma estar centralizada.
3. **Qual o raio do dano?** Quem dispara, o que ganha, cruza fronteira de confiança?

Severidade por explorabilidade, não por padrão. Diga o caminho concreto ("esta entrada chega neste ponto"). Se for teórico ou defesa em profundidade, diga. Se não dá para saber pelo código disponível, diga isso em vez de afirmar.

## ASVS 5.0 — o mínimo (nível 1)

Os IDs da 5.0 **não** correspondem aos da 4.0; cite só os da 5.0.

- Senha com no mínimo 8 caracteres (15+ recomendado), sem regra de composição, aceita colar e gerenciador (6.2.1, 6.2.5, 6.2.7); barrar as 3000 mais comuns (6.2.4)
- Anti-automação contra credential stuffing (6.3.1); sem conta padrão `root`/`admin` (6.3.2)
- Token de sessão de CSPRNG, 128+ bits (7.2.3); token novo ao autenticar (7.2.4); sessão inutilizável após logout/expirar (7.4.1)
- Acesso por função e por dado restrito a permissões explícitas (8.2.1, 8.2.2), aplicado em camada confiável (8.3.1)
- Consulta parametrizada/ORM (1.2.4), chamada de SO parametrizada (1.2.5), encoding de saída por contexto (1.2.1–1.2.3), sem `eval` (1.3.2)
- Validação em camada confiável, preferindo lista de permitidos (2.2.1, 2.2.2)
- TLS 1.2+ com certificado público (12.1.1, 12.2.1, 12.2.2); sem ECB nem PKCS#1 v1.5 (11.3.1, 11.3.2)
- Sem dado sensível em URL/query (14.2.1)

Nível 2 (alvo da maioria): MFA (6.3.3), senha checada contra vazadas (6.2.12), sem troca periódica forçada (6.2.10), e **todo o log de segurança** (capítulo 16: tentativas de autenticação, falhas de autorização, erros inesperados, com quando/onde/quem/o quê, protegido contra injeção e adulteração, enviado para fora da máquina; mensagem genérica ao usuário, detalhe no log).

## LLM Top 10 (2025) — se o app chama modelo

| # | Risco | Mitigação |
|---|---|---|
| LLM01 | Prompt injection | Separar instrução de dado não confiável, filtrar saída, isolar privilégios |
| LLM02 | Vazamento de dado sensível | Higienizar RAG/contexto, limitar o que cada usuário recupera |
| LLM03 | Cadeia de suprimentos | Verificar origem de modelo/adaptador, fixar versões |
| LLM04 | Envenenamento de dado/modelo | Validar fontes, detectar anomalia na ingestão |
| LLM05 | Tratamento impróprio de saída | Saída do modelo é entrada não confiável: validar antes de SQL, shell, HTML, tool call |
| LLM06 | Agência excessiva | Poucas ferramentas e permissões, aprovação humana em ação destrutiva |
| LLM07 | Vazamento do prompt de sistema | Nunca pôr segredo ou lógica de auth no prompt |
| LLM08 | Fraqueza em vetor/embedding | Isolar vetores por tenant, controle de acesso na recuperação |
| LLM09 | Desinformação | Citar fonte, exigir base para resposta de alto risco |
| LLM10 | Consumo ilimitado | Limite por usuário, teto de tokens e chamadas, timeout |

Exemplo do padrão seguro para LLM05: peça saída estruturada (schema), valide e monte a consulta com colunas de uma lista fechada; nunca execute o SQL que o modelo escreveu.

Fonte: adaptado de agamm/claude-code-owasp (MIT) e affaan-m/ECC (MIT).
