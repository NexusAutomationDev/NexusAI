//! Local ONNX embeddings via fastembed (KB-07, criterion #5 = offline).
//! Wave 0: contract + RED integration test (#[ignore]); impl in Plan 03-02.
//!
//! Run (after model cached, network OFF): `cargo test -p nexusai-kb offline -- --ignored`

use fastembed::TextEmbedding;
use std::path::PathBuf;

/// Load the MultilingualE5Small model (384-dim, strong PT-BR) from `cache_dir`.
///
/// RED stub — real implementation lands in Plan 03-02.
pub fn load_model(_cache_dir: PathBuf) -> anyhow::Result<TextEmbedding> {
    unimplemented!("load_model implemented in Plan 03-02")
}

/// Embed index passages. E5 expects a "passage: " prefix per text.
///
/// RED stub — real implementation lands in Plan 03-02.
pub fn embed_passages(_model: &TextEmbedding, _texts: &[String]) -> anyhow::Result<Vec<Vec<f32>>> {
    unimplemented!("embed_passages implemented in Plan 03-02")
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
        let model = load_model(cache_dir).expect("load cached model offline");
        let vectors =
            embed_passages(&model, &["uma frase em português".to_string()]).expect("embed");
        assert_eq!(vectors.len(), 1, "one input → one vector");
        assert_eq!(
            vectors[0].len(),
            384,
            "MultilingualE5Small produces 384-dim vectors"
        );
    }
}
