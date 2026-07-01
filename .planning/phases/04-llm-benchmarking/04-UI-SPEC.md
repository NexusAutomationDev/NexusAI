---
phase: 4
slug: llm-benchmarking
status: approved
reviewed_at: 2026-06-28
shadcn_initialized: false
preset: manual (Tailwind v4 + shadcn components — sem components.json)
created: 2026-06-28
---

# Phase 4 — UI Design Contract

> Visual and interaction contract para LLM Benchmarking. Gerado por gsd-ui-researcher; verificado por gsd-ui-checker.
>
> **Reuse-first phase.** O sistema de design (tokens, espaçamento, tipografia, cor) está completamente estabelecido pelas Fases 1–3 e bloqueado em `src/index.css`. Este contrato especifica apenas o que é NOVO ou ambíguo na Fase 4: layout de N colunas resizáveis, header de coluna com estado de streaming, barra de scoring `ToggleGroup`, tab "Nova sessão" / "Histórico", e copywriting específico do módulo. O shell do app, sidebar, tokens e componentes existentes são REUTILIZADOS sem alteração.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn/ui (componentes manuais, sem `components.json`) |
| Preset | não aplicável (componentes copiados manualmente do registry Radix oficial, committed em `src/components/ui/`) |
| Component library | @radix-ui primitives (via shadcn/ui) |
| Icon library | lucide-react — 20px para controles principais, 16px para ícones inline de status |
| Font | System font stack (herdado da Fase 1) |

**Notas:**
- Fase 1 estabeleceu Tailwind v4 + shadcn/ui sem `components.json`; continuar o padrão de cópia manual (sem `npx shadcn add`).
- Design tokens vivem em `src/index.css` via CSS variables (HSL). Dark-first, estética Linear/Raycast. Violeta primário (`263.4 70% 50.4%`, configurável via `[data-accent]`).
- Base font size: 14px (`html { font-size: calc(14px * var(--font-scale)) }`). Tailwind `text-sm` ≈ body, `text-xs` ≈ labels/badges/meta.
- `--radius: 0.5rem`. Borders via token `--border`.

**Atenção — Pitfall 6 (RESEARCH.md):** o Sidebar (`src/components/layout/Sidebar.tsx`) NÃO tem entrada para "benchmark" no array `MODULES`. A Fase 4 DEVE adicionar:
```ts
{ id: "benchmark", icon: BarChart2, label: "Benchmark", route: "/benchmark", implemented: true }
```
Ícone sugerido: `BarChart2` de `lucide-react`. Posicionar após `kb` (segunda posição na lista).

---

## Spacing Scale

Declarados (múltiplos de 4) — herdados das Fases 1–3:

| Token | Value | Tailwind | Usage |
|-------|-------|----------|-------|
| xs | 4px | `gap-1`, `px-1` | Icon gaps, inline padding |
| sm | 8px | `gap-2`, `p-2` | Compact element spacing |
| md | 16px | `gap-4`, `p-4` | Default element spacing |
| lg | 24px | `gap-6`, `p-6` | Section padding |
| xl | 32px | `gap-8`, `p-8` | Layout gaps |
| 2xl | 48px | `gap-12`, `p-12` | Major section breaks |
| 3xl | 64px | `gap-16`, `p-16` | Page-level spacing |

**Exceções herdadas das Fases 1–3:**
- Sidebar width: 48px (`w-12`) — fixo.
- Control height: 36px (`h-9`) para inputs/buttons/selects; 28px (`h-7`) para controles compactos de linha.

