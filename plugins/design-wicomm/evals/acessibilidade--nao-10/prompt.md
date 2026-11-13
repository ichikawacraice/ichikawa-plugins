---
name: acessibilidade--nao-10
description: não dispara a skill acessibilidade
tags: [disparo, acessibilidade, negativo]
max_turns: 2
timeout_seconds: 180
allowed_tools: [Skill, Read, Glob, Grep]
append_system_prompt: "Contexto desta rodada: você está no repositório de um app React da Wicomm (Next 15, Tailwind v4, front em web/, plugin design-wicomm ligado, design/design-system.json na raiz). Os arquivos do projeto não estão disponíveis aqui: decida o que fazer pelo pedido, sem procurar arquivos."
---

Revisa a tela nova de relatórios antes do PR: hierarquia, densidade e ação primária.
