---
name: revisao-de-arquitetura-de-ui--nao-01
description: não dispara o subagente designer
tags: [disparo, revisao-de-arquitetura-de-ui, negativo]
max_turns: 2
timeout_seconds: 180
allowed_tools: [Skill, Agent, Read, Glob, Grep]
append_system_prompt: "Contexto desta rodada: você está no repositório de um app React da Wicomm (Next 15, Tailwind v4, front em web/, plugin design-wicomm ligado, design/design-system.json na raiz). Os arquivos do projeto não estão disponíveis aqui: decida o que fazer pelo pedido, sem procurar arquivos."
---

Corrige o bug de cálculo do total do pedido no backend.