**Espaçamentos específicos da Fase 4:**
- Column header height: 44px (`h-11`) — acomoda [Model Select] + [Provider badge] + [× remove] + streaming indicator em linha única.
- Scoring bar height: 52px (`h-[52px]`) — sticky, com 8px de padding vertical (`py-2`) e 16px horizontal (`px-4`); separada do conteúdo de colunas por `border-t border-border`.
- Pre-run config row height: 44px (`h-11`) por linha de modelo (coluna stub); gap de 8px entre linhas.
- Prompt textarea: padding 12px horizontal / 8px vertical (`px-3 py-2`), mínimo 3 linhas de altura.
- Column response area: padding 16px (`p-4`), sem padding extra além do standard.
- History table row: 40px (`h-10`) por linha, 16px padding horizontal (`px-4`) por célula.
- Collapsed panel: `collapsedSize={4}` = 4% da largura total (aproximadamente 40–60px na largura mínima de 800px) — mostra apenas o header da coluna.

---

## Typography

| Role | Size | Weight | Line Height | Tailwind |
|------|------|--------|-------------|---------|
| Body (response text) | 14px | 400 (regular) | 1.5 | `text-sm` |
| Label (badges, meta, status) | 12px | 500 (medium) | 1.4 | `text-xs font-medium` |
| Heading (column header, section title) | 14px | 500 (medium) | 1.4 | `text-sm font-medium` |
| Display (vazio / módulo) | 16px | 500 (medium) | 1.4 | `text-base font-medium` |

**Notas (consistência com Fases 2/3 — NÃO introduzir novos tamanhos):**
- Texto de resposta do LLM renderizado via `MarkdownRenderer` (Fase 2): `text-sm leading-relaxed` — reutilizar sem alteração.
- Column header model name: `text-sm font-medium` (provider badge ao lado: `text-xs font-medium`).
- ToggleGroup scoring bar: labels de modelo em `text-sm font-medium`; "Empate" em `text-sm font-medium`.
- Prompt textarea: `text-sm` peso 400 — mesmo do `MessageInput` da Fase 2.
- History table — prompt truncado: `text-sm` peso 400; model badges: `text-xs font-medium`; data relativa: `text-xs` `text-muted-foreground`.
- Tabs ("Nova sessão" / "Histórico"): `text-sm font-medium` — padrão Radix Tabs.

**Não usar:** peso 600 (semibold) ou `font-semibold` — apenas `font-medium` (500) para ênfase, igual às Fases 2/3. `font-semibold` é reservado para elementos de strong markdown (`<strong>`).

---

## Color

| Role | Value (dark mode) | Usage |
|------|-------------------|-------|
| Dominant (60%) | `hsl(224 71.4% 4.1%)` | Background das colunas de resposta, área do prompt, fundo da tab "Histórico" |
| Secondary (30%) | `hsl(215 27.9% 16.9%)` | Header de cada coluna, scoring bar, sidebar, cards de histórico |
| Accent (10%) | `hsl(263.4 70% 50.4%)` (violeta, default) | **Reservado — ver lista explícita abaixo** |
| Destructive | `hsl(0 62.8% 30.6%)` (dark) / `hsl(0 72.2% 50.6%)` (light) | Somente: botão "×" de remover coluna em hover, estado de erro de coluna |

**Accent reservado para (explícito — nunca "todos os elementos interativos"):**
1. ToggleGroup item **selecionado** (winner escolhido): `data-[state=on]` — `bg-primary text-primary-foreground` (o ToggleGroupItem padrão do shadcn usa `bg-accent` no estado on; override para `bg-primary` para visibilidade).
2. Botão "Iniciar benchmark" (CTA primário) — `variant="default"` do shadcn Button usa `bg-primary`.
3. Focus rings em todos os controles interativos (`ring-2 ring-ring`, onde `--ring` compartilha o hue do accent).
4. Active sidebar icon do módulo benchmark (`ring-2 ring-ring text-primary`).

**NÃO usar accent para:** streaming state indicator (usar `text-muted-foreground` + animation), provider badge, column headers, prompt textarea border, scoring bar background, history table headers, winner badges (usar `variant="default"` do shadcn Badge que usa `bg-primary` — isso é correto e intencional).

