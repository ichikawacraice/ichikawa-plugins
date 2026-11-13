---
name: novo-projeto--nao-07
description: não dispara a skill novo-projeto
tags: [disparo, novo-projeto, negativo]
max_turns: 2
timeout_seconds: 180
allowed_tools: [Skill, Read, Glob, Grep]
append_system_prompt: "Contexto desta rodada: você está no repositório de um app React da Wicomm (Next 15, Tailwind v4, front em web/, plugin design-wicomm ligado, design/design-system.json na raiz). Os arquivos do projeto não estão disponíveis aqui: decida o que fazer pelo pedido, sem procurar arquivos."
---

Cria um endpoint de API em Node que lista os pedidos do dia.
