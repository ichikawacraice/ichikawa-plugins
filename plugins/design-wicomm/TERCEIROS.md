# Material de terceiros no plugin `design-wicomm`

O plugin junta o `design-system` e o `tema-wicomm` do `kit-de-orquestracao` (antes, o plugin `wicomm`). A atribuição abaixo veio com eles.

## A marca Wicomm

O nome Wicomm, o logotipo (`tema/logotipo/`), a cor da marca e a fonte do tema (`tema/`) pertencem à Wicomm e não são licenciados pelo MIT nem por outra licença deste repositório. Só se usam nos projetos da própria empresa.

## anthropics/knowledge-work-plugins — plugin `design`

- **Origem:** [github.com/anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins), pasta `design/skills/`, conferida em 02/11/2026 (`main @ 2574e29`).
- **Licença:** Apache License 2.0 — cópia em [`licencas/knowledge-work-plugins-APACHE-2.0.txt`](licencas/knowledge-work-plugins-APACHE-2.0.txt). O repositório não tem arquivo `NOTICE`.
- **O que se aproveitou, e o que mudou:**

| Original | Aqui | Mudanças |
|---|---|---|
| `design/skills/accessibility-review` | skill [`acessibilidade`](skills/acessibilidade/SKILL.md) e regras `ACES-01` a `ACES-05` da base (CONVENCOES §8) | reescrita em PT-BR; cada critério ligado a uma regra da base; contraste medido pelos tokens nos dois temas; alvo de toque corrigido para o critério AA 2.5.8 (24px) — o original dava o 2.5.5 (44px, AAA) como AA; sem conectores (Figma, gestor de tarefas) |
| `design/skills/ux-copy` | skill [`textos-de-interface`](skills/textos-de-interface/SKILL.md) e regras `MSG-07` a `MSG-09` da base (ANATOMIA §4) | reescrita em PT-BR; presa à matriz de mensagens (MSG-01) e ao glossário do projeto (CONV-12); erro em duas partes; *Cancelar* mantido como padrão do kit; sem notas de localização |
| `design/skills/design-system` (só a auditoria) | skill `auditar-projeto` (estados de cada peça sem par) | uma coluna a mais na tabela de peças; o resto já existia (tokens, deriva, peças do registro) |

O restante do plugin `design` (`design-critique`, `design-handoff`, `research-synthesis`, `user-research`) não entrou: a crítica do plugin (`critico-de-ui`) cobre a primeira, e as outras estão fora do processo de hoje.

## affaan-m/ECC — skills `frontend-a11y` e `accessibility`

- **Origem:** [github.com/affaan-m/ECC](https://github.com/affaan-m/ECC), arquivos `skills/frontend-a11y/SKILL.md` e `skills/accessibility/SKILL.md`, lidos num clone só-leitura em 12/11/2026 (commit `d2ef268`). Nada foi instalado nem rodado.
- **Licença:** MIT, Copyright (c) 2026 Affaan Mustafa — aviso e texto de permissão em [`licencas/ECC-MIT.txt`](licencas/ECC-MIT.txt).
- **O que se aproveitou, e o que mudou:**

| Original | Aqui | Mudanças |
|---|---|---|
| `frontend-a11y` (HTML semântico, ARIA, antipadrões, campo obrigatório) | regras `ACES-06` e `ACES-07` da base (CONVENCOES §8) e as buscas do passo 5 da skill [`acessibilidade`](skills/acessibilidade/SKILL.md) | reescrita em PT-BR, sem os exemplos de código: a peça do kit carrega o padrão; o `required` nativo e o `role="alert"` em cada campo ficaram de fora (CONV-10, CONV-09); o `StatusMessage` contradiz a ACES-05 e não entrou |
| `accessibility` (alt redundante; WCAG 2.2, critérios 2.5.7 e 3.3.7) | busca do `alt` "Imagem de" e os dois critérios em *Observações* na skill `acessibilidade` | só a web; iOS, Android e o refluxo a 400% ficaram de fora (a base é React web, desktop primeiro) |

O resto da `frontend-a11y` não entrou: o combobox escrito à mão (o kit tem `Select` e `Menu`), o modal com `focus-trap-react` (dependência nova; o `Dialog` do kit prende e devolve o foco) e o hook `useReducedMotion` (a MOV-02 resolve no CSS).
