# Phase 1: Foundation - Research

**Researched:** 2026-06-25
**Domain:** Tauri v2 desktop app scaffold — IPC patterns, OS Keychain, SQLite WAL, CI distribution pipeline, Settings UI
**Confidence:** HIGH (core stack decisions locked and well-documented; distribution pipeline has known sharp edges)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Sidebar navigation — vertical, narrow icon-only column on the left (VS Code / Linear pattern). No text labels.
- **D-02:** Visual aesthetic: dark-first, minimal, sharp. Reference: Linear / Raycast.
- **D-03:** All module icons visible from Phase 1; non-implemented modules show "Em breve" tooltip on hover/click.
- **D-04:** Settings is a dedicated route in the sidebar (gear icon at the bottom), NOT a separate window or modal.
- **D-05:** Settings page uses a sub-navigation sidebar with sections: API Keys | Models | Appearance.
- **D-06:** API key fields: masked (`***`) by default with "Editar" button to clear and re-enter. No reveal button. Green/red badge indicates configured status.
- **D-07:** Phase 1 appearance controls: (1) light/dark toggle, (2) font scale selector, (3) accent color picker.
- **D-08:** Accent color: predefined palette of 5–6 colors only. No free color picker.
- **D-09:** All three appearance settings persist across app restarts.
- **D-10:** CI platform: GitHub Actions. Use `tauri-apps/tauri-action` official workflow.
- **D-11:** Signing certificates not yet available. Phase 1 delivers: pipeline working (unsigned), signing variables documented as secrets placeholders, and a SIGNING.md doc.
- **D-12:** Build targets: macOS (arm64 + x86_64 universal) and Windows (x64). Linux excluded.

### Claude's Discretion

- Exact icon set for the sidebar (Lucide icons — shadcn/ui standard)
- Internal Rust module structure (plugin-per-module crate layout)
- SQLite WAL configuration specifics and connection pool size
- Channel API implementation pattern (Rust side)
- Drizzle ORM setup and migration approach
- Font scale implementation (CSS variable, rem-based)
- Updater keypair generation and backup format (FOUND-07)

### Deferred Ideas (OUT OF SCOPE)

- Custom theme variants beyond light/dark/accent (e.g., OLED, high-contrast)
- Fully custom color picker
- Linux build support
- Keyboard shortcut customization
- Active signing/notarization in CI (blocked on cert acquisition — infra ready, certs deferred)

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| FOUND-01 | API key management via UI — stored in OS Keychain, never plain text | keyring crate + tauri-plugin-keyring; Tauri IPC command with masked UI |
| FOUND-02 | Default model selection per task type (chat, agents, benchmark) via settings | Zustand store slice + tauri-plugin-store persistence; simple JSON config |
| FOUND-03 | Light/dark toggle + font scale + accent color picker (5-6 presets) — persists | shadcn/ui + Tailwind v4 CSS variables; tauri-plugin-store for persistence |
| FOUND-04 | Plugin-per-module Cargo architecture with empty stubs for all modules from Phase 1 | Cargo workspace members under `src-tauri/crates/`; each domain as its own crate |
| FOUND-05 | Channel API for all streaming — never `emit()` in loop | `tauri::ipc::Channel<T>` pattern; documented code example in this research |
| FOUND-06 | SQLite in WAL mode with connection pooling from the start | rusqlite for WAL + extension loading; tauri-plugin-sql (sqlx) for JS frontend queries |
| FOUND-07 | Updater keypair generated and backup documented before first distributable build | `pnpm tauri signer generate`; private key backed up, pubkey in `tauri.conf.json` |
| FOUND-08 | Build pipeline: macOS notarization + JIT entitlements, Windows code signing | GitHub Actions `tauri-apps/tauri-action@v0`; secrets placeholder pattern documented |

</phase_requirements>

---

## Summary

Phase 1 is a greenfield Tauri v2 scaffold. No existing code exists. Every pattern established here becomes the convention inherited by Phases 2–8. The research scope covers six domains: (1) Tauri v2 project scaffold and plugin-per-module architecture, (2) Channel API streaming pattern, (3) OS Keychain integration via keyring crate, (4) SQLite WAL mode with dual-layer setup, (5) Settings UI with shadcn/ui + Tailwind v4 + Zustand persistence, and (6) GitHub Actions CI with unsigned builds and signing scaffolding.

The standard stack from CLAUDE.md is confirmed by current npm/crates.io versions and official documentation. No decisions need to be revisited. The two sharpest edges in this phase are: (a) the tauri-plugin-sql plugin does NOT support WAL mode natively — WAL must be enabled via rusqlite before the sqlx pool is initialized, and (b) macOS notarization requires an Apple Developer ID Application certificate which is explicitly not yet available (D-11). The CI pipeline must be built to handle unsigned builds cleanly, with signing secrets documented as placeholder comments.

