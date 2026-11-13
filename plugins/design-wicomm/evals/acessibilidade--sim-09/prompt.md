---
name: acessibilidade--sim-09
description: dispara a skill acessibilidade
tags: [disparo, acessibilidade, positivo]
max_turns: 2
timeout_seconds: 180
allowed_tools: [Skill, Read, Glob, Grep]
append_system_prompt: "Contexto desta rodada: você está no repositório de um app React da Wicomm (Next 15, Tailwind v4, front em web/, plugin design-wicomm ligado, design/design-system.json na raiz). Os arquivos do projeto não estão disponíveis aqui: decida o que fazer pelo pedido, sem procurar arquivos."
---

Antes de abrir o PR da tela nova de relatórios, verifica acessibilidade: contraste, teclado, rótulos.
