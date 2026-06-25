# NexusAI — v1 Requirements

## Overview

**Project:** NexusAI — Desktop AI super-app (Tauri v2, Windows + macOS)
**Milestone:** v1 — Core product with all major modules functional
**Total v1 requirements:** 35

---

## v1 Requirements

### Foundation & Settings (FOUND)

- [ ] **FOUND-01**: Usuário pode configurar chaves de API (OpenRouter, Gemini, OpenAI) via interface gráfica — chaves armazenadas no OS Keychain, nunca em texto plano
- [ ] **FOUND-02**: Usuário pode selecionar o modelo padrão por tipo de tarefa (chat, agentes, benchmark) via settings
- [ ] **FOUND-03**: Usuário pode alternar entre tema claro e escuro e personalizar aparência do app
- [ ] **FOUND-04**: App inicializa com plugin-per-module architecture (cada domínio como Cargo crate separado) com stubs vazios para todos os módulos desde o Phase 1
- [ ] **FOUND-05**: App usa Channel API do Tauri v2 para toda comunicação de streaming — nunca `emit()` em loop (previne memory leak ativo no wry)
- [ ] **FOUND-06**: SQLite roda em WAL mode com connection pooling desde o início
- [ ] **FOUND-07**: App possui keypair de updater gerado e backup documentado antes do primeiro build distribuível
- [ ] **FOUND-08**: Build pipeline inclui macOS notarization + entitlements corretos (cs.allow-jit) e Windows code signing desde o primeiro release

### LLM Chat (CHAT)

- [ ] **CHAT-01**: Usuário pode iniciar conversa com qualquer LLM configurado e ver tokens chegando em streaming em tempo real
- [ ] **CHAT-02**: Usuário pode acessar histórico completo de conversas anteriores, com busca por conteúdo
- [ ] **CHAT-03**: Usuário pode trocar de modelo ou provedor dentro da mesma conversa sem perder o histórico
- [ ] **CHAT-04**: Usuário pode anexar arquivos (PDF, imagens, documentos) a uma mensagem para o LLM analisar
- [ ] **CHAT-05**: Respostas do LLM são renderizadas em Markdown com syntax highlighting para código

### Knowledge Base (KB)

- [ ] **KB-01**: Usuário pode importar arquivos locais (PDF, .md, .txt, .docx) para o knowledge base — arquivos são indexados automaticamente com chunking semântico
- [ ] **KB-02**: Usuário pode fazer perguntas ao LLM que responde baseado nos documentos indexados (RAG com hybrid retrieval: BM25 + vector search via sqlite-vec)
- [ ] **KB-03**: Usuário pode criar, editar e organizar notas dentro do app em editor com suporte a Markdown
- [ ] **KB-04**: Usuário pode salvar URLs para indexação — o app faz scraping e indexa o conteúdo no knowledge base
- [ ] **KB-05**: Usuário pode visualizar todos os arquivos e notas do knowledge base em uma interface estilo file explorer (Obsidian-like)
- [ ] **KB-06**: Conhecimento do knowledge base é compartilhado entre todos os agentes — nenhum agente tem silo isolado
- [ ] **KB-07**: Embeddings são gerados localmente via fastembed-rs (ONNX) — nenhuma chamada de API externa para indexação

### LLM Benchmarking (BENCH)

- [ ] **BENCH-01**: Usuário pode disparar o mesmo prompt para múltiplos modelos simultaneamente e ver as respostas lado a lado
- [ ] **BENCH-02**: Usuário pode avaliar manualmente qual resposta foi melhor e registrar o resultado

### Gmail (GMAIL)

- [ ] **GMAIL-01**: Usuário pode autenticar com conta Google via OAuth2 PKCE e acessar a inbox do Gmail dentro do app
- [ ] **GMAIL-02**: Usuário pode ler emails individuais com visualização completa (HTML + texto)
- [ ] **GMAIL-03**: Usuário pode pedir para a IA resumir um email ou rascunhar uma resposta com base no contexto

### Calendário (CAL)