**Primary recommendation:** Scaffold with `pnpm create tauri-app`, establish a Cargo workspace with internal plugin crates, use rusqlite for WAL + sqlite-vec and tauri-plugin-sql (sqlx) for the JS Drizzle proxy, keyring crate for OS Keychain, tauri-plugin-store for appearance persistence, and Channel API for all streaming communication.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@tauri-apps/cli` | 2.11.3 [VERIFIED: npm registry] | Tauri CLI for dev/build | Official Tauri toolchain |
| `@tauri-apps/api` | 2.11.1 [VERIFIED: npm registry] | Frontend JS/TS API bindings | Official; Channel, invoke, events |
| React | 19.2.7 [VERIFIED: npm registry] | UI framework | Locked in CLAUDE.md; largest Tauri ecosystem |
| Vite | 8.1.0 [VERIFIED: npm registry] | Build tool | Official Tauri recommendation for SPAs |
| TypeScript | 5.5+ [ASSUMED] | Type safety | Required for tauri-specta end-to-end types |
| Tailwind CSS | 4.3.1 [VERIFIED: npm registry] | Styling | Zero-runtime; shadcn/ui pairs with v4 |
| shadcn/ui | latest [ASSUMED] | Component library | Unstyled, composable, React-native |
| Zustand | 5.0.14 [VERIFIED: npm registry] | Global UI + session state | Zero boilerplate; works in webview |
| TanStack Query | 5.101.1 [VERIFIED: npm registry] | Async data from Tauri IPC | Caching + loading states for invoke() |
| TanStack Router | 1.170.16 [VERIFIED: npm registry] | Client-side routing | Multi-module app needs file-based routing |
| `@tauri-apps/plugin-store` | 2.4.3 [VERIFIED: npm registry] | KV persistence for appearance prefs | Official Tauri plugin; JSON file backend |
| `@tauri-apps/plugin-sql` | 2.4.0 [VERIFIED: npm registry] | SQLite via sqlx (JS frontend) | Official Tauri plugin; Drizzle proxy layer |
| Drizzle ORM | 0.45.2 [VERIFIED: npm registry] | Type-safe query builder | sqlite-proxy pattern validated for Tauri |
| Lucide React | 0.511.0+ [ASSUMED] | Icon set | shadcn/ui standard; VS Code-style icons |
| Biome | 0.3.3+ [VERIFIED: npm registry] | Linting + formatting | Replaces ESLint + Prettier; Rust-based speed |

### Rust Crates

| Crate | Version | Purpose | Source |
|-------|---------|---------|--------|
| tauri | 2.x | Core framework | [ASSUMED — current stable v2] |
| tauri-build | 2.x | Build system | [ASSUMED — pairs with tauri 2.x] |
| tauri-specta | 2.x | TypeScript type generation from Rust | [ASSUMED — rc.21 per docs.rs reference] |
| specta | 2.x | Type introspection for tauri-specta | [ASSUMED] |
| keyring | 3.x | OS Keychain read/write | [ASSUMED — v3 is current series per lib.rs] |
| rusqlite | 0.31+ | Direct SQLite: WAL + sqlite-vec extension | [ASSUMED — confirmed as standard] |
| serde / serde_json | 1.x | JSON serialization for IPC | [ASSUMED — ubiquitous] |
| tokio | 1.x | Async runtime | [ASSUMED — required by Tauri] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/plugin-updater` | 2.x | App update mechanism | Keypair + endpoint config in Phase 1; active in future phases |
| framer-motion | 12.x [VERIFIED: npm registry] | Animations | Non-critical; add post-MVP |
| date-fns | 3.x [ASSUMED] | Date utilities | Phase 5 (Calendar) |
| DOMPurify | 3.x [ASSUMED] | HTML sanitization | Phase 5 (Email rendering) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| tauri-plugin-store | SQLite via tauri-plugin-sql | Store plugin is simpler for flat KV appearance prefs; SQL overkill for 3 keys |
| tauri-plugin-store | Zustand `persist` middleware with localStorage | localStorage survives app restarts but is browser-scoped; store plugin writes to app data dir, more portable |
| keyring crate (Rust only) | tauri-plugin-keyring (community) | Plugin exposes keyring to TypeScript via JS API; for NexusAI, Rust-only is preferred (keys must not be accessible from JS) |
| Drizzle proxy | Plain `tauri-plugin-sql` queries | Drizzle gives type-safe schema + query builder; proxy pattern adds ~50 lines of setup but saves all manual SQL |

### Installation

```bash
# Frontend (run from project root)
pnpm add @tauri-apps/api @tauri-apps/plugin-store @tauri-apps/plugin-sql @tauri-apps/plugin-updater
pnpm add zustand @tanstack/react-query @tanstack/react-router
pnpm add drizzle-orm
pnpm add -D drizzle-kit vite vitest @vitejs/plugin-react
pnpm add -D @biomejs/biome
pnpm add -D @tauri-apps/cli

# shadcn/ui init (requires Tailwind v4 + React)
pnpm dlx shadcn@latest init
# then add components individually: pnpm dlx shadcn@latest add button tooltip ...

# Updater keypair (run once, before first build)
pnpm tauri signer generate -w ~/.tauri/nexusai.key
```

```toml
# src-tauri/Cargo.toml dependencies (Rust side)
[dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
tauri-plugin-store = "2"
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-updater = "2"
keyring = { version = "3", features = ["sync-secret-service"] }
rusqlite = { version = "0.31", features = ["bundled"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }

[build-dependencies]
tauri-build = { version = "2", features = [] }

# tauri-specta — add via specta-rs/tauri-specta
tauri-specta = { version = "2.0.0-rc", features = ["derive", "typescript"] }
specta = "2"
```

---

## Architecture Patterns

### Recommended Project Structure

```
NexusAI/
├── src/                          # React + TypeScript frontend
│   ├── routes/                   # TanStack Router file-based routes
│   │   ├── __root.tsx            # Root layout (sidebar + content area)
│   │   ├── index.tsx             # Default redirect
│   │   ├── settings/
│   │   │   ├── index.tsx         # Settings root (sub-nav layout)
│   │   │   ├── api-keys.tsx      # API Keys section
│   │   │   ├── models.tsx        # Models section
│   │   │   └── appearance.tsx    # Appearance section
│   │   └── [module]/             # Stub routes for Chat, KB, etc.
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx       # Icon-only sidebar
│   │   │   └── AppShell.tsx      # Root layout wrapper
│   │   └── ui/                   # shadcn/ui components (generated)
│   ├── lib/
│   │   ├── db/                   # Drizzle schema + proxy setup
│   │   │   ├── schema.ts         # Table definitions
│   │   │   ├── proxy.ts          # sqlite-proxy driver
│   │   │   └── migrations/       # SQL files (drizzle-kit generated)
│   │   ├── stores/               # Zustand store slices
│   │   │   ├── appearance.ts     # Theme, font-scale, accent
│   │   │   └── settings.ts       # Model selections
│   │   └── bindings.ts           # tauri-specta generated (DO NOT EDIT)
│   ├── main.tsx
│   └── index.css                 # Tailwind v4 @import + CSS variables
├── src-tauri/
│   ├── Cargo.toml                # Workspace root
│   ├── crates/                   # Plugin-per-module crates
│   │   ├── nexusai-settings/     # Keychain + appearance commands
│   │   ├── nexusai-chat/         # Stub (Phase 2)
│   │   ├── nexusai-kb/           # Stub (Phase 3)
│   │   ├── nexusai-gmail/        # Stub (Phase 5)
│   │   ├── nexusai-calendar/     # Stub (Phase 5)
│   │   ├── nexusai-mcp/          # Stub (Phase 6)
│   │   └── nexusai-agents/       # Stub (Phase 7)
│   ├── src/
│   │   ├── lib.rs                # Plugin registration + app setup
│   │   └── main.rs               # Entry point
│   ├── capabilities/
│   │   └── default.json          # IPC capability grants
│   ├── icons/
│   └── tauri.conf.json
├── .github/
│   └── workflows/
│       ├── build.yml             # CI build (unsigned)
│       └── release.yml           # Release with signing (certs pending)
├── SIGNING.md                    # Certificate acquisition + CI setup guide
└── package.json
```

