# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-25
**Phase:** 01-foundation
**Areas discussed:** App Shell Layout, Settings UI, Appearance Customization, CI / Distribution

---

## App Shell Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar vertical estreita com ícones | Coluna de ícones sem labels, padrão VS Code/Slack/Linear | ✓ |
| Sidebar com ícones + labels | Coluna mais larga tipo Notion/Obsidian | |
| Top tab bar | Abas horizontais no topo | |

**User's choice:** Sidebar vertical estreita com ícones

---

| Option | Description | Selected |
|--------|-------------|----------|
| Linear / Raycast — dark, minimal, rápido | Interface escura por padrão, bordas definidas, power-tool | ✓ |
| Claude.ai / ChatGPT — clean, conversacional | Background neutro, foco na conversa | |
| VS Code / Obsidian — dark, denso, power-user | Dark, denso, altamente configurável | |
| Sem referência — Claude decide | Estilo moderno com shadcn/ui | |

**User's choice:** Linear / Raycast — dark, minimal, rápido

---

| Option | Description | Selected |
|--------|-------------|----------|
| Visíveis mas desabilitados com tooltip 'Em breve' | Todos os ícones aparecem, não implementados mostram placeholder | ✓ |
| Só os módulos ativos aparecem | Sidebar minimalista — apenas Settings na Phase 1 | |
| Claude decide | Qualquer abordagem para o scaffolding | |

**User's choice:** Visíveis mas desabilitados com tooltip 'Em breve'
**Notes:** Intenção explícita: o app deve parecer um produto completo desde o Phase 1.

---

## Settings UI

| Option | Description | Selected |
|--------|-------------|----------|
| Rota dedicada na sidebar (ícone de engrenagem) | Settings como módulo na sidebar, abre no painel principal | ✓ |
| Janela modal separada (Cmd+,) | Settings em janela/overlay separada | |
| Painel lateral slidável (drawer) | Drawer deslizando pela direita | |

**User's choice:** Rota dedicada na sidebar (ícone de engrenagem)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Sub-navegação lateral dentro da página | Mini-sidebar com seções: API Keys, Modelos, Aparência | ✓ |
| Página única com seções por heading | Scroll vertical único | |
| Abas horizontais (tabs) | Tabs no topo da settings page | |

**User's choice:** Sub-navegação lateral dentro da página

---

| Option | Description | Selected |
|--------|-------------|----------|
| Campo mascarado (***) com botão 'Editar' | Mostra que chave está salva sem expor o valor | ✓ |
| Sempre mascarado, sem opção de ver | Badge verde/vermelho apenas | |
| Botão 'revelar' para mostrar a chave | Expõe a chave sob demanda | |

**User's choice:** Campo mascarado (***) com botão 'Editar'

---

## Appearance Customization (FOUND-03 Scope)

| Option | Description | Selected |
|--------|-------------|----------|
| Só light/dark toggle | Apenas toggle de tema | |
| Light/dark + cor de destaque | Toggle + seletor de acento | |
| Light/dark + escala de fonte | Toggle + tamanho de fonte | |
| Light/dark + escala de fonte + cor de destaque (Other) | Todos os três controles na Phase 1 | ✓ |

**User's choice (free text):** "seria light/dark + escala de font + cor de destaque"
**Notes:** Escopo ampliado explicitamente pelo usuário — todos os três controles na Phase 1.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Paleta predefinida (5-6 cores) | Seletor de bolas coloridas, evita cores ilegíveis | ✓ |
| Color picker livre | Qualquer cor hex | |
| Claude decide | Qualquer abordagem com shadcn/ui | |

**User's choice:** Paleta predefinida (5-6 cores)

---

## CI / Distribution

| Option | Description | Selected |
|--------|-------------|----------|
| Tenho Apple Developer ID, mas Windows EV não | macOS first, Windows signing posterior | |
| Tenho ambos os certificados | Pipeline completo agora | |
| Não tenho nenhum ainda | Certs a obter | ✓ |
| Preciso entender melhor | Explicação do processo | |

**User's choice:** Não tenho nenhum ainda

---

| Option | Description | Selected |
|--------|-------------|----------|
| Configurar pipeline sem signing, documentar o processo | GitHub Actions funcionando + vars documentadas | ✓ |
| Postergar FOUND-07/08 para uma sub-fase | Phase 1.1 para signing | |
| Bloquear Phase 1 até obter certificados | Não começar sem tudo pronto | |

**User's choice:** Configurar pipeline sem signing, documentar o processo

---

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions | Padrão do ecossistema Tauri, macOS runners disponíveis | ✓ |
| Outro (especificar) | Outra plataforma | |

**User's choice:** GitHub Actions

---

## Claude's Discretion

- Ícones exatos da sidebar (Lucide icons)
- Estrutura de crates Rust (plugin-per-module)
- Configuração WAL e connection pool size do SQLite
- Implementação do Channel API pattern (lado Rust)
- Setup do Drizzle ORM e migrations
- Implementação da escala de fonte (CSS variables, rem)
- Geração e formato de backup do updater keypair (FOUND-07)

## Deferred Ideas

- Custom themes além de light/dark/accent (OLED, high-contrast) — Phase 8 polish ou v2
- Color picker livre — v2 backlog
- Linux build — fora de escopo
- Atalhos de teclado customizáveis — v2
- Signing ativo no CI — aguardando certificados (infra pronta na Phase 1)
