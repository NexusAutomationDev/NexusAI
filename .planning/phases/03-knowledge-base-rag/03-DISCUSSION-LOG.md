# Phase 3: Knowledge Base + RAG - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-26
**Phase:** 03-knowledge-base-rag
**Mode:** advisor (conservative vendor profile → full_maturity tier; 4 parallel research agents)
**Areas discussed:** RAG query & citations, Notes editor, KB browser layout, Ingestion & indexing UX

---

## RAG Query Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Integrar no Chat existente | Toggle/@-menção "usar KB" no chat do Phase 2; reusa streaming/persistência/markdown; padrão de mercado | ✓ |
| View KB dedicada | Tela separada no stub /kb; modelo mental limpo mas duplica encanamento | |
| Híbrido (motor compartilhado) | /kb + toggle no chat; exige refatorar chat em container reutilizável | |

**User's choice:** Integrar no Chat (recommended)
**Notes:** /kb fica para o navegador/gerência da KB, não para um segundo chat. KB-scope rastreado por mensagem.

## Citations

| Option | Description | Selected |
|--------|-------------|----------|
| Footnotes [1] + cards de fonte | Marcadores inline clicáveis + cards (arquivo+seção); atende "cita o chunk" | ✓ |
| Só cards de fonte | Lista de chunks sem marcadores inline; não depende de disciplina do LLM | |
| Cards + click-to-open chunk | Abrir chunk no doc de origem; verificação máxima mas precisa de visualizador por tipo | |

**User's choice:** Footnotes [1] + cards (recommended)
**Notes:** Fallback para cards-only se fidelidade de ID do modelo local for fraca. Click-to-open deferido para 3.x.

## Notes Editor

| Option | Description | Selected |
|--------|-------------|----------|
| CodeMirror 6 | Markdown puro = fonte da verdade; fidelidade RAG perfeita; live-preview Obsidian; maduro | ✓ |
| TipTap 3.x | WYSIWYG visual; mais adotado; risco de serialização de markdown perder dados | |
| Textarea + react-markdown | Zero-deps, output limpo, visual datado | |

**User's choice:** CodeMirror 6 (recommended)
**Notes:** Limpeza do markdown pro RAG é a restrição que define a escolha, não riqueza visual.

## KB Browser Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Híbrido: árvore + tabela | Árvore pastas/notas à esquerda + view plana filtrável à direita; atende KB-03 E KB-05 | ✓ |
| Só árvore Obsidian | Sidebar hierárquica + editor; força URLs/arquivos numa árvore | |
| Só tabela plana | Filtrável por tipo/status; sem hierarquia de pastas (falha KB-03 sozinha) | |

**User's choice:** Híbrido árvore + tabela (recommended)
**Notes:** Reusa o split redimensionável de duas colunas do chat. Pastas só para notas.

## Ingestion & Indexing UX (feedback model)

| Option | Description | Selected |
|--------|-------------|----------|
| Híbrido completo | Badge por item (verdade/SQLite) + progresso global em lote + toast pra URL/falhas; tudo de um indexingStore Zustand via Channel API | ✓ |
| Só badge por item | Apenas badges; atende mínimo, sem noção de "quanto falta" | |
| Badge + toasts (sem painel) | Meio-termo se lote for raro | |

**User's choice:** Híbrido completo (recommended)
**Notes:** Falha = badge destructive + retry na linha + re-index idempotente. Reconciliar status do SQLite no mount.

## Import Entry Points & Empty State

| Option | Description | Selected |
|--------|-------------|----------|
| Drag-drop + botão + campo URL | Empty state: drop zone central + "Escolher arquivos" + campo URL; sem dados de exemplo | ✓ |
| Só drag-drop + botão | Foco em arquivos; URL em menu secundário | |
| Barra de ações unificada no topo | Toolbar fixa; empty state só com microcópia | |

**User's choice:** Drag-drop + botão + campo URL (recommended)
**Notes:** Local-first/privado → sem seeding de demo.

## Additional areas offered (declined → Claude's Discretion)

| Option | Description | Selected |
|--------|-------------|----------|
| Escrever o contexto | Deixar embedding/chunking/scraping como discrição do pesquisador | ✓ |
| Discutir modelo de embedding | Decidir modelo fastembed (multilíngue/PT-BR) agora | |
| Discutir chunking + scraping | Detalhar estratégia de chunking e scraping de URL | |

**User's choice:** Escrever o contexto (recommended)
**Notes:** Constraint registrado mesmo assim — modelo de embedding DEVE suportar bem PT-BR (preferir multilíngue). Captado como D-15.

## Claude's Discretion

- Chunking strategy (tamanho, overlap, paragraph vs token)
- URL scraping engine / main-content extraction
- Exact fastembed model (dentro da restrição PT-BR/multilíngue)
- KB SQLite schema specifics
- Citation-ID prompt + custom-node implementation
- Tree library final pick + table faceted-filter wiring

## Deferred Ideas

- Click-to-open chunk + hover preview → 3.x
- Gmail/Calendar como fontes da KB → Phase 5
- Consumo da KB por agentes → Phase 7
- Sidecar Node.js (@xenova/transformers) → não usado no Phase 3
- WYSIWYG visual (TipTap) → reconsiderar só se virar requisito
