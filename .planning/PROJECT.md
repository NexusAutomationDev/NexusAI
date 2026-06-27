# NexusAI

## What This Is

NexusAI é um app desktop all-in-one para Windows e macOS (Tauri v2) que unifica ferramentas de produtividade (email/Gmail, notas, calendário) com capacidades avançadas de IA: chat com múltiplos LLMs, orquestração de agentes, automações inteligentes, gerenciamento de MCPs e uma base de conhecimento compartilhada entre agentes. É uma central de comando pessoal com IA no núcleo, projetada tanto para uso próprio quanto para distribuição.

## Core Value

Um workspace desktop unificado onde toda a informação do usuário (emails, arquivos, notas, histórico, web) fica acessível a agentes inteligentes que conseguem agir, automatizar e raciocinar em nome do usuário — tudo configurável sem precisar de código.

## Requirements

### Validated

- [x] Knowledge base estilo Obsidian — browser de arquivos/notas/URLs com status de indexação (Validated in Phase 3; emails ficam para Phase 5)
- [x] Notas integradas — editor Markdown CodeMirror sem mutação, organização por pastas, recuperáveis via RAG (Validated in Phase 3)

### Active

- [ ] Chat com LLMs configurável via GUI (OpenRouter, Gemini API, OpenAI API — troca de modelo sem reiniciar)
- [ ] Benchmark / score de LLMs (mesmo prompt em múltiplos modelos, pontuação de qualidade)
- [ ] IA com acesso ao knowledge base (arquivos locais, histórico de conversas, emails/calendário, URLs salvas) — RAG sobre arquivos/notas/URLs entregue na Phase 3; emails/calendário pendentes (Phase 5)
- [ ] Compartilhamento de conhecimento entre agentes — índice único compartilhado pronto (Phase 3, D-16); agentes em si na Phase 7
- [ ] Integração Gmail (ler, escrever, gerenciar emails dentro do app)
- [ ] Calendário (visualizar e gerenciar agenda)
- [ ] Notas integradas
- [ ] Orquestração de subagentes (criar, configurar e monitorar agentes)
- [ ] Automações via conversa com IA ou configuração GUI
- [ ] Gerenciamento de MCPs via UI (consumir MCPs externos, criar MCPs próprios, ativar/desativar)
- [ ] Dashboard central agregando todas as funcionalidades

### Out of Scope

- App mobile — foco exclusivo em desktop (Windows + macOS)
- Colaboração em tempo real entre usuários — uso individual ou distribuição como produto single-user
- Backend/servidor próprio na nuvem — app local-first, APIs externas apenas para LLMs/email

## Context

- **Runtime**: Tauri v2 (Rust + web frontend) — escolhido por performance e tamanho de bundle vs Electron
- **LLM Providers**: OpenRouter, Google Gemini API, OpenAI API — seleção e chaves configuráveis via GUI
- **Framework AI**: LangChain/LangGraph ou similar ainda em avaliação para integração com Tauri v2
- **Storage**: SQLite como base + solução adicional (provavelmente vector DB para RAG e busca semântica)
- **Distribuição**: começa como ferramenta pessoal, com intenção de distribuir/vender depois
- **MCPs**: o app tanto consome servidores MCP externos quanto permite criar e expor funcionalidades como servidor MCP — tudo gerenciado via interface

## Constraints

- **Tech (runtime)**: Tauri v2 — define a arquitetura frontend/backend do app (Rust core + webview)
- **Tech (AI framework)**: LangChain/LangGraph ainda não confirmado — decisão impacta orquestração de agentes e automações
- **Tech (storage)**: SQLite definido, mas tipo de vector DB a escolher (impacta RAG e knowledge base)
- **Plataformas**: Windows e macOS apenas — Linux fora do escopo por ora
- **Local-first**: dados do usuário ficam na máquina — nenhum servidor próprio gerencia dados privados

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Tauri v2 em vez de Electron | Performance nativa, bundle menor, melhor integração com SO | — Pending |
| SQLite como DB principal | Simplicidade, zero-config, embedded — ideal para desktop local-first | — Pending |
| Suporte a múltiplos provedores LLM desde o início | Evitar lock-in, permitir benchmark entre modelos | — Pending |
| Automações via conversa E via GUI | Reduz barreira de uso — usuário técnico e não-técnico conseguem criar rotinas | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-27 after Phase 3 (Knowledge Base + RAG) completion*
