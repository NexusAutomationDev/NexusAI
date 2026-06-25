# Phase 1: Foundation - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the app shell and foundational infrastructure that every subsequent module builds on: Tauri v2 scaffold with plugin-per-module architecture, SQLite in WAL mode with connection pooling, OS Keychain for secret storage, Channel API streaming pattern, a Settings UI with API key management and appearance customization, and a GitHub Actions CI pipeline with build automation (signing infrastructure documented but not yet active — certificates pending).

No LLM chat, no knowledge base, no email/calendar — those are Phase 2+. The only user-facing feature is the Settings module and the app shell itself.

</domain>

<decisions>
## Implementation Decisions

### App Shell Layout
- **D-01:** Sidebar navigation — vertical, narrow icon-only column on the left. No text labels next to icons (VS Code / Linear pattern). Icons for each module: Chat, KB, Gmail, Calendar, MCPs, Agents, Settings.
- **D-02:** Visual aesthetic: dark-first, minimal, sharp — reference is Linear / Raycast. Not Electron-gray. Not clipboard-app. Power-tool feel.
- **D-03:** Module stubs visible but disabled in Phase 1 — all module icons appear in the sidebar but non-implemented modules show a "Em breve" (Coming soon) tooltip on hover/click. This makes the app look complete from day 1 without implementing anything prematurely.

### Settings UI
- **D-04:** Settings is a dedicated route in the sidebar — gear icon at the bottom of the sidebar column, navigates to the Settings page in the main content area. NOT a separate window or modal overlay. Follows the same navigation pattern as all other modules.
- **D-05:** Within the Settings page: sub-navigation sidebar pattern (mini left nav inside the settings page) with sections: API Keys | Models | Appearance. Scales well for future settings additions.
- **D-06:** API key fields: masked (***) by default with an "Editar" button to clear and re-enter. No "reveal" button — keys stored in OS Keychain should not be exposed in plaintext to the UI. Badge (green/red) indicates whether a key is configured.

### Appearance Customization (FOUND-03 Scope)
- **D-07:** Phase 1 includes three appearance controls: (1) light/dark toggle, (2) font scale selector, (3) accent color picker.
- **D-08:** Accent color: predefined palette of 5–6 colors (not a free color picker). Prevents low-contrast or illegible color choices. Colors must be validated for accessibility with the dark and light themes.
- **D-09:** All three appearance settings persist across app restarts (stored in SQLite or Tauri's store plugin — planner's discretion).

### CI / Distribution Pipeline
- **D-10:** CI platform: GitHub Actions. Standard for Tauri ecosystem — use official `tauri-apps/tauri-action` workflow.
- **D-11:** Signing certificates not yet available (neither Apple Developer ID nor Windows EV). Phase 1 delivers: build pipeline working (unsigned), signing variables documented as secrets placeholders in the workflow YAML, and a SIGNING.md doc explaining the process to obtain and configure them. FOUND-07/FOUND-08 are treated as "infrastructure ready, certificate pending."
- **D-12:** Build targets: macOS (arm64 + x86_64 universal) and Windows (x64). Both platforms built in CI even without signing. Linux excluded from scope.

### Claude's Discretion
- Exact icon set for the sidebar (can use Lucide icons as they're shadcn/ui standard)
- Internal Rust module structure (plugin-per-module crate layout)
- SQLite WAL configuration specifics and connection pool size
- Channel API implementation pattern (Rust side)
- Drizzle ORM setup and migration approach
- Font scale implementation (CSS variable, rem-based)
- Updater keypair generation and backup format (FOUND-07)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Foundation & Settings (FOUND-01 through FOUND-08) — all 8 requirements mapped to this phase; success criteria are the acceptance bar
- `.planning/ROADMAP.md` §Phase 1 — goal, success criteria, and UI hint

### Architecture (from CLAUDE.md)
- `CLAUDE.md` §Technology Stack — full recommended stack with rationale; locked decisions for React 19 + Vite, shadcn/ui + Tailwind 4, Zustand 5, TanStack Query 5, rusqlite + sqlite-vec, Drizzle ORM proxy, tauri-specta, OS Keychain (keyring crate)
- `CLAUDE.md` §Critical Architecture Constraint: The Tauri Webview Boundary — Channel API, CORS constraints, key security model
- `CLAUDE.md` §Key Risks and Mitigations — distribution pipeline sharp edges flagged

### No external ADRs yet — requirements fully captured in decisions above

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield. No existing components, hooks, or utilities.

### Established Patterns
- None yet — this phase establishes the patterns all other phases inherit.
- Key patterns to establish: Channel API streaming template, Tauri IPC command structure (with tauri-specta type generation), SQLite connection/migration setup, OS Keychain read/write via `keyring` crate.

### Integration Points
- All future modules (Chat, KB, Gmail, etc.) will integrate at: sidebar navigation registration, SQLite schema migrations, and shared Zustand store slices.
- Settings module owns: API key storage API (Rust command), theme/appearance state (Zustand + persistence), and model-selection state.

</code_context>

<specifics>
## Specific Ideas

- **Visual reference:** Linear and Raycast. Dark-first, minimal borders, high information density, feels like a power tool. Not a consumer app.
- **Stubs:** The app should visually feel like a complete product shell from Phase 1 — all module icons present, greyed out with tooltips. This is intentional.
- **Settings gear icon:** Bottom of the sidebar column (below all module icons), standard desktop app convention.
- **Accent color palette:** 5–6 options; should include NexusAI's default (likely indigo or violet to fit the AI aesthetic), plus blue, green, orange, and red variants.

</specifics>

<deferred>
## Deferred Ideas

- Custom theme variants beyond light/dark/accent (e.g., OLED pitch-black, high-contrast) — potential v2 or Phase 8 polish
- Fully custom color picker (vs predefined palette) — v2 backlog
- Linux build support — out of scope per PROJECT.md
- Keyboard shortcut customization — v2 requirement (explicitly deferred in REQUIREMENTS.md)
- Signing/notarization active in CI — blocked on certificate acquisition; infra ready in Phase 1, activated when certs obtained

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-06-25*