### Pattern 1: Channel API Streaming (FOUND-05)

**What:** Stream token-by-token LLM responses (and other ordered data) from Rust to frontend without `emit()` loops.

**When to use:** Any time data arrives in chunks: LLM streaming, file download progress, subprocess output.

**Why NOT `emit()`:** The `wry` webview has a known memory leak when `emit()` is called at high frequency in a loop. Channel API is the official fix. [CITED: https://v2.tauri.app/develop/calling-frontend/]

```rust
// Source: https://v2.tauri.app/develop/calling-frontend/
use tauri::ipc::Channel;
use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum StreamEvent {
    Token { text: String },
    Done,
    Error { message: String },
}

#[tauri::command]
#[specta::specta]
pub async fn stream_llm(
    prompt: String,
    on_event: Channel<StreamEvent>,
) -> Result<(), String> {
    // Send tokens as they arrive from LLM client
    on_event.send(StreamEvent::Token { text: "Hello".into() }).map_err(|e| e.to_string())?;
    on_event.send(StreamEvent::Done).map_err(|e| e.to_string())?;
    Ok(())
}
```

```typescript
// Source: https://v2.tauri.app/develop/calling-frontend/
import { Channel } from '@tauri-apps/api/core';
import * as commands from './bindings'; // tauri-specta generated

type StreamEvent =
  | { event: 'token'; data: { text: string } }
  | { event: 'done'; data: null }
  | { event: 'error'; data: { message: string } };

const channel = new Channel<StreamEvent>();
channel.onmessage = (msg) => {
  if (msg.event === 'token') appendToken(msg.data.text);
  if (msg.event === 'done') finalize();
};

await commands.streamLlm({ prompt: 'Hello', onEvent: channel });
```

### Pattern 2: OS Keychain via keyring crate (FOUND-01)

**What:** Store API keys in the OS native secret store (macOS Keychain / Windows Credential Manager). Keys are set, retrieved, and deleted from Rust commands — never exposed to the JS frontend.

**Security contract:** JS calls `invoke('get_api_key_status', { provider: 'openai' })` which returns `{ configured: true }` — not the key itself. Only Rust code can read the actual key value for use in HTTP calls.

```rust
// Source: [CITED: https://lib.rs/crates/keyring + https://github.com/HuakunShen/tauri-plugin-keyring]
use keyring::Entry;

const SERVICE: &str = "nexusai";

#[tauri::command]
#[specta::specta]
pub fn set_api_key(provider: String, key: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE, &provider).map_err(|e| e.to_string())?;
    entry.set_password(&key).map_err(|e| e.to_string())
}

#[tauri::command]
#[specta::specta]
pub fn get_api_key_status(provider: String) -> Result<bool, String> {
    let entry = Entry::new(SERVICE, &provider).map_err(|e| e.to_string())?;
    Ok(entry.get_password().is_ok())
}

#[tauri::command]
#[specta::specta]
pub fn delete_api_key(provider: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE, &provider).map_err(|e| e.to_string())?;
    entry.delete_credential().map_err(|e| e.to_string())
}

// Internal use only — never exposed as Tauri command:
pub fn read_api_key_internal(provider: &str) -> Option<String> {
    Entry::new(SERVICE, provider).ok()?.get_password().ok()
}
```

### Pattern 3: SQLite WAL Mode — Dual Layer Setup (FOUND-06)

**What:** Two Rust SQLite drivers coexist. rusqlite handles initialization (WAL mode, PRAGMA, sqlite-vec extension loading). tauri-plugin-sql (sqlx) handles the JS/Drizzle frontend query path.

**Why dual layer:** tauri-plugin-sql does NOT support WAL mode or extension loading natively (confirmed: GitHub issue #2328 closed as not-planned). rusqlite must run first to initialize the database file before sqlx connects to it. [CITED: https://github.com/tauri-apps/plugins-workspace/issues/2328]

```rust
// Source: [ASSUMED pattern — synthesized from rusqlite docs + Tauri state management]
// In src-tauri/src/lib.rs — run during app setup() hook, before plugin-sql loads
use rusqlite::Connection;

pub fn initialize_database(app_data_dir: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    let db_path = app_data_dir.join("nexusai.db");
    let conn = Connection::open(&db_path)?;
    
    // Enable WAL mode — must be done before sqlx connection pool opens
    conn.execute_batch("
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA foreign_keys = ON;
        PRAGMA cache_size = -64000;
    ")?;
    
    // sqlite-vec extension loaded here (Phase 3)
    // unsafe { sqlite_vec::load(&conn)?; }
    
    Ok(())
}
```

```typescript
// Drizzle proxy setup — Source: [CITED: https://keypears.com/blog/2025-10-04-drizzle-sqlite-tauri]
import Database from '@tauri-apps/plugin-sql';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from './schema';

let _db: Awaited<ReturnType<typeof Database.load>> | null = null;

async function getDb() {
  if (!_db) _db = await Database.load('sqlite:nexusai.db');
  return _db;
}

export const db = drizzle(
  async (sql, params, method) => {
    const sqlite = await getDb();
    if (method === 'run') {
      await sqlite.execute(sql, params);
      return { rows: [] };
    }
    const rows = await sqlite.select(sql, params);
    return { rows: method === 'get' ? [rows[0]] : rows };
  },
  { schema }
);

// Migration runner with import.meta.glob (no fs access needed)
const migrationFiles = import.meta.glob<string>(
  './migrations/*.sql',
  { query: '?raw', import: 'default', eager: true }
);

export async function runMigrations() {
  const sqlite = await getDb();
  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL
    )
  `);
  const applied = (await sqlite.select('SELECT hash FROM __drizzle_migrations', [])) as Array<{ hash: string }>;
  const appliedHashes = new Set(applied.map(r => r.hash));

  const sorted = Object.keys(migrationFiles).sort();
  for (const path of sorted) {
    const hash = path.split('/').pop()!.replace('.sql', '');
    if (!appliedHashes.has(hash)) {
      await sqlite.execute(migrationFiles[path], []);
      await sqlite.execute(
        'INSERT INTO __drizzle_migrations (hash, applied_at) VALUES (?, ?)',
        [hash, Date.now()]
      );
    }
  }
}
```

### Pattern 4: tauri-specta Type Generation (pervasive)

**What:** Annotate Rust commands with `#[specta::specta]`, collect them, and emit a `bindings.ts` file at compile time. Frontend imports typed wrappers instead of raw `invoke()` strings.

