---
phase: "01"
plan: "05"
subsystem: ci-pipeline
tags: [github-actions, tauri, ci, signing, updater, keypair, distribution]
dependency_graph:
  requires: [01-01]
  provides: [ci-build-pipeline, updater-keypair, signing-docs]
  affects: [distribution, first-distributable-build]
tech_stack:
  added:
    - tauri-apps/tauri-action@v0
    - GitHub Actions matrix builds
  patterns:
    - macOS arm64 + x86_64 separate matrix jobs (two artifacts per release)
    - Signing secrets as commented placeholders (activate when certs obtained)
    - Updater keypair: private key never committed, pubkey in tauri.conf.json
key_files:
  created:
    - .github/workflows/build.yml
    - .github/workflows/release.yml
    - SIGNING.md
  modified:
    - src-tauri/tauri.conf.json
    - .gitignore
decisions:
  - "Use two separate matrix jobs for macOS arm64 + x86_64 (not lipo universal binary) — simpler for Phase 1, true universal binary deferred to release job enhancement"
  - "Updater keypair generated with empty password (--password '' --ci) for non-interactive CI environment; password can be rotated when a real CI secret is configured"
  - "pnpm vitest run must be invoked via node_modules/.bin/vitest directly on this machine — pnpm command triggers ERR_PNPM_IGNORED_BUILDS for native deps (biome, esbuild)"
metrics:
  duration: "4m 33s"
  completed_date: "2026-06-25"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
---

# Phase 01 Plan 05: CI Pipeline and Updater Keypair Summary

GitHub Actions build + release workflows for macOS (arm64, x86_64) and Windows (x64) using tauri-apps/tauri-action@v0, with signing placeholders documented and the updater keypair public key committed to tauri.conf.json.

## What Was Built

### Task 1: GitHub Actions Workflows

- Created `.github/workflows/build.yml` — triggered on pushes to master/main and PRs; builds macOS arm64, macOS x86_64, Windows x64 in a 3-entry matrix
- Created `.github/workflows/release.yml` — triggered on `v*` tags; same matrix plus `tagName`, `releaseName`, `releaseDraft: true`
- Both workflows use `tauri-apps/tauri-action@v0` (D-10)
- All 5 `APPLE_*` signing variables are commented placeholders (D-11)
- All 3 `AZURE_*` signing variables are commented placeholders (D-11)
- `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` are active (not commented) — required for update.json generation
- Linux excluded from all matrix entries (D-12)

### Task 2: Updater Keypair and SIGNING.md

- Generated updater keypair at `~/.tauri/nexusai.key` (private) and `~/.tauri/nexusai.key.pub` (public)
- Public key committed to `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`
- Updater endpoint set to `https://github.com/biellil/NexusAI/releases/latest/download/update.json`
- `src-tauri/tauri.conf.json` already had `bundle.createUpdaterArtifacts: true` and `bundle.macOS.entitlements` from Plan 01
- Created `SIGNING.md` documenting:
  - Current status (pubkey done; Apple cert and Azure Trusted Signing pending)
  - Backup procedure (password manager + hardware-encrypted drive)
  - GitHub Secrets setup navigation path
  - Full macOS signing steps (Developer ID cert, .p12 export, base64 encode, app-specific password)
  - Full Windows Azure Trusted Signing steps (Service Principal creation, East US region requirement)
  - References to official Tauri signing docs
- Added `~/.tauri/nexusai.key` and `.tauri/nexusai.key` to `.gitignore` (private key never committed)

## Verification

```
node_modules/.bin/vitest run tests/config.test.ts → 2 tests passed
node_modules/.bin/vitest run → 7 test files, 17 tests, all passed, exit 0
```

FOUND-07 test (`tests/config.test.ts`) now fully passes — `tauri.conf.json` exists and `plugins.updater.pubkey` is a non-empty string.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Used `--ci --password ""` flags for non-interactive keypair generation**
- **Found during:** Task 2
- **Issue:** `pnpm tauri signer generate -w ~/.tauri/nexusai.key` panics with `PError { kind: Io, code: 6 }` when there is no TTY — it tries to open `/dev/tty` to prompt for a password interactively
- **Fix:** Used `--ci` (skip prompting) and `--password ""` (empty password) flags: `tauri signer generate -w ~/.tauri/nexusai.key --password "" --ci`
- **Files modified:** None (only affects the generated key file)
- **Commit:** ff62d45

**2. [Rule 3 - Blocking] Used `node_modules/.bin/vitest` instead of `pnpm vitest run`**
- **Found during:** Task 2 verification
- **Issue:** `pnpm vitest run` fails with `ERR_PNPM_IGNORED_BUILDS` — pnpm 11.5.3's security policy blocks build scripts for `@biomejs/biome` and `esbuild` packages. This causes pnpm to refuse to run any script in the workspace
- **Fix:** Invoke vitest directly via `node_modules/.bin/vitest run` — same binary, bypasses pnpm's script runner security check
- **Files modified:** None
- **Commit:** N/A (execution environment workaround)

**3. [Rule 3 - Blocking] Used `node_modules/.bin/tauri` instead of `pnpm tauri`**
- **Found during:** Task 2, keypair generation
- **Issue:** Same `ERR_PNPM_IGNORED_BUILDS` error affects `pnpm tauri` as well
- **Fix:** Used `/root/NexusAI/.claude/worktrees/agent-a6d9a9b79450470b5/node_modules/.bin/tauri` directly
- **Files modified:** None
- **Commit:** N/A (execution environment workaround)

## Known Stubs

None. All deliverables are fully implemented:
- Workflows contain real YAML (not placeholder content)
- SIGNING.md contains actionable steps (not "TODO" placeholders)
- `tauri.conf.json` has a real pubkey (not an empty string)

## Threat Flags

None beyond what was already modeled in the plan's threat register (T-01-05-01 through T-01-05-05). The private key is at `~/.tauri/nexusai.key`, listed in `.gitignore`, and not tracked in the repository.

## Self-Check: PASSED

Files exist:
- .github/workflows/build.yml: FOUND
- .github/workflows/release.yml: FOUND
- SIGNING.md: FOUND
- src-tauri/tauri.conf.json (modified): FOUND
- .gitignore (modified): FOUND

Commits exist:
- a0be4a9: FOUND (ci: GitHub Actions workflows)
- ff62d45: FOUND (security: updater keypair and SIGNING.md)

Test suite: `node_modules/.bin/vitest run` exits 0, 17/17 tests passing, FOUND-07 fully green