**Status de coluna (streaming indicator no column header):**
| Status | Visual | Classes |
|--------|--------|---------|
| `idle` | — (nada) | — |
| `streaming` | `Loader2` 14px, `animate-spin` | `text-muted-foreground animate-spin` |
| `done` | `Check` 14px | `text-muted-foreground` |
| `error` | `AlertCircle` 14px | `text-destructive` |
| `stopped` | `Square` 14px (ícone Stop) | `text-muted-foreground` |

**Winner badge na história (D-04):**
| Estado | Badge variant | Classes adicionais |
|--------|--------------|-------------------|
| Model vencedor | `default` | `bg-primary text-primary-foreground` |
| Empate | `secondary` | — |
| Não avaliado | `outline` | `text-muted-foreground` |

**Scoring bar — estado disabled (enquanto streaming):**
- `ToggleGroup` com `disabled={true}` aplica `data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed` — adicionar essas classes no `toggle-group.tsx`.
- Disabled state: `opacity-50`, cursor `not-allowed`. Sem tooltip "aguardando" — o streaming indicator nas colunas já comunica o estado.

**Tema claro:** herdado dos tokens da Fase 1; a fase otimiza para dark mode mas não pode quebrar o light mode.

---

## Copywriting Contract

Todo o copy em **Português Brasileiro (PT-BR)**. Tom: direto, informativo; erros descrevem o problema + próximo passo.

| Element | Copy |
|---------|------|
| Primary CTA (iniciar run) | "Iniciar benchmark" |
| CTA adicionar coluna | "+ Modelo" |
| CTA remover coluna (tooltip) | "Remover coluna" |
| Tab 1 label | "Nova sessão" |
| Tab 2 label | "Histórico" |
| Prompt textarea placeholder | "Digite o prompt para comparar os modelos..." |
| Column header — model picker placeholder | "Selecionar modelo" |
| Streaming indicator tooltip | "Gerando resposta..." |
| Done indicator tooltip | "Resposta completa" |
| Stop column button tooltip | "Parar esta coluna" |
| Scoring bar label (pré-seleção) | "Qual resposta foi melhor?" |
| Scoring bar — Empate option | "Empate" |
| Scoring bar — scored state label | "Avaliação registrada" |
| Empty state heading (Nova sessão sem run) | "Compare modelos lado a lado" |
| Empty state body | "Selecione dois ou mais modelos, digite um prompt e inicie o benchmark para ver as respostas em paralelo." |
| History empty state heading | "Nenhum benchmark registrado" |
| History empty state body | "Inicie sua primeira sessão na aba \"Nova sessão\"." |
| Error state — coluna com falha | "Erro ao gerar resposta. Tente novamente." |
| Error state — modelo não configurado | "Modelo sem chave de API configurada. Acesse Configurações." |
| Error state — stream interrupted (stop) | "Resposta interrompida." |
| Destructive — remover coluna (< 2 colunas) | Desabilitar botão "×" quando restariam < 2 colunas — sem confirmação (não-destrutivo). |
| History table — prompt column header | "Prompt" |
| History table — models column header | "Modelos" |
| History table — winner column header | "Vencedor" |
| History table — date column header | "Data" |
| Winner badge — empate text | "Empate" |
| Winner badge — não avaliado text | "Não avaliado" |
| Toast — benchmark salvo | "Avaliação registrada." |
| Max columns reached tooltip | "Máximo de 4 modelos por sessão." |

**Regras de copy:**
- Labels de modelo: usar o nome do modelo tal como retornado por `PROVIDER_LABELS` / `getModelLabel()` — não truncar em badges de histórico.
- Prompt truncado na tabela: 60 chars + "…" com full text no tooltip (`Tooltip` do shadcn, side="top").
- Data relativa: `date-fns formatDistanceToNow` em PT-BR (`{ locale: ptBR }`); full timestamp no tooltip.

---

## Component Inventory

### Reutilizados (já em `src/components/ui/` das Fases 1–3 — zero novas deps de componentes)

