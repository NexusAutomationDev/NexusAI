# Domain Pitfalls: Tauri v2 + LLM Desktop Super-App

**Domain:** Tauri v2 desktop AI super-app (chat, RAG, Gmail, agents, MCP, automations)
**Researched:** 2026-06-25
**Overall confidence:** HIGH (most findings verified against official Tauri docs + GitHub issues + production post-mortems)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or complete distribution failure.

---

### Pitfall 1: IPC JSON Serialization Blows Up Under Load

**Severity:** CRITICAL

**What goes wrong:**
Every `invoke()` call between the frontend and Rust backend passes data through JSON serialization/deserialization via serde. This is invisible at small scales. At scale — streaming LLM tokens, passing large document chunks for RAG, returning file contents — it becomes a catastrophic bottleneck. Real-world case: processing 10,000+ files caused 500MB+ memory usage and a frozen UI despite the app launching at 15MB. Measured benchmark: raw binary IPC is 11.2x faster than JSON IPC for 64KB payloads (600µs vs 6.7ms).

**Why it happens:**
Developers treat `invoke()` like a cheap function call. The JSON serialization overhead is invisible in development with small payloads but multiplies severely at runtime when LLM responses, embeddings, or file contents flow through IPC at high frequency.

**Consequences:**
- UI thread blocks during large IPC transfers
- Memory bloat from intermediate JSON representations
- Streaming LLM responses arrive in visible chunks rather than smooth token flow
- RAG result sets cause UI freezes

**Prevention:**
- Never pipe large payloads through `invoke()` — use Tauri's Channel API for streaming, and the raw binary IPC path for large blobs
- For LLM token streaming: emit small, frequent events via `emit()` or Channel API — never buffer full responses before sending
- For file contents: write to temp path in Rust, return the path, let the webview load it with `convertFileSrc()`
- For embeddings and vector search results: paginate — never return thousands of rows in one call

**Warning signs:**
- UI hitches when LLM response arrives
- Memory climbing during document ingestion
- High CPU usage on the Rust side during what should be simple queries

**Phase to address:** Phase 1 (core architecture) — establish IPC patterns before building any features on top.

---

### Pitfall 2: Tauri Event Emission Memory Leak (Active Bug)

**Severity:** CRITICAL

**What goes wrong:**
Continuously emitting events from Rust backend to the frontend (exactly what LLM token streaming requires) causes memory usage to grow without bound. This is a documented active bug in Tauri's underlying `wry` WebView library (Issue #12724, reported 2025). The memory is not released between event emissions, meaning a long chat session or an automation running for hours will eventually exhaust RAM.

**Why it happens:**
The WebView layer retains references to event payloads. The bug is in `wry`, not in application code, making it impossible to fix without a workaround strategy.

**Consequences:**
- Long-running agent sessions gradually consume all available RAM
- App becomes unusable after extended use without restart
- Automation pipelines that run overnight will OOM

**Prevention:**
- Use the Channel API (introduced in Tauri v2) instead of `emit()` for high-frequency streaming — Channels have better lifecycle management
- Implement session memory caps: limit conversation history stored in-memory, archive to SQLite
- For LLM streaming: batch tokens (every 3-5 tokens) rather than emitting every single token
- Monitor wry release notes — this bug may be fixed in a patch release

**Warning signs:**
- Memory climbs during LLM streaming sessions
- Memory does not drop after conversation ends
- Long agent runs cause progressive slowdown

**Phase to address:** Phase 1 (streaming architecture) — design streaming with Channels from day one, not `emit()`.

---

### Pitfall 3: macOS Notarization Blocks Distribution Entirely

**Severity:** CRITICAL

**What goes wrong:**
Without code signing AND notarization, macOS Gatekeeper either shows a "damaged app" dialog or outright refuses to open the app — on every user machine. This is not a warning users can dismiss; it actively blocks the app. Additionally, Tauri's WebView requires JIT compilation, meaning specific entitlements must be explicitly declared in the entitlements plist. Missing those entitlements causes the app to crash on launch on any notarized build.

**Why it happens:**
Developers test locally on their own machine (where signing requirements are bypassed for the developer) and discover the problem only when sharing builds. The required entitlements for WKWebView are non-obvious and not declared by default.

