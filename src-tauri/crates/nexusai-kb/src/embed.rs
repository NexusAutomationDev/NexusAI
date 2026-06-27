//! Local ONNX embeddings via fastembed (KB-07, criterion #5 = offline).
//!
//! Model: MultilingualE5Small (384-dim, strong PT-BR per D-15). Loaded once and
//! reused for all embeddings. ALL inference is local; the only network step is the
//! one-time model download into `cache_dir` (Pitfall 2 — treat as a setup step).
//!
//! Run (after model cached, network OFF): `cargo test -p nexusai-kb offline -- --ignored`

use fastembed::{EmbeddingModel, TextEmbedding, TextInitOptions};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

/// Load the MultilingualE5Small model (384-dim, strong PT-BR) from `cache_dir`.
///
/// D-15: MultilingualE5Small handles Brazilian Portuguese natively. The ONNX model
/// is downloaded once (network) and cached in `cache_dir`; subsequent loads are
/// fully offline. Use a Tauri app-data path so the model persists across launches.
pub fn load_model(cache_dir: PathBuf) -> anyhow::Result<TextEmbedding> {
    Ok(TextEmbedding::try_new(
        // NOTE: fastembed 5.17 deprecated the `InitOptions` alias in favour of
        // `TextInitOptions` — same builder, no deprecation warning.
        TextInitOptions::new(EmbeddingModel::MultilingualE5Small)
            .with_cache_dir(cache_dir)
            .with_show_download_progress(true),
    )?)
}

/// Embed index passages. E5 expects a "passage: " prefix per text.
///
/// `model` is `&mut` because fastembed 5.17's `TextEmbedding::embed` takes `&mut self`
/// (it runs the ONNX session). Callers go through [`global_model`] which wraps the
/// singleton in a `Mutex` to provide the mutable borrow.
pub fn embed_passages(
    model: &mut TextEmbedding,
    texts: &[String],
) -> anyhow::Result<Vec<Vec<f32>>> {
    let prefixed: Vec<String> = texts.iter().map(|t| format!("passage: {t}")).collect();
    Ok(model.embed(prefixed, None)?)
}

/// Embed a single query. E5 expects a "query: " prefix.
pub fn embed_query(model: &mut TextEmbedding, q: &str) -> anyhow::Result<Vec<f32>> {
    Ok(model.embed(vec![format!("query: {q}")], None)?.remove(0))
}

lazy_static::lazy_static! {
    /// Process-wide singleton so the ONNX model loads exactly once.
    /// Mirrors the chat crate's `CANCEL_MAP` lazy_static pattern. Wrapped in a
    /// `Mutex` because `embed` needs `&mut TextEmbedding`.
    static ref GLOBAL_MODEL: Mutex<Option<(PathBuf, Arc<Mutex<TextEmbedding>>)>> =
        Mutex::new(None);
}

/// Get the process-wide MultilingualE5Small model, loading it once on first call.
///
/// Plan 03-03 calls this from its `query_kb`/`import_*` commands so the ONNX model
/// is loaded a single time for the app's lifetime. The returned `Arc<Mutex<..>>` is
/// locked per embedding call (`embed` requires `&mut self`).
///
/// If called again with a DIFFERENT `cache_dir`, the model is reloaded for the new
/// path (covers tests / cache relocation).
pub fn global_model(cache_dir: &Path) -> anyhow::Result<Arc<Mutex<TextEmbedding>>> {
    let mut guard = GLOBAL_MODEL.lock().expect("GLOBAL_MODEL poisoned");
    if let Some((dir, model)) = guard.as_ref() {
        if dir == cache_dir {
            return Ok(Arc::clone(model));
        }
    }
    let model = Arc::new(Mutex::new(load_model(cache_dir.to_path_buf())?));
    *guard = Some((cache_dir.to_path_buf(), Arc::clone(&model)));
    Ok(model)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Criterion #5: embedding works fully offline once the model is cached.
    /// Run with the network DISABLED after the model has been downloaded once:
    ///   `cargo test -p nexusai-kb offline -- --ignored`
    #[test]
    #[ignore = "requires pre-cached model + network OFF (criterion #5)"]
    fn test_offline_embedding() {
        let cache_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/.model-cache");
        let mut model = load_model(cache_dir).expect("load cached model offline");
        let vectors =
            embed_passages(&mut model, &["uma frase em português".to_string()]).expect("embed");
        assert_eq!(vectors.len(), 1, "one input → one vector");
        assert_eq!(
            vectors[0].len(),
            384,
            "MultilingualE5Small produces 384-dim vectors"
        );
    }
}
