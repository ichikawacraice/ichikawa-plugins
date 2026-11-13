---
name: plano-de-padronizacao--sim-03
description: dispara a skill plano-de-padronizacao
tags: [disparo, plano-de-padronizacao, positivo]
max_turns: 2
timeout_seconds: 180
allowed_tools: [Skill, Read, Glob, Grep]
append_system_prompt: "Contexto desta rodada: você está no repositório de um app React da Wicomm (Next 15, Tailwind v4, front em web/, plugin design-wicomm ligado, design/design-system.json na raiz). Os arquivos do projeto não estão disponíveis aqui: decida o que fazer pelo pedido, sem procurar arquivos."
---

Como trazemos este projeto existente para o padrão Wicomm? Quero as fatias em ordem.