| Component | Source | Uso na Fase 4 |
|-----------|--------|---------------|
| Resizable (PanelGroup / Panel / Handle) | `src/components/ui/resizable.tsx` | N colunas de resposta (D-01) — `ResizablePanelGroup orientation="horizontal"` |
| Select | `src/components/ui/select.tsx` | Per-column model picker (D-02) — reutilizar o mesmo componente do `MessageInput` |
| Badge | `src/components/ui/badge.tsx` | Model badges + winner badges na história (D-04) |
| Table | `src/components/ui/table.tsx` | History tab — `shadcn/ui Table` (D-04) |
| Tooltip | `src/components/ui/tooltip.tsx` | Prompt truncado, streaming indicator, stop button, max-columns |
| Button | `src/components/ui/button.tsx` | "Iniciar benchmark", "+ Modelo", "×" remover coluna |
| Scroll-Area | `src/components/ui/scroll-area.tsx` | Scrolling dentro de cada coluna de resposta; history table |
| Separator | `src/components/ui/separator.tsx` | Entre prompt area e colunas; entre scoring bar e colunas |

### Novos componentes shadcn necessários (adicionar a `src/components/ui/` via cópia manual)

| Component | Shadcn Source | Purpose |
|-----------|--------------|---------|
| Tabs | `https://ui.shadcn.com/docs/components/tabs` | Tab "Nova sessão" / "Histórico" (D-04) — `@radix-ui/react-tabs@1.1.15` |
| Toggle | `https://ui.shadcn.com/docs/components/toggle` | Peer obrigatório do ToggleGroup |
| Toggle-Group | `https://ui.shadcn.com/docs/components/toggle-group` | Scoring bar com seleção única (D-03) — `@radix-ui/react-toggle-group@1.1.13` |

**Método de instalação:** Adicionar manualmente o source dos componentes shadcn a `src/components/ui/tabs.tsx`, `toggle.tsx`, `toggle-group.tsx`. Instalar as primitivas Radix via pnpm:
```bash
pnpm add @radix-ui/react-tabs @radix-ui/react-toggle-group @radix-ui/react-toggle
```

**Nenhum registry de terceiros.** Vetting gate: não aplicável.

### Componentes existentes modificados

| Component | Mudança |
|-----------|---------|
| `Sidebar.tsx` | Adicionar entrada `benchmark` ao array `MODULES` com `icon: BarChart2`, `route: "/benchmark"`, `implemented: true`. Importar `BarChart2` de `lucide-react`. |
| `toggle-group.tsx` (novo) | Adicionar `data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed` no ToggleGroupItem para visual de estado disabled. |

### Componentes de feature novos (em `src/routes/benchmark/-components/`)

| Component | Responsabilidade |
|-----------|-----------------|
| `BenchmarkPrompt.tsx` | Prompt textarea + model selector stubs pré-run + botão "Iniciar benchmark" |
| `BenchmarkColumns.tsx` | `ResizablePanelGroup` com N `BenchmarkColumn` intercalados com `ResizableHandle` |
| `BenchmarkColumn.tsx` | Header (model picker + provider badge + streaming indicator + stop + × ) + `MarkdownRenderer` para resposta |
| `ScoringBar.tsx` | `ToggleGroup` sticky com auto-enable quando `allDone`, persistência do winner |
| `BenchmarkHistory.tsx` | shadcn `Table` com rows de sessões passadas |

### Biblioteca de terceiros (npm — frontend)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| date-fns | 4.4.0 (instalado) | `formatDistanceToNow` com locale ptBR na história | Já instalado |
| react-resizable-panels | 4.11.2 (instalado) | N colunas resizáveis | Já instalado |
| @radix-ui/react-tabs | 1.1.15 | Tabs primitiva (nova) | Instalar |
| @radix-ui/react-toggle-group | 1.1.13 | ToggleGroup primitiva (nova) | Instalar |
| @radix-ui/react-toggle | (peer) | Peer do toggle-group (nova) | Instalar junto |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official (v4 Radix registry) | tabs, toggle, toggle-group | not required (registry oficial) |

