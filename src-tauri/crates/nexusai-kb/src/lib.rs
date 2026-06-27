// Phase 3: Knowledge Base crate.
// Wave 0 (Plan 03-00): modules declared with contract signatures + RED tests.
// Real implementations land in Plans 03-01 (chunk/ingest), 03-02 (vector/search/embed),
// 03-03 (store). Until then the `pub fn` bodies are `unimplemented!()` so the crate
// compiles but the tests fail (RED).

pub mod chunk;
pub mod vector;
pub mod search;
pub mod ingest;
pub mod embed;
pub mod store;