- [ ] **CAL-01**: Usuário pode visualizar eventos do Google Calendar sincronizados dentro do app
- [ ] **CAL-02**: Usuário pode criar e editar eventos do Google Calendar de dentro do app

### MCP Management (MCP)

- [ ] **MCP-01**: Usuário pode adicionar servidores MCP externos (stdio e HTTP/SSE) via interface gráfica
- [ ] **MCP-02**: Usuário pode ativar ou desativar ferramentas individuais de um servidor MCP com granularidade por tool
- [ ] **MCP-03**: Usuário pode visualizar status, logs e saúde de cada servidor MCP ativo
- [ ] **MCP-04**: NexusAI expõe suas próprias funcionalidades como servidor MCP — outros clientes MCP podem se conectar ao app

### Agentes & Automações (AGENT)

- [ ] **AGENT-01**: Usuário pode criar subagentes com papel, instruções e conjunto de ferramentas (MCPs) definidos
- [ ] **AGENT-02**: Usuário pode configurar automações agendadas que rodam em horários fixos (ex: resumo diário de emails às 8h)
- [ ] **AGENT-03**: Usuário pode criar automações via conversa natural com o LLM ("me manda um resumo todo dia de manhã")
- [ ] **AGENT-04**: Todo agente com acesso a ferramentas tem guardrails obrigatórios: limite de iterações, timeout e detecção de loop (repetição de resposta idêntica consecutiva)

---

## v2 Requirements (Deferred)

Features identificadas mas explicitamente diferidas para evitar scope creep no v1:

- Escrever e responder emails diretamente do app (v1 foca em leitura + IA)
- Indexação de emails no knowledge base
- Score automático por IA no benchmark (v1: score manual)
- Histórico persistente de sessões de benchmark
- Graph view do knowledge base (visual noise acima de 1000 notas — Obsidian problema conhecido)
- Calendário local offline (v1 usa Google Calendar)
- Atalhos de teclado customizáveis
- Colaboração multi-usuário

---

## Out of Scope

- **App mobile** — desktop-only (Windows + macOS); iOS/Android fora do escopo
- **Backend/servidor próprio na nuvem** — local-first, sem servidor NexusAI externo
- **Linux** — fora do escopo por ora (Tauri suporta, mas QA é inviável sem hardware)
- **Electron** — decisão arquitetural: Tauri v2 para performance e bundle size
- **Python como sidecar** — descartado na pesquisa; Node.js sidecar (AI SDK v7) cobre os casos de uso sem o peso do PyInstaller

---

## Traceability

> Preenchido pelo roadmapper.

| REQ-ID | Phase |
|--------|-------|
| FOUND-01 a FOUND-08 | Phase 1 |
| CHAT-01 a CHAT-05 | Phase 2 |
| KB-01 a KB-07 | Phase 3 |
| BENCH-01 a BENCH-02 | Phase 4 |
| GMAIL-01 a GMAIL-03 | Phase 5 |
| CAL-01 a CAL-02 | Phase 5 |
| MCP-01 a MCP-04 | Phase 6 |
| AGENT-01 a AGENT-04 | Phase 7 |

---

## Stack Decisions (Locked)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Desktop runtime | Tauri v2 | Performance, bundle size, OS integration nativa |
| Frontend | React 19 + Vite | Ecossistema maior, melhor suporte Tauri community |
| UI Components | **shadcn/ui + Tailwind CSS** | Componentes acessíveis (Radix), customizáveis, Tauri-compatible |
| Core/backend | Rust (Tauri commands) | LLM calls, file system, SQLite, OS Keychain — nunca expõe chaves ao JS |
| Agentes/IA | Node.js sidecar (AI SDK v7) | TypeScript-first, sem peso de Python |
| Vector search | sqlite-vec | Embedded, sem servidor, Rust-native, mesmo arquivo SQLite |
| Embeddings | fastembed-rs (ONNX) | Local, sem API, funciona offline |
| ORM | Drizzle ORM | Type-safe, funciona com Tauri SQL proxy |
| Secrets | OS Keychain (keyring crate) | Chaves nunca ficam em disco como texto plano |

---

*Generated: 2026-06-25*