**Consequences:**
- Complete inability to distribute to any macOS user
- App appears as corrupted/malicious to users even when healthy
- Discovering this late means retrofitting CI/CD around it

**Prevention:**
Required entitlements for Tauri apps on macOS:
```
com.apple.security.cs.allow-jit
com.apple.security.cs.allow-unsigned-executable-memory
com.apple.security.cs.allow-dyld-environment-variables
```
- Requires a paid Apple Developer account ($99/year) — there is no workaround
- Set up notarization in CI from the first distributable build, not at "launch time"
- Only the Account Holder role in Apple Developer can create Developer ID certificates — plan for this in team setups

**Warning signs:**
- App works on dev machine but reports "damaged" on other Macs
- App crashes immediately after successful build on CI

**Phase to address:** Phase 1 (project setup) and whichever phase produces the first distributable build.

---

### Pitfall 4: Windows SmartScreen Blocks Unsigned Builds; EV Cert Is Now Hardware-Locked

**Severity:** CRITICAL

**What goes wrong:**
Standard OV (Organization Validation) certificates no longer bypass SmartScreen. Since June 2023, certificate authorities cannot issue OV certificates as exportable files — they must be stored on Hardware Security Modules (Azure Key Vault or physical token). EV (Extended Validation) certificates provide immediate SmartScreen reputation, but custom signing with EV certs in Tauri CI has documented bugs (Issue #11754) where the `%1` parameter substitution in custom sign commands fails with specific tools like CodeSignTool.

**Why it happens:**
Industry-wide CA requirement change in 2023. Developers using older guides find their signing setup is no longer valid.

**Consequences:**
- Users see "Windows protected your PC" on every install
- App refuses to run without user explicitly bypassing SmartScreen
- EV cert CI setup is significantly more complex than OV

**Prevention:**
- Accept that SmartScreen reputation builds over time with OV certs — document this in your release notes
- For immediate reputation: use EV cert + Azure Key Vault; follow certificate issuer's specific docs, not generic Tauri guide
- Assign BOTH "Key Vault Certificate User" AND "Key Vault Crypto User" roles to your app registration — missing either causes signing failures
- Test the full signing pipeline in CI before any public release

**Warning signs:**
- SmartScreen dialog appears on test machines
- CI signing step succeeds but resulting installer triggers SmartScreen
- `%1` substitution errors in signing logs

**Phase to address:** Same phase as first distribution build.

---

### Pitfall 5: Tauri Updater Private Key Loss = All Existing Users Permanently Stranded

**Severity:** CRITICAL

**What goes wrong:**
Tauri's auto-updater plugin requires a cryptographic signature to verify updates. The private key used to sign installer files cannot be recovered if lost. If you lose it, every user who has the app installed cannot receive future updates — there is no migration path short of asking users to manually reinstall from scratch.

**Why it happens:**
Private keys are generated once and typically stored in CI secrets or local `.env` files. They get lost during repo migrations, team member departures, or accidental secret rotation.

**Consequences:**
- All installed user base is permanently cut off from updates
- No way to push security patches to existing installs
- Forces manual reinstall communication

**Prevention:**
- Generate the updater keypair once, store it in a password manager AND a secondary backup (encrypted)
- Treat this key with the same care as a signing certificate — it has equal distribution impact
- Never regenerate it without verifying the backup first
- Document the key location explicitly in team onboarding

**Warning signs:**
- Secret not found in CI → signing fails → this is recoverable. Private key deleted from all storage → not recoverable.

**Phase to address:** Phase 1 (project setup) — generate and back up this key before the first build.

---

## Moderate Pitfalls

Mistakes that cause significant rework but not total rewrites.

---

### Pitfall 6: Google OAuth Refresh Token Silently Revoked

**Severity:** MODERATE–HIGH

**What goes wrong:**
Gmail integration depends on OAuth2 refresh tokens. Google revokes these tokens silently under multiple conditions, with no push notification to the app. The app only discovers the revocation when it makes an API call and receives `invalid_grant`. The seven most common revocation triggers for native desktop apps:

1. App in "Testing" mode + "External" user type → tokens revoked after **7 days**
2. User changes Gmail password → token revoked immediately
3. Token unused for **6 consecutive months**
4. User exceeds **100 live refresh tokens** per OAuth client (oldest silently invalidated)
5. User manually revokes app access in Google Account settings
6. Workspace admin restricts the scope
7. Undocumented Google security heuristics

**Why it happens:**
Desktop apps using `localhost` redirect URIs (standard for native PKCE flow) don't receive webhook callbacks when tokens are revoked. Polling is the only detection mechanism.

**Consequences:**
- User opens Gmail inbox in NexusAI and sees a cryptic error
- Silent revocation means automations silently fail without alerting the user
- Poor UX if re-auth flow is not smooth

**Prevention:**
- Always use PKCE (`code_verifier` / `code_challenge`) for the OAuth flow — required for desktop apps
- Store tokens encrypted using the OS keychain (Tauri has a `keyring` plugin), not in SQLite plaintext
- Implement graceful `invalid_grant` handling: detect error, surface a friendly re-auth prompt immediately
- Move out of Google "Testing" mode before any real use (even personal use)
- Implement a silent token refresh check on app startup

**Warning signs:**
- Gmail calls returning 401 or `invalid_grant`
- Automations silently stopping
- User reports "email stopped working" without any error shown

**Phase to address:** Gmail integration phase. Design the token refresh retry loop before building any Gmail features.

---

### Pitfall 7: LLM Context Rot and Lost-in-the-Middle Effect

**Severity:** MODERATE–HIGH

**What goes wrong:**
Two compounding problems: (1) Context rot — output quality degrades as conversation history grows, independent of whether you're near the token limit. Every tested model shows this. (2) Lost-in-the-Middle — LLMs weight the beginning and end of prompts more heavily than the middle. Long conversation histories injected before user query means the most relevant recent context ends up buried in the "lost" zone.

For NexusAI specifically, RAG retrieval will inject knowledge base chunks into the prompt, conversation history will accumulate, and Gmail/calendar context may also be injected — the combined context can easily exceed practical effective limits even with 128K+ token windows.

**Why it happens:**
Token window marketing (1M tokens, 200K tokens) implies linear quality. The reality is a steep quality degradation curve starting much earlier than the advertised limit.

**Consequences:**
- Agent responses become incoherent or contradictory in long sessions
- RAG context injected in the middle is effectively ignored by the model
- Multi-turn conversations produce worse answers than single-turn ones

**Prevention:**
- Implement sliding window summarization: summarize older conversation turns rather than truncating them blindly
- Place the most important context (RAG results, system instructions) at the START and END of the prompt, not in the middle
- Set hard conversation memory limits: keep last N turns verbatim, summarize older ones
- Build a context budget manager: track estimated tokens before sending, drop or summarize to stay under 50% of the model's window for best quality

**Warning signs:**
- Agent gives contradictory answers across a long session
- RAG retrieval improves when context is shorter
- Quality measurably drops after >10 conversation turns

**Phase to address:** LLM chat phase and RAG phase. Context management strategy must be designed before building the UI.

---

### Pitfall 8: RAG Retrieval Fails More Than Generation Does

**Severity:** MODERATE–HIGH

**What goes wrong:**
Industry data from 2025 shows that when RAG pipelines fail, the failure point is retrieval 73% of the time — not the LLM generation step. Naive fixed-size chunking is the primary cause: chunks split across concept boundaries, producing fragments that neither embed accurately nor retrieve relevantly. A query like "how do I cancel my subscription?" won't match a document titled "Account Termination Policy" using naive vector similarity.

**Why it happens:**
Fixed-size chunking is the default and easiest to implement. Developers focus on the LLM and ignore chunking strategy, which has equal or greater impact on retrieval quality than the embedding model choice.

**Consequences:**
- Knowledge base appears to "not work" even when the LLM is perfectly capable
- User adds documents but gets no relevant retrieval
- Users lose trust in the knowledge base feature

**Prevention:**
- Use semantic chunking (split on semantic boundaries, not character counts) — improves recall up to 9% over fixed-size
- Add metadata enrichment to chunks: source file, section heading, date — improves retrieval precision significantly
- Implement hybrid search: combine vector similarity with BM25 keyword search; neither alone is sufficient
- Add a retrieval evaluation step during development: measure recall@k before shipping
- Context window pollution: retrieve the 3-5 most relevant chunks, not 15+. Diluting the context with marginally relevant chunks degrades generation quality

**Warning signs:**
- Users report "I added this document but the AI doesn't know about it"
- Retrieval returns results from completely unrelated documents
- Increasing chunk count doesn't improve answers

**Phase to address:** RAG/knowledge base phase. Design chunking strategy before ingesting any documents.

---

### Pitfall 9: SQLite Write Contention in Multi-Component Architecture

**Severity:** MODERATE

**What goes wrong:**
NexusAI's architecture will have multiple simultaneous writers: LLM chat saving messages, agent runs writing progress, email sync writing inbox, automations writing results, notes auto-saving. SQLite allows unlimited concurrent readers but only one writer at a time. Even with WAL mode (which allows readers during writes), write contention causes `SQLITE_BUSY` errors when multiple components try to write simultaneously.

**Why it happens:**
Developers use a single SQLite connection (wrapped in a Mutex) and discover that Tauri's async Rust commands all compete for the same lock under concurrent load.

**Consequences:**
- Agent runs stall waiting for database lock
- Email sync and chat saving fight for the write lock
- `SQLITE_BUSY` propagates to the UI as cryptic errors

**Prevention:**
- Enable WAL mode explicitly on database init: `PRAGMA journal_mode=WAL`
- Use a connection pool via `sqlx` with Tauri's SQL plugin — separate read pool (multiple connections) and write pool (single connection)
- Serialize all writes through a single Tokio task/channel to avoid lock contention at the Rust level
- Set `busy_timeout` (e.g., 5 seconds) so operations wait instead of failing immediately
- Design schema for append-heavy patterns: new rows over updates where possible

**Warning signs:**
- `SQLITE_BUSY` errors in logs
- UI operations timing out under load
- Agent runs failing when email sync is active

**Phase to address:** Core infrastructure phase. SQLite configuration must be set before any feature writes to the database.

---

### Pitfall 10: ChromaDB/Vector Store Concurrent Writer Corruption

**Severity:** MODERATE

**What goes wrong:**
If using ChromaDB in embedded mode (the likely choice for local-first desktop), two concurrent writers to the same Chroma directory will corrupt state. ChromaDB in embedded mode is a single-process database backed by SQLite — it is not designed for multiple processes or multiple async writers.

In NexusAI, concurrent writes can happen from: initial knowledge base ingestion, background email indexing, note saves, and agent memory writes.

**Why it happens:**
Embedded Chroma inherits SQLite's single-writer constraint but adds its own HNSW index which also isn't thread-safe for concurrent writes without explicit serialization.

**Consequences:**
- Database corruption requiring full re-ingestion
- Silent data loss (embeddings saved but index not updated)
- App crash during concurrent document processing

**Prevention:**
- Serialize ALL vector writes through a single dedicated Tokio task — never write from multiple concurrent async tasks
- Consider sqlite-vec (SQLite extension) instead of ChromaDB: runs directly in SQLite, avoids the separate process boundary, simpler lifecycle
- If using ChromaDB: treat it as a single-writer resource. Queue all ingestion jobs through a channel with a single consumer
- Implement write queue with backpressure: don't accept new ingestion if queue depth exceeds threshold

**Warning signs:**
- Vector search returns stale results after recent ingestion
- App crashes during bulk document import
- ChromaDB logs show lock errors

**Phase to address:** RAG/knowledge base phase. Vector store architecture decision before any ingestion code is written.

---

### Pitfall 11: Agent Infinite Loops Consuming Unlimited Tokens and API Budget

**Severity:** MODERATE–HIGH

**What goes wrong:**
Agents enter infinite loops through three primary mechanisms: (1) misinterpreting completion signals ("is it really done?"), (2) repetitive tool use without progress (calling the same API endpoint repeatedly on failure), (3) contextual re-anchoring (re-reading state to "make sure" then re-executing completed actions). Production deployments have documented agents sending identical responses 58-59 times in a row.

For NexusAI, this is especially dangerous: an automation agent with Gmail access and file write permissions looping infinitely could send hundreds of emails, write gigabytes of files, or burn through an entire API budget in minutes.

**Why it happens:**
LLM completion detection is probabilistic. Agents rely on the model to determine "done" — a fundamentally unreliable signal.

**Consequences:**
- Runaway API costs (hundreds of dollars in minutes)
- Unintended actions: duplicate emails sent, files overwritten repeatedly
- App becomes unresponsive while stuck agent monopolizes resources

**Prevention:**
Hard-coded external guardrails (not LLM-decided):
- **Turn limit**: Never allow more than N iterations (start with 25, let user configure)
- **Timeout**: Kill any agent run exceeding a wall-clock limit (e.g., 5 minutes)
- **Repetition detection**: Monitor sliding window of last 5 tool calls — if identical, force-terminate
- **Token budget**: Track cumulative tokens per agent run; abort at threshold
- **Semantic completion validator**: Verify completion independently from the agent's self-report
- **Destructive action gating**: Require explicit confirmation before any write operation (email send, file modification) beyond the first N uses

**Warning signs:**
- Agent run taking unusually long (>2 minutes for simple tasks)
- Same tool call appearing multiple times in agent logs
- Rapid API cost increase

**Phase to address:** Agent orchestration phase. Guardrails must be designed before exposing any tool-using agents to the user.

---

### Pitfall 12: MCP Server Process Lifecycle Chaos

**Severity:** MODERATE

**What goes wrong:**
NexusAI manages MCP servers as external subprocesses. Three failure modes are common: (1) Child processes become zombies if the parent Tauri app crashes or is force-killed — the MCP server keeps running in the background, consuming ports. (2) MCP protocol version mismatch — the spec had significant changes between the June 2025 and November 2025 versions; a server built against the old spec may silently fail to initialize against a newer client. (3) MCP stateful session management conflicts with the app's restart/reload cycle — sessions established before a UI hot-reload are orphaned.

Additionally: Rust-based MCP servers have documented compatibility issues with Claude Desktop (immediate disconnect after initialization), requiring Node.js wrapper shims.

**Why it happens:**
Subprocess lifecycle in a Tauri app is managed through the `shell` plugin, which doesn't automatically clean up child processes on unexpected app exit. MCP's evolving spec means library versions matter significantly.

**Consequences:**
- Orphaned MCP processes consuming ports after app restart
- Users unable to reconnect to MCP servers without rebooting
- Silent MCP initialization failures that look like network issues

**Prevention:**
- Register MCP subprocesses with OS-level process groups so they're killed with the parent
- Implement an explicit cleanup routine in Tauri's `on_window_event(WindowEvent::CloseRequested)` and `on_page_load` hooks
- Track all spawned MCP PIDs in Tauri state; kill them explicitly on app exit
- Pin MCP client library to a specific spec version; document the version in server requirements
- Implement health-check ping to each MCP server on app startup; respawn if dead
- For user-provided MCP servers: sandbox them — use Tauri's capability system to limit what permissions they can request

**Warning signs:**
- Port already in use errors on app restart
- MCP tools listed as available but calls return errors
- MCP subprocess not appearing in activity monitor after app close

**Phase to address:** MCP management phase. Process lifecycle must be designed before MCP UI is built.

---

## Minor Pitfalls

Mistakes that cause friction but are recoverable without major rework.

---

### Pitfall 13: Platform WebView Divergence (Windows WebView2 vs macOS WKWebView)

**Severity:** MINOR–MODERATE

**What goes wrong:**
Tauri uses the OS-native WebView: WebView2 (Chromium-based) on Windows and WKWebView (WebKit) on macOS. They have meaningfully different CSS rendering, JavaScript engine behavior, and font rendering. Things that look correct on macOS may be broken on Windows and vice versa. Additionally, WebView2 may not be present on older Windows machines and requires a separate installer or bootstrapper.

**Why it happens:**
Developers build and test primarily on one platform. The other platform's WebView engine produces different results for the same code.

**Consequences:**
- UI differences between platforms that require platform-specific CSS
- WebView2 absence on end-user machine causes app to fail to launch
- Subtle JavaScript behavior differences in edge cases

**Prevention:**
- Test on both platforms from the first UI milestone, not at "launch time"
- Use Tauri's `TAURI_PLATFORM` env var to conditionally load platform-specific CSS if needed
- Bundle the WebView2 bootstrapper with the Windows installer (`webview2InstallMode: "embedBootstrapper"` in tauri.conf.json)
- Avoid CSS features not supported in WebKit (check caniuse.com against Safari/WebKit, not Chrome)

**Phase to address:** Every phase that touches UI — set up a Windows test environment from day one.

---

### Pitfall 14: Tokio Async Blocking on CPU-Intensive Rust Operations

**Severity:** MINOR–MODERATE

**What goes wrong:**
Tauri commands run on Tokio's async runtime. CPU-intensive operations — embedding generation, file parsing, chunking large documents — if run directly as `async fn`, block Tokio's executor threads and starve other async tasks. This causes UI commands (like "show me the current status") to timeout while a background indexing job runs.

**Why it happens:**
Developers familiar with JavaScript `async/await` expect that long-running async functions in Rust yield to other tasks. They don't — they block the executor thread for as long as they compute.

**Consequences:**
- UI commands time out during background indexing
- App appears frozen while processing documents
- IPC calls for status updates don't return

**Prevention:**
- Wrap all CPU-intensive operations in `tokio::task::spawn_blocking(|| { ... })` — this moves them off the async executor onto a dedicated thread pool
- For embedding generation, implement a dedicated worker pool with bounded channel for job submission
- Add progress events via Channel API so the frontend receives incremental status updates, not just a final result

**Phase to address:** Knowledge base ingestion phase and any phase involving background computation.

---

### Pitfall 15: LLM Rate Limiting Causes Silent Feature Failures

**Severity:** MINOR–MODERATE

**What goes wrong:**
NexusAI's agent orchestration, automation pipelines, and the LLM benchmark feature will all make concurrent LLM API calls. Most providers apply rate limits at both the requests-per-minute (RPM) and tokens-per-minute (TPM) level. The benchmark feature (same prompt across multiple models) is particularly likely to trigger rate limits. Without explicit rate limit handling, failures appear as generic errors or silent timeouts.

**Why it happens:**
Rate limits are per-API-key and vary by tier. Developers on paid tiers don't hit them in development, but users on free/lower tiers will hit them constantly.

**Consequences:**
- Benchmark feature fails for users on free API tiers
- Agent runs partially complete and fail mid-task
- Automations silently stop working during high-usage periods

**Prevention:**
- Implement exponential backoff with jitter on all LLM API calls — detect 429 responses and retry
- Add a global rate limit tracker: estimate tokens used per minute across all concurrent calls
- Serialize concurrent LLM calls through a queue with configurable concurrency limit
- Surface rate limit state in the UI: "waiting for rate limit reset in 45s"
- For the benchmark feature: add configurable delay between model calls

**Phase to address:** LLM provider integration phase.

---

### Pitfall 16: Multi-Window Shared State Race Conditions

**Severity:** MINOR**

**What goes wrong:**
If NexusAI ever opens multiple windows (e.g., a detached chat window, a note editor), each window has its own webview process with its own JavaScript memory. Zustand or other frontend state stores are NOT shared across windows. Mutations in one window are invisible to the other. The Rust backend's `Mutex<State>` is shared, but the frontend must explicitly sync state between windows via Tauri events.

**Why it happens:**
Single-window app patterns don't reveal this until a second window is opened. The state synchronization requirement is non-obvious.

**Consequences:**
- Note edited in window A doesn't appear updated in window B until app restart
- Chat history visible in one window not reflected in another
- State desync causes confusing behavior

**Prevention:**
- Treat Rust state as the single source of truth for anything that needs to be shared across windows
- Emit Tauri events from Rust to ALL windows on any state mutation that should be visible globally
- If using Zustand: implement a sync layer that listens for Tauri events and updates the store accordingly
- Design with single-window architecture first; add multi-window only as an explicit feature

**Phase to address:** Dashboard/multi-module integration phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Project setup | Updater private key not backed up | Generate and back up keypair before first build |
| Project setup | macOS notarization not planned | Set up Apple Developer account and entitlements in config from day one |
| LLM chat | IPC JSON overhead for token streaming | Use Channel API for streaming, not `emit()` |
| LLM chat | Event emission memory leak | Use Channel API, batch tokens, test memory over 30+ minute sessions |
| LLM chat | Context rot in long conversations | Implement sliding window summarization before shipping chat feature |
| Knowledge base | Fixed-size chunking killing retrieval quality | Design semantic chunking strategy before ingesting any documents |
| Knowledge base | ChromaDB concurrent write corruption | Single-writer serialization queue must be in place before any async ingestion |
| Knowledge base | CPU-intensive embedding blocking Tokio | Use `spawn_blocking` for all embedding generation |
| Gmail integration | OAuth token revocation not handled | Implement `invalid_grant` detection and re-auth flow before any Gmail feature |
| Gmail integration | App still in "Testing" mode | Publish to production OAuth consent before any real use |
| Agent orchestration | No hard guardrails on agent loops | Implement turn limit + timeout + repetition detection BEFORE giving agent tools |
| Agent orchestration | Tool errors not recoverable | Define error taxonomy; agents must have explicit fallback for each tool failure mode |
| MCP management | Orphaned subprocesses after crash | Implement process group tracking in Tauri close handler |
| MCP management | Protocol version mismatch | Pin MCP spec version, document in server compatibility matrix |
| Distribution | Windows SmartScreen blocking installs | Set up OV cert + Azure Key Vault signing pipeline before any public release |
| Distribution | macOS notarization failing | WebView entitlements must be in `entitlements.plist` before first notarized build |
| Distribution | EV cert CI signing bug | Use issuer-specific guide, not generic Tauri guide |

---

## Sources

- [Tauri IPC Bottlenecks and Memory Issues — Tauri/Rust Under Pressure (Medium)](https://medium.com/@srish5945/tauri-rust-speed-but-heres-where-it-breaks-under-pressure-fef3e8e2dcb3)
- [Memory leak when emitting events — Tauri GitHub Issue #12724](https://github.com/tauri-apps/tauri/issues/12724)
- [Memory leaks when reading files — Tauri GitHub Issue #9190](https://github.com/tauri-apps/tauri/issues/9190)
- [Tauri IPC Performance Discussion #11915](https://github.com/orgs/tauri-apps/discussions/11915)
- [IPC and Frontend-Backend Communication — Tauri Official Docs](https://v2.tauri.app/concept/inter-process-communication/)
- [Tauri State Management — Official Docs](https://v2.tauri.app/develop/state-management/)
- [Windows Code Signing — Tauri v2 Official](https://v2.tauri.app/distribute/sign/windows/)
- [macOS Code Signing — Tauri v2 Official](https://v2.tauri.app/distribute/sign/macos/)
- [Ship Tauri v2 App — Code Signing Guide (DEV Community)](https://dev.to/tomtomdu73/ship-your-tauri-v2-app-like-a-pro-code-signing-for-macos-and-windows-part-12-3o9n)
- [Tauri Updater Plugin — Official Docs](https://v2.tauri.app/plugin/updater/)
- [macOS Notarization Issues — Tauri Discussion #8693](https://github.com/orgs/tauri-apps/discussions/8693)
- [ExternalBin Notarization Bug — Tauri Issue #11992](https://github.com/tauri-apps/tauri/issues/11992)
- [Google OAuth for Native/Desktop Apps — Google for Developers](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google OAuth invalid_grant: Token expired or revoked — Nango Blog](https://nango.dev/blog/google-oauth-invalid-grant-token-has-been-expired-or-revoked/)
- [AI Agent Infinite Loop Prevention](https://www.fixbrokenaiapps.com/blog/ai-agents-infinite-loops)
- [Multi-Agent LLM Systems Failure Analysis — Galileo](https://galileo.ai/blog/multi-agent-llm-systems-fail)
- [Agent Deployment Gap — ZenML Blog](https://www.zenml.io/blog/the-agent-deployment-gap-why-your-llm-loop-isnt-production-ready-and-what-to-do-about-it)
- [MCP 2026 Roadmap — Model Context Protocol Blog](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)
- [RAG Production Guide 2026 — Lushbinary](https://lushbinary.com/blog/rag-retrieval-augmented-generation-production-guide/)
- [Chunking Strategies for RAG — DEV Community](https://dev.to/klement_gunndu/10-chunking-strategies-that-make-or-break-your-rag-pipeline-4cng)
- [LLM Context Window Overflow — Redis Blog](https://redis.io/blog/context-window-overflow/)
- [SQLite Locking and Concurrency — MindfulChase](https://mindfulchase.com/explore/troubleshooting-tips/databases/troubleshooting-sqlite-locking-and-concurrency-issues-in-scalable-applications.html)
- [ChromaDB Single-Node Performance — Chroma Docs](https://docs.trychroma.com/guides/deploy/performance)
- [Windows EV Certificate Custom Signing Bug — Tauri Issue #11754](https://github.com/tauri-apps/tauri/issues/11754)