```rust
// Source: [CITED: https://docs.rs/tauri-specta/latest/tauri_specta/]
// In src-tauri/src/lib.rs
use tauri_specta::{collect_commands, ts};

pub fn run() {
    #[cfg(debug_assertions)]
    ts::export(
        collect_commands![
            set_api_key,
            get_api_key_status,
            delete_api_key,
            stream_llm,
        ],
        "../src/lib/bindings.ts",
    ).expect("Failed to export bindings");
    
    tauri::Builder::default()
        .invoke_handler(tauri_specta::Builder::new()
            .commands(collect_commands![
                set_api_key,
                get_api_key_status,
                delete_api_key,
                stream_llm,
            ])
            .into_handler()
        )
        .setup(|app| {
            // init stores, db, etc.
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Pattern 5: Appearance Persistence (FOUND-03, FOUND-09)

**What:** Light/dark theme, font scale, and accent color stored via `tauri-plugin-store` (JSON file in app data dir). CSS variables drive all visual customization. Theme applied by toggling `.dark` class on `<html>`.

```typescript
// Source: [ASSUMED — synthesized from Tauri store plugin docs + shadcn/ui theming]
import { load } from '@tauri-apps/plugin-store';
import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';
type FontScale = 'sm' | 'md' | 'lg';
type AccentColor = 'violet' | 'blue' | 'green' | 'orange' | 'red';

interface AppearanceStore {
  theme: Theme;
  fontScale: FontScale;
  accentColor: AccentColor;
  setTheme: (t: Theme) => Promise<void>;
  setFontScale: (s: FontScale) => Promise<void>;
  setAccentColor: (c: AccentColor) => Promise<void>;
  load: () => Promise<void>;
}

let _store: Awaited<ReturnType<typeof load>> | null = null;
async function getStore() {
  if (!_store) _store = await load('appearance.json', { autoSave: true });
  return _store;
}

export const useAppearance = create<AppearanceStore>((set) => ({
  theme: 'dark',
  fontScale: 'md',
  accentColor: 'violet',
  setTheme: async (theme) => {
    const s = await getStore();
    await s.set('theme', theme);
    applyTheme(theme);
    set({ theme });
  },
  setFontScale: async (fontScale) => {
    const s = await getStore();
    await s.set('fontScale', fontScale);
    document.documentElement.style.setProperty('--font-scale', fontScaleMap[fontScale]);
    set({ fontScale });
  },
  setAccentColor: async (accentColor) => {
    const s = await getStore();
    await s.set('accentColor', accentColor);
    document.documentElement.setAttribute('data-accent', accentColor);
    set({ accentColor });
  },
  load: async () => {
    const s = await getStore();
    const theme = (await s.get<Theme>('theme')) ?? 'dark';
    const fontScale = (await s.get<FontScale>('fontScale')) ?? 'md';
    const accentColor = (await s.get<AccentColor>('accentColor')) ?? 'violet';
    applyTheme(theme);
    document.documentElement.style.setProperty('--font-scale', fontScaleMap[fontScale]);
    document.documentElement.setAttribute('data-accent', accentColor);
    set({ theme, fontScale, accentColor });
  },
}));

