# Phase 4: LLM Benchmarking - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-27
**Phase:** 04-llm-benchmarking
**Areas discussed:** Column count & layout, Model selection UI, Scoring UX, History view

---

## Column count & layout

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| N painéis + collapse (2–4) | react-resizable-panels com `collapsible={true} collapsedSize={4}` — prop nativa. Flexível até 4 modelos, usuário pode colapsar colunas para focar nas melhores. | ✓ |
| N painéis dinâmicos simples (2–4) | Flexível até 4 sem collapse. Mais simples. | |
| Fixed 2-pane | Exatamente 2 modelos, idêntico ao Chat/KB. | |

**User's choice:** N painéis + collapse (2–4)
**Notes:** Número de colunas deve ser fixado antes do render — `ResizablePanelGroup` não aceita inserção dinâmica após mount. `minSize={15}` para evitar colapso involuntário.

---

## Model selection UI

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Per-column pickers | Select dropdown no header de cada coluna. 2 pré-preenchidas com defaults do Settings. "+" adiciona coluna até 4. Reusa componente do Phase 2. | ✓ |
| Dialog pré-execução | Modal multi-select antes de renderizar colunas. Mais explícito mas introduz barreira. | |
| "+" dinâmico (tela vazia) | Canvas vazio inicial, "+" para adicionar cada coluna. | |

**User's choice:** Per-column pickers (Recomendado)
**Notes:** Padrão do Vercel AI Playground. Reuso quase verbatim do Select do Phase 2.

---

## Scoring UX

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| ToggleGroup 3 estados | Barra sticky [Modelo A] \| [Empate] \| [Modelo B]. Desabilitada durante streaming, habilita ao completar. shadcn/ui, sem nova dependência. | ✓ |
| Mark as winner por coluna | Botão "Winner" no footer de cada coluna + botão "Empate" separado. | |
| Radio group abaixo | RadioGroup com opção Empate. Acessível mas visual de formulário. | |

**User's choice:** ToggleGroup 3 estados (Recomendado)
**Notes:** Score persiste como winner_model_id ou null (empate) no SQLite. ToggleGroup habilita automaticamente quando todos os streams finalizarem.

---

## History view

| Opção | Descrição | Selecionado |
|-------|-----------|-------------|
| Tab "Histórico" | Header do módulo com 2 tabs: "Nova sessão" e "Histórico". Tabela shadcn com prompt, modelos, vencedor, data. Radix Tabs + Table já no projeto. | ✓ |
| Left panel (estilo Chat) | Painel ~280px com lista de sessões à esquerda. Máxima consistência com Chat. | |
| Right sidebar toggle | Botão "Histórico" abre painel direito colapsável. Não bloqueia benchmark ativo. | |

**User's choice:** Tab "Histórico" (Recomendado)
**Notes:** Módulo episódico não justifica 280px permanentes. Tabs evoluem naturalmente para split com replay em v2. Campos: prompt truncado (~60 chars) + badges dos modelos + badge do vencedor + data relativa (date-fns).

---

## Claude's Discretion

- Schema SQLite para `benchmark_sessions` e `benchmark_results`
- Orquestração de streaming (N invocações de `stream_chat` vs wrapper `stream_benchmark`)
- Design da área de prompt (acima das colunas vs modal pré-render)
- Posicionamento do ToggleGroup (sticky top bar vs floating)
- Paginação do histórico (provavelmente lista flat é suficiente)

## Deferred Ideas

- AI auto-scoring — v2 (explicitamente diferido em REQUIREMENTS.md)
- Replay de respostas completas no histórico — v2
- Comparação de custo/latência por coluna — v2
- Suporte a 5+ modelos — v2 (layout quebra abaixo de 15% de largura por coluna)
- Slots de modelos persistentes nomeados — deferido da discussão (Opção E do model selection)
- Filtro/busca no histórico — v2