**Nenhum registry de terceiros declarado.** Vetting gate: não aplicável.

---

## Layout Structure

### Benchmark Module (`/benchmark` route)

```
┌─────────────────────────────────────────────────────────────────────┐
│ [Sidebar 48px] │ [Benchmark Module]                                   │
│                │  ┌─ "Nova sessão" ──────────────────────────────┐   │
│ [Chat]         │  │ [Tab: Nova sessão] [Tab: Histórico]           │   │
│ [KB]           │  ├──────────────────────────────────────────────┤   │
│ [Benchmark◀]  │  │ [Prompt textarea, 3 linhas]            [Iniciar]  │
│ [Gmail]        │  │                                               │   │
│ [Calendar]     │  ├── [separator] ─────────────────────────────┤   │
│ [MCP]          │  │                                               │   │
│ [Agents]       │  │  ┌──Col A──┬──│──┬──Col B──┐               │   │
│                │  │  │[GPT-4.1]│  │  │[Claude] │               │   │
│ [Settings]     │  │  │[⟳ ]    │  │  │[✓ ]     │               │   │
│                │  │  │─────────│  │  │─────────│               │   │
│                │  │  │Resposta │  │  │Resposta │               │   │
│                │  │  │markdown │  │  │markdown │               │   │
│                │  │  │streaming│  │  │         │               │   │
│                │  │  └─────────┴──┴──┴─────────┘               │   │
│                │  ├── [separator] ─────────────────────────────┤   │
│                │  │ [GPT-4.1] | [Empate] | [Claude]    sticky  │   │
│                │  └───────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Pre-run state (seleção de modelos antes de iniciar)

```
┌──────────────────────────────────────────────────────┐
│ [Tab: Nova sessão]  [Tab: Histórico]                  │
├──────────────────────────────────────────────────────┤
│ [Prompt textarea (vazia)]                  [Iniciar] │
│                                                       │
│  ┌─ Modelos (2–4) ─────────────────────────────────┐ │
│  │ [Select: Modelo A ▾]                      [×]   │ │
│  │ [Select: Modelo B ▾]                      [×]   │ │
│  │                                                 │ │
│  │              [+ Modelo]                         │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

- Model selectors ficam **abaixo do prompt**, não no header das colunas (colunas só existem após "Iniciar benchmark").
- "×" desabilita quando restariam < 2 colunas.
- "+ Modelo" aparece apenas quando < 4 colunas.
- "Iniciar" é `disabled` se prompt vazio ou qualquer modelo não selecionado.

### Running state (N colunas ativas)

```
┌──────────────────────────────────────────────────────────┐
│ [Tab: Nova sessão*]  [Tab: Histórico]                      │
├──────────────────────────────────────────────────────────┤
│ [Prompt read-only, single-line display]      [Nova sessão]│
├──────────────────────────────────────────────────────────┤
│ ┌───Col A (50%)───┬──│──┬───Col B (50%)────┐             │
│ │ [Modelo A ▾]  ⟳ [■]│  │ [Modelo B ▾]  ✓    │             │
│ ├────────────────┤   │  ├────────────────┤             │
│ │ Resposta A     │   │  │ Resposta B     │             │
│ │ (streaming)    │   │  │ (completa)     │             │
│ │ [scroll]       │   │  │ [scroll]       │             │
│ └────────────────┴───┴──┴────────────────┘             │
├──────────────────────────────────────────────────────────┤
│ [Modelo A] | [Empate] | [Modelo B]   (scoring bar sticky) │
└──────────────────────────────────────────────────────────┘
```