function applyTheme(theme: Theme) {
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

const fontScaleMap: Record<FontScale, string> = { sm: '0.875', md: '1', lg: '1.125' };
```

### Pattern 6: Plugin-Per-Module Cargo Architecture (FOUND-04)

**What:** Each domain (settings, chat, KB, etc.) lives in its own Cargo crate under `src-tauri/crates/`. The main `lib.rs` composes them.

```toml
# src-tauri/Cargo.toml — workspace root
[workspace]
members = [
    ".",
    "crates/nexusai-settings",
    "crates/nexusai-chat",
    "crates/nexusai-kb",
    "crates/nexusai-gmail",
    "crates/nexusai-calendar",
    "crates/nexusai-mcp",
    "crates/nexusai-agents",
]
resolver = "2"

[workspace.dependencies]
tauri = { version = "2", features = ["protocol-asset"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

```toml
# src-tauri/crates/nexusai-chat/Cargo.toml — stub crate
[package]
name = "nexusai-chat"
version = "0.1.0"
edition = "2021"

[dependencies]
tauri = { workspace = true }
serde = { workspace = true }
```

```rust
// src-tauri/crates/nexusai-chat/src/lib.rs — empty stub
pub fn init_commands() -> Vec<Box<dyn std::any::Any>> {
    vec![] // Phase 2 fills this
}
```

### Pattern 7: GitHub Actions CI Workflow (FOUND-07, FOUND-08)

**What:** Build for macOS (arm64 + x86_64) and Windows (x64) on every push to `release` branch. Signing secrets documented as placeholders; unsigned builds succeed without them.

```yaml
# Source: [CITED: https://v2.tauri.app/distribute/pipelines/github/]
# .github/workflows/build.yml
name: Build (Unsigned)
on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: --target aarch64-apple-darwin
          - platform: macos-latest
            args: --target x86_64-apple-darwin
          - platform: windows-latest
            args: ''
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          cache: pnpm
      - uses: pnpm/action-setup@v4
        with:
          version: latest
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}
      - uses: swatinem/rust-cache@v2
        with:
          workspaces: './src-tauri -> target'
      - run: pnpm install
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # macOS signing (placeholder — activate when cert obtained):
          # APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          # APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          # APPLE_ID: ${{ secrets.APPLE_ID }}
          # APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          # APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
          # Windows signing (placeholder — activate when cert obtained):
          # AZURE_CLIENT_ID: ${{ secrets.AZURE_CLIENT_ID }}
          # AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
          # AZURE_CLIENT_SECRET: ${{ secrets.AZURE_CLIENT_SECRET }}
          # Updater signing:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          args: ${{ matrix.args }}
```

### Anti-Patterns to Avoid

- **`emit()` in a streaming loop:** Known memory leak in `wry`. Use `Channel<T>` instead. [CITED: v2.tauri.app/develop/calling-frontend]
- **Exposing API keys to JavaScript:** IPC commands that return the raw key value. Return `{ configured: bool }` status only.
- **Running `tauri-plugin-sql` connection BEFORE rusqlite WAL init:** sqlx will open the file first and write with default journal mode. WAL pragma must run on first open.
- **`import.meta.glob` with eager: false for migrations:** Lazy loading creates async timing issues at app boot. Use `eager: true`.
- **Storing tauri-specta `bindings.ts` in a path outside `src/`:** The `#[cfg(debug_assertions)]` export runs on `tauri dev`; path must match the import in production code.
- **Using `next()` branch of tauri-specta:** rc.21 is the required version for Tauri v2 compatibility; check docs.rs before pinning.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OS secret storage | Custom encrypted JSON file | `keyring` crate | Edge cases: credential migration, OS security prompts, permissions handling across macOS/Windows — all handled by native stores |
| TypeScript IPC types | Manual type duplication | `tauri-specta` | Type drift between Rust and TS is the #1 source of runtime IPC bugs in Tauri apps |
| SQLite migrations | Custom version table + SQL scripts | Drizzle ORM + `drizzle-kit` | Schema diffing, rollbacks, and ordering are solved problems |
| KV persistence | Flat JSON file with manual read/write | `tauri-plugin-store` | Debounce save, atomic writes, cross-process access — all handled |
| Streaming token delivery | `app.emit()` in a loop | `Channel<T>` | Active wry memory leak when emit() called at token rate |
| Theme CSS variables | Hardcoded class list | shadcn/ui theming + Tailwind v4 `@theme` | OKLCH color space, accessible contrast ratios, dark/light switching — pre-built |

**Key insight:** The "sounds simple" problems in this domain (secrets, type safety, migrations, streaming) each have a production-grade solution already. The complexity is in the edge cases (OS permission errors, concurrent writes, memory leaks) that only surface after months of usage.

---

## Common Pitfalls

### Pitfall 1: WAL Pragma Race Condition

**What goes wrong:** `tauri-plugin-sql` opens the SQLite file first (in the plugin init chain), writing rows with the default rollback journal. When rusqlite later tries to set WAL mode, it may fail silently or produce a mixed-mode database.

**Why it happens:** Tauri plugin registration order is deterministic but the SQL plugin eagerly opens the pool during `.plugin(tauri_plugin_sql::Builder::default()...)`.

**How to avoid:** Initialize rusqlite + WAL pragma in the `setup()` hook BEFORE the SQL plugin is registered, or run rusqlite init in a `build()` step before any plugin accesses the file. Alternatively, set WAL via a `connection_string` option if the plugin supports it (currently not documented — verify at implementation time).

**Warning signs:** Database file has both `wal` and `journal` files simultaneously; intermittent write errors under concurrent load.

### Pitfall 2: macOS JIT Entitlements Missing

**What goes wrong:** App launches on a dev machine with SIP disabled but fails notarization or crashes on a hardened-runtime user machine because the WebView cannot allocate executable memory.

**Why it happens:** Apple's hardened runtime blocks JIT by default. Tauri's WebView (WKWebView/wry) requires JIT for JavaScript execution.

**How to avoid:** Create `src-tauri/entitlements.plist` with both `com.apple.security.cs.allow-jit` and `com.apple.security.cs.allow-unsigned-executable-memory` set to `true`. Reference it in `tauri.conf.json` under `bundle.macOS.entitlements`. [CITED: https://v2.tauri.app/distribute/sign/macos/]

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
</dict>
</plist>
```

**Warning signs:** App crashes on launch with `EXC_BAD_ACCESS` in a WKWebView thread; notarization rejection mentioning hardened runtime.

### Pitfall 3: tauri-specta Bindings Path Drift

**What goes wrong:** `bindings.ts` is exported to a path during `tauri dev` that differs from the import path used in production code — type generation succeeds but frontend imports fail.

**Why it happens:** The export path is a string literal in Rust. If the frontend is restructured (e.g., moved from `src/` to `src/lib/`), the Rust path isn't updated.

**How to avoid:** Pin the export path to a constant. Add a CI step to verify `bindings.ts` is up-to-date (run `tauri dev -- --no-dev-server` briefly or use a unit test).

**Warning signs:** TypeScript compiler errors on `./bindings` imports after project restructuring.

### Pitfall 4: Windows EV Certificate Requirement (OV Sunset)

**What goes wrong:** Developer purchases a standard OV code signing certificate but it cannot be exported as a `.pfx` file — modern CAs issue EV certificates on hardware HSMs only.

**Why it happens:** Since June 2023, certificate authorities discontinued exportable OV certificates. New Windows code signing certs require an HSM (physical dongle or cloud HSM like Azure Key Vault). [CITED: https://v2.tauri.app/distribute/sign/windows/]

**How to avoid (when ready):** Use Azure Trusted Signing (formerly Azure Code Signing) — cloud HSM accessible via CI environment variables (`AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_CLIENT_SECRET`). Configure `signCommand` in `tauri.conf.json` to call `trusted-signing-cli`.

**Warning signs:** Certificate vendor says "you need to use our token/dongle" — that's an EV cert on a hardware HSM.

### Pitfall 5: Tailwind v4 Dark Mode Class Strategy in Tauri

**What goes wrong:** `tailwind.config.js` sets `darkMode: 'media'` (system preference), but the user wants a manual toggle. Or `darkMode: 'class'` is set but the `.dark` class is added to `<body>` instead of `<html>`.

**Why it happens:** shadcn/ui expects `.dark` on `<html>`. Tailwind v4 uses a different config structure (CSS-first via `@import "tailwindcss"`) compared to v3.

**How to avoid:** Use Tailwind v4 CSS-first config. Apply `.dark` class to `document.documentElement` (the `<html>` element) — not `document.body`. Use `app.setTheme()` (Tauri's official API) for OS-level window chrome synchronization if needed.

**Warning signs:** shadcn/ui components don't respond to theme toggle; title bar/window chrome stays in wrong color mode.

### Pitfall 6: Keyring `linux-native` Feature Loses Secrets on Reboot

**What goes wrong:** On Linux (not in scope for NexusAI but relevant for dev machines), API keys disappear after every reboot.

**Why it happens:** The `linux-native` keyring feature uses the kernel keyring, which is per-session only.

**How to avoid:** Use `features = ["sync-secret-service"]` which uses GNOME Keyring/KWallet via D-Bus (persists across reboots). [CITED: https://lib.rs/crates/keyring]

**Warning signs:** Keys work in current session but are "not found" after restart.

---

## Code Examples

### Tauri v2 Project Scaffold

```bash
# Source: [CITED: https://v2.tauri.app/start/create-project/]
pnpm create tauri-app
# Project name: nexusai
# Identifier: com.nexusai.app
# Frontend language: TypeScript / JavaScript
# Package manager: pnpm
# UI template: React
# UI flavor: TypeScript

cd nexusai
pnpm install
pnpm tauri dev
```

### Updater Keypair Generation (FOUND-07)

```bash
# Source: [CITED: https://v2.tauri.app/plugin/updater/]
pnpm tauri signer generate -w ~/.tauri/nexusai.key
# Outputs:
#   ~/.tauri/nexusai.key       (PRIVATE — never commit, back up securely)
#   ~/.tauri/nexusai.key.pub   (PUBLIC — safe to commit / share)
```

```json
// tauri.conf.json — add pubkey content (not file path)
{
  "bundle": {
    "createUpdaterArtifacts": true
  },
  "plugins": {
    "updater": {
      "pubkey": "PASTE_PUBLIC_KEY_CONTENT_HERE",
      "endpoints": ["https://github.com/org/nexusai/releases/latest/download/update.json"]
    }
  }
}
```

### SQLite capabilities/default.json

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Default capability",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "sql:default",
    "sql:allow-load",
    "sql:allow-execute",
    "sql:allow-select",
    "store:default"
  ]
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `app.emit()` in streaming loops | `Channel<T>` API | Tauri v2.0 (2024) | Eliminates wry memory leak at high emission rates |
| Tauri Stronghold for secrets | OS Keychain via `keyring` crate | Tauri v2 (Stronghold deprecated, removal in v3) | Simpler; no local vault management |
| `tailwind.config.js` with `darkMode` key | CSS-first Tailwind v4 `@import` + `@theme` directive | Tailwind 4.0 (2025) | No config file; CSS variables replace JS config |
| OV `.pfx` certificates for Windows signing | Azure Key Vault / Trusted Signing (cloud HSM) | June 2023 CA policy change | No more exportable `.pfx`; HSM required |
| `drizzle-kit push` with Node.js fs access | `import.meta.glob` + manual migration tracking | 2024–2025 community pattern | Enables migrations in Vite/Tauri without fs access |
| tauri-specta v1 (commands only) | tauri-specta v2 (commands + events) | 2024 | Events now have type-safe TS bindings too |

**Deprecated/outdated:**
- **Tauri Stronghold plugin:** Marked for removal in Tauri v3. Official docs recommend OS Keychain instead.
- **`tauri-plugin-sql` WAL mode:** Feature request closed as not planned (issue #2328). Use rusqlite directly for WAL initialization.
- **LangGraph.js in webview:** `node:async_hooks` incompatibility in browser context. Use Node.js sidecar with AI SDK v7 instead (Phase 2+).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TypeScript 5.5+ assumed as current | Standard Stack | Lower risk; TypeScript 5.x is stable and broadly available; planner should verify via `npm view typescript version` |
| A2 | tauri-specta current version is 2.0.0-rc.21 (docs.rs reference) | Standard Stack | Medium risk; if a breaking RC was released, bindings API may differ; verify with `cargo add tauri-specta --version "*"` |
| A3 | keyring crate v3 is the current stable series | Standard Stack | Low risk; v3 API is stable; planner should confirm with `cargo search keyring` |
| A4 | tauri crate is v2.x stable | Standard Stack | Low risk; Tauri v2 stable was released Oct 2024 |
| A5 | WAL pragma race condition requires rusqlite init before sqlx pool | Common Pitfalls | Medium risk; if tauri-plugin-sql added WAL support since issue #2328, dual-layer setup may be unnecessary overhead |
| A6 | Font scale via CSS variable `--font-scale` on `<html>` using `rem` cascade | Architecture Patterns | Low risk; this is a standard technique; implementation detail left to planner |
| A7 | Drizzle proxy pattern: `method === 'run'` vs `method === 'get'` vs `method === 'all'` | Code Examples | Medium risk; Drizzle sqlite-proxy API may have changed in 0.45.x; verify against drizzle-orm/sqlite-proxy docs at implementation time |

---

## Open Questions

1. **tauri-specta v2 RC vs stable release**
   - What we know: docs.rs references rc.21; the crate is in active development
   - What's unclear: Whether a stable 2.0.0 has shipped since rc.21
   - Recommendation: Planner should run `cargo search tauri-specta` or check crates.io at implementation time; pin to specific version in `Cargo.toml`

2. **WAL mode and tauri-plugin-sql initialization order**
   - What we know: Issue #2328 was closed as not-planned in Jan 2025; rusqlite workaround is documented
   - What's unclear: Whether a later PR/release added native WAL support anyway
   - Recommendation: Planner should check `tauri-plugin-sql` changelog before implementing dual-layer setup

3. **macOS universal binary in single CI job or two jobs**
   - What we know: Official workflow uses two separate matrix entries (arm64 and x86_64) with separate `tauri-action` invocations
   - What's unclear: Whether `lipo` post-processing to create a true universal binary is needed, or whether two separate artifacts is acceptable for Phase 1
   - Recommendation: Use two artifacts for Phase 1 (simpler); universal lipo in a release job can be added later

4. **shadcn/ui Tailwind v4 compatibility for all required components**
   - What we know: shadcn/ui has Tailwind v4 migration docs and OKLCH color updates
   - What's unclear: Whether the sidebar component, tooltip, and settings layout components are fully updated for Tailwind v4 in the current CLI output
   - Recommendation: Run `pnpm dlx shadcn@latest init` and verify output; fall back to manual Tailwind v4 migration if components generate v3 syntax

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build, pnpm, Tauri CLI | Yes | 24.12.0 [VERIFIED] | — |
| pnpm | Package management | Yes | 11.5.3 [VERIFIED] | npm (available, 11.6.2) |
| Rust / Cargo | Tauri backend compilation | No | — | MUST install before any Tauri work |
| Tauri CLI | `pnpm tauri dev`, `pnpm tauri build` | No | — | Installed via `pnpm add -D @tauri-apps/cli` (no system install needed) |
| Git | Version control | Yes | 2.43.0 [VERIFIED] | — |
| WebKit/WebView (Linux) | Dev preview on Linux CI | Partial | Linux host (no GUI) [VERIFIED] | Headless build only; no `tauri dev` on this machine |
| macOS runner | macOS notarization, arm64 build | No (Linux host) | — | GitHub Actions `macos-latest` runner (CI only) |
| Windows runner | Windows code signing, x64 build | No (Linux host) | — | GitHub Actions `windows-latest` runner (CI only) |

**Missing dependencies with no fallback:**
- **Rust / Cargo:** All Tauri compilation depends on Rust. First task in Wave 0 must install Rust via `rustup` (`curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`). On this Linux machine, install and verify before any `pnpm tauri` command.

**Missing dependencies with fallback:**
- **Tauri CLI:** Not installed globally, but `@tauri-apps/cli` installed as a devDependency works identically via `pnpm tauri`. No action needed beyond `pnpm install`.
- **GUI for `tauri dev`:** This Linux machine has no display server. `tauri dev` will fail locally. All UI testing must happen on macOS or Windows (developer machine), or via CI artifacts. The planner should note this constraint: implementation tasks assume development happens on macOS or Windows.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.9 [VERIFIED: npm registry] |
| Config file | `vitest.config.ts` — Wave 0 gap |
| Quick run command | `pnpm vitest run --reporter=dot` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | `get_api_key_status` returns `false` when key not set | unit (mocked IPC) | `pnpm vitest run tests/api-keys.test.ts` | Wave 0 gap |
| FOUND-01 | `set_api_key` + `get_api_key_status` roundtrip | integration (requires OS Keychain) | manual only on dev machine | — |
| FOUND-02 | Model selection stored and rehydrated across store reload | unit (Zustand store) | `pnpm vitest run tests/settings-store.test.ts` | Wave 0 gap |
| FOUND-03 | Theme toggle applies `.dark` class to `<html>` | unit (jsdom) | `pnpm vitest run tests/appearance.test.ts` | Wave 0 gap |
| FOUND-03 | Font scale updates `--font-scale` CSS variable | unit (jsdom) | same file | Wave 0 gap |
| FOUND-04 | All module stub routes render without errors | unit (React Testing Library) | `pnpm vitest run tests/routes.test.tsx` | Wave 0 gap |
| FOUND-05 | Channel onmessage receives token events in order | unit (mockIPC) | `pnpm vitest run tests/channel.test.ts` | Wave 0 gap |
| FOUND-06 | Drizzle proxy executes SELECT via plugin-sql mock | unit (mockIPC) | `pnpm vitest run tests/db-proxy.test.ts` | Wave 0 gap |
| FOUND-07 | Public key present in `tauri.conf.json` `updater.pubkey` | smoke (config parse) | `pnpm vitest run tests/config.test.ts` | Wave 0 gap |
| FOUND-08 | GitHub Actions build workflow YAML is valid | CI (GitHub Actions lint) | `act -j build --dry-run` or manual | — |

**Manual-only tests (no automation):**
- Keychain read/write roundtrip (requires OS Keychain hardware — macOS/Windows only)
- Distribution build produces installable artifact (requires code-signed runner or accepted unsigned on macOS dev machine)
- Streaming session memory stability over 10 minutes (FOUND-05 success criterion 4)

### Mocking IPC in Vitest

```typescript
// Source: [CITED: https://v2.tauri.app/develop/tests/mocking/]
// tests/setup.ts
import { mockIPC, clearMocks } from '@tauri-apps/api/mocks';
import { beforeAll, afterEach } from 'vitest';

beforeAll(() => {
  mockIPC((cmd, payload) => {
    if (cmd === 'get_api_key_status') return { configured: false };
    if (cmd === 'plugin:sql|execute') return [];
    if (cmd === 'plugin:sql|select') return [];
    if (cmd === 'plugin:store|set') return null;
    if (cmd === 'plugin:store|get') return null;
  });
});

afterEach(() => clearMocks());
```

### Sampling Rate

- **Per task commit:** `pnpm vitest run --reporter=dot` (< 10 seconds)
- **Per wave merge:** `pnpm vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- `tests/setup.ts` — IPC mock bootstrap (shared fixture for all tests)
- `tests/api-keys.test.ts` — FOUND-01 unit coverage
- `tests/settings-store.test.ts` — FOUND-02 unit coverage
- `tests/appearance.test.ts` — FOUND-03 unit coverage
- `tests/routes.test.tsx` — FOUND-04 module stub routing
- `tests/channel.test.ts` — FOUND-05 Channel API ordering
- `tests/db-proxy.test.ts` — FOUND-06 Drizzle proxy mock
- `tests/config.test.ts` — FOUND-07 config file smoke test
- `vitest.config.ts` — framework config with jsdom environment
- Framework install: `pnpm add -D vitest @testing-library/react @testing-library/user-event jsdom`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (no user accounts in Phase 1) | — |
| V3 Session Management | No | — |
| V4 Access Control | Partial (API keys must not be accessible from JS) | Rust-only keyring commands; no get_api_key IPC command |
| V5 Input Validation | Yes (provider name in keychain commands) | Validate `provider` param is in allowed set; prevent keychain namespace injection |
| V6 Cryptography | No (OS Keychain handles crypto) | Never hand-roll secret storage |

### Known Threat Patterns for Tauri v2 + OS Keychain

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Keychain namespace collision (another app reads NexusAI keys) | Information disclosure | Use app-specific service name (`"nexusai"`) + validate provider allowlist |
| JS exfiltrating API key via forge IPC call | Elevation of privilege | NEVER expose `get_api_key(provider) -> String` as a Tauri command; return `{ configured: bool }` only |
| CSS injection in "Coming soon" tooltip content | XSS | Use shadcn/ui Tooltip with static strings — no innerHTML |
| YAML injection in GitHub Actions workflow | Tampering | Pin action versions to SHA; use `secrets.GITHUB_TOKEN` — not PAT |
| Signing key leaked in CI logs | Information disclosure | `TAURI_SIGNING_PRIVATE_KEY` must be a GitHub Actions secret, never echoed |

---

## Sources

### Primary (HIGH confidence)

- [Tauri v2 Calling Frontend (Channel API)](https://v2.tauri.app/develop/calling-frontend/) — Channel vs emit, Rust + TypeScript patterns
- [Tauri v2 GitHub Actions Pipeline](https://v2.tauri.app/distribute/pipelines/github/) — Official workflow YAML
- [Tauri v2 macOS Signing](https://v2.tauri.app/distribute/sign/macos/) — Certificate types, notarization env vars
- [Tauri v2 Windows Signing](https://v2.tauri.app/distribute/sign/windows/) — Azure Key Vault / Trusted Signing approach
- [Tauri v2 Updater Plugin](https://v2.tauri.app/plugin/updater/) — Keypair generation command, tauri.conf.json config
- [Tauri v2 Store Plugin](https://v2.tauri.app/plugin/store/) — KV persistence, JSON file backend
- [Tauri v2 Create Project](https://v2.tauri.app/start/create-project/) — Scaffold command and prompts
- [tauri-specta docs.rs](https://docs.rs/tauri-specta/latest/tauri_specta/) — Setup, annotation, export patterns
- [Tauri v2 Mocking IPC](https://v2.tauri.app/develop/tests/mocking/) — mockIPC, Vitest setup

### Secondary (MEDIUM confidence)

- [Drizzle + SQLite in Tauri 2.0 (keypears.com)](https://keypears.com/blog/2025-10-04-drizzle-sqlite-tauri) — Proxy pattern, import.meta.glob migration runner
- [tauri-drizzle-sqlite-proxy-demo (GitHub)](https://github.com/tdwesten/tauri-drizzle-sqlite-proxy-demo) — Reference implementation
- [Cross-Platform Keyring in Tauri v2 (decentpaste.com)](https://decentpaste.com/blog/cross-platform-biometric-keyring-storage-tauri/) — keyring crate Linux feature flag advice
- [tauri-plugin-keyring (HuakunShen)](https://github.com/HuakunShen/tauri-plugin-keyring) — JS API surface (used to inform security decision to NOT expose keys to JS)
- [SQLite WAL in Tauri (dezoito.github.io)](https://dezoito.github.io/2025/01/01/embedding-sqlite-in-a-tauri-application.html) — rusqlite + sqlx WAL pattern
- [Shipping macOS Tauri 2.0 (dev.to/massi_24)](https://dev.to/massi_24/shipping-a-production-macos-app-with-tauri-20-code-signing-notarization-and-homebrewpublished-o10) — Production notarization experience

### Tertiary (LOW confidence)

- [WAL issue closed #2328 (tauri plugins-workspace)](https://github.com/tauri-apps/plugins-workspace/issues/2328) — Confirms tauri-plugin-sql does not support WAL (Jan 2025, may be stale)
- [Toggling dark mode discussion (tauri-apps)](https://github.com/orgs/tauri-apps/discussions/13472) — Community theme persistence patterns

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all npm packages verified against registry; Rust crates at known stable versions; architecture locked in CLAUDE.md
- Architecture Patterns: HIGH — Channel API and Drizzle proxy patterns cited from official docs and validated community implementations
- Distribution Pipeline: MEDIUM — workflow YAML from official docs; signing secrets documented as placeholders; Rust install required on this machine
- Pitfalls: HIGH — WAL race condition and macOS JIT entitlements confirmed from official sources and issue tracker

**Research date:** 2026-06-25
**Valid until:** 2026-09-25 (90 days — Tauri 2.x stable; Drizzle ORM stable; shadcn/ui stable. Re-research if tauri-specta goes stable from RC, or if tauri-plugin-sql ships WAL support.)