**Restrições de layout:**
- Sidebar: 48px fixo (herdado).
- Prompt display: single-line read-only quando running (não editar durante streaming).
- Colunas: `defaultSize={Math.floor(100/N)}`, `minSize={15}`, `collapsible={true}`, `collapsedSize={4}`.
- Scoring bar: sticky na base, `border-t border-border`, `bg-secondary` — sempre visível, `disabled` durante streaming.
- Janela mínima: 800px (desktop-only).
- `ResizablePanelGroup orientation="horizontal"` — usar a API v4 correta via `resizable.tsx` (não importar diretamente de `react-resizable-panels`).

### History tab

```
┌────────────────────────────────────────────────────────────────┐
│ [Tab: Nova sessão]  [Tab: Histórico*]                            │
├────────────────────────────────────────────────────────────────┤
│ Prompt                    │ Modelos          │ Vencedor  │ Data │
│───────────────────────────────────────────────────────────────│
│ "Explique o que é IA..."  │ [gpt-4.1][claude]│ [gpt-4.1] │ 2h  │
│ "Escreva um email de..."  │ [gemini][gpt-4.1]│ [Empate]  │ 5h  │
│ "Liste os benefícios..."  │ [gpt-4.1][claude]│[Não aval.]│ 1d  │
└────────────────────────────────────────────────────────────────┘
```

---

## Interaction Patterns

### Fluxo de benchmark (BENCH-01)

1. Usuário acessa `/benchmark` — exibe **pre-run state** com 2 colunas pré-preenchidas com defaults de Settings (FOUND-02).
2. Usuário digita o prompt no textarea e ajusta os modelos (pode adicionar até 4, remover até 2 mínimo).
3. Clica "Iniciar benchmark" — **running state** monta `ResizablePanelGroup` com N painéis; cada coluna cria seu `Channel<StreamEvent>` e chama `invoke('stream_chat', ...)` de forma independente.
4. Colunas streamam em paralelo; streaming indicator no header de cada coluna mostra estado (`Loader2` giratório / `Check` / `AlertCircle`).
5. Usuário pode **colapsar** uma coluna arrastando para `collapsedSize=4%` — coluna recolhida mostra apenas o header.
6. Usuário pode **parar** uma coluna individual via botão `■` no header (chama `stop_streaming` com `syntheticId`).
7. Ao completar (todas as colunas `done` ou `error`), scoring bar habilita automaticamente.

### Scoring (BENCH-02)

1. Scoring bar auto-habilita quando `allDone = true` (computado como selector — todas as colunas `done | error`).
2. Usuário clica no nome do modelo vencedor ou "Empate" no `ToggleGroup`.
3. `setWinner(modelId | null)` → salva no SQLite via Drizzle + invalida query de histórico.
4. Scoring bar mostra estado "Avaliação registrada" após seleção; ToggleGroup fica `disabled` após scoring (evita re-score acidental).
5. Toast: "Avaliação registrada." (sonner — já instalado da Fase 3).

### Nova sessão

- Botão "Nova sessão" (disponível durante running state) retorna ao **pre-run state** — `benchmarkStore.resetSession()`, limpa colunas e scoring.
- Não solicita confirmação se scoring já foi feito; se scoring não foi feito, não interrompe — a sessão fica "Não avaliado" no histórico.

### History tab

- Clicar na tab "Histórico" faz fetch via `useBenchmarkHistory()` (TanStack Query, `staleTime: 30s`).
- 100 sessões mais recentes (flat list — sem paginação na v1).
- Prompt truncado a 60 chars; tooltip mostra texto completo.
- Data relativa via `formatDistanceToNow` + locale `ptBR`; tooltip mostra timestamp absoluto.

---

## States

### Column states

| State | Streaming indicator | Scoring bar | Stop button |
|-------|--------------------|-----------|----|
| `idle` | — | disabled | hidden |
| `streaming` | `Loader2` animate-spin | disabled | visible (`■`) |
| `done` | `Check` (muted) | enabled quando allDone | hidden |
| `error` | `AlertCircle` (destructive) | enabled quando allDone | hidden |
| `stopped` | `Square` (muted) | enabled quando allDone | hidden |

### Scoring bar states

| State | Visual |
|-------|--------|
| `disabled` (streaming ativo) | `opacity-50 cursor-not-allowed` |
| `enabled` (allDone, não scored) | Interativo; label "Qual resposta foi melhor?" |
| `scored` | Winner item selected (`data-[state=on]`); `disabled={true}`; label "Avaliação registrada" |

### Module states

| State | View |
|-------|------|
| Pre-run (sem sessão ativa) | Prompt + model selectors + "Iniciar" + empty state copy |
| Running | Colunas streamando + scoring bar disabled |
| Run complete, not scored | Colunas com conteúdo + scoring bar enabled |
| Run complete, scored | Colunas com conteúdo + scoring bar disabled + "Avaliação registrada" |
| Histórico vazio | Empty state "Nenhum benchmark registrado" |
| Histórico populado | Tabela de sessões |

---

## Accessibility

- **Keyboard navigation:** Tabs ("Nova sessão"/"Histórico") acessíveis via setas — Radix Tabs handle isso nativamente. ToggleGroup: navegação por setas horizontais, confirmação com Enter/Space.
- **ToggleGroup disabled state:** `aria-disabled="true"` propagado automaticamente pelo Radix quando `disabled={true}`.
- **Column headers:** model picker `Select` deve ter `aria-label="Modelo da coluna {N}"` para leitores de tela distinguirem as colunas.
- **Streaming indicator:** ícones carry `aria-label` — `Loader2`: `aria-label="Gerando resposta"`, `Check`: `aria-label="Resposta completa"`, `AlertCircle`: `aria-label="Erro na resposta"`.
- **Stop button:** `aria-label="Parar esta coluna"`.
- **Focus rings:** todos os controles usam `ring-2 ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`.
- **Cor não é o único sinal:** streaming indicator combina ícone + `aria-label`; scored state do ToggleGroup usa `data-[state=on]` visual + aria checked state.
- **Contraste:** WCAG AA — todos os textos sobre `bg-secondary` e `bg-background` verificados com os tokens existentes da Fase 1.
- **Collapsed panel:** painel colapsado via `ResizablePanel collapsible` mantém o header focável; `collapsedSize={4}` garante área mínima de 40px+ para interação.

---

## Responsive Behavior

Desktop-only (Windows + macOS via Tauri). Sem breakpoints mobile.

- **Janela mínima:** 800px (sidebar 48px + 2 colunas de 15% mínimo cada + handles).
- Com N=4 colunas: mínimo `4 × 15% = 60%` das colunas usadas, handles entre elas; usuário deve colapsar colunas menores para conforto de leitura — é esperado e suportado.
- Scoring bar em qualquer N: `ToggleGroup` usa `flex-wrap` para N>2 se necessário (modelos com nomes longos).
- History table: colunas "Modelos" e "Data" podem truncar; "Prompt" tem prioridade de espaço.

---

## Animation

Reutilizar vocabulário de motion das Fases 1–3 — não introduzir novos easings.

- **Streaming tokens:** append de texto inline, sem animação (mesma abordagem do `MessageBubble` da Fase 2).
- **Streaming indicator:** `Loader2` com `animate-spin` (contínuo, Tailwind default).
- **Column collapse/expand:** imediato (sem animação — react-resizable-panels v4 não anima colapso por padrão).
- **Scoring bar enable:** 200ms `transition-opacity` de `opacity-50` → `opacity-100`.
- **Tab switch:** Radix Tabs default (sem animação customizada).
- **Toast "Avaliação registrada":** sonner defaults (slide + fade).
- **History row load:** nenhuma animação — flat list aparece diretamente.
- **"Iniciar benchmark":** sem loading spinner no botão — as colunas comunicam o estado visualmente através do streaming indicator.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
