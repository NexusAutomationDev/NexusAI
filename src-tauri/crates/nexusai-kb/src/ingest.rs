//! Ingestion: file/url/note → raw text (KB-01, KB-04).
//! Plan 03-01: parse files by extension, scrape URLs, extract main article body.
//!
//! Run: `cargo test -p nexusai-kb scrape`

use std::path::Path;

use anyhow::{anyhow, bail};
use docx_rust::document::BodyContent;
use docx_rust::DocxFile;
use dom_smoothie::Readability;

/// Main-content extraction result from an HTML page (Readability-style).
#[derive(Debug, Clone)]
pub struct ExtractedArticle {
    pub title: String,
    pub text_content: String,
}

/// Parse a local file into clean UTF-8 text, dispatching by lowercased extension.
///
/// - `pdf` → text layer via `pdf-extract`
/// - `docx` → paragraph text via `docx-rust`, joined with blank lines
/// - `md` | `txt` → raw UTF-8 read (no normalization; respects D-08)
/// - otherwise → error with PT-BR reason
pub fn parse_file(path: &str) -> anyhow::Result<String> {
    let ext = Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_ascii_lowercase())
        .unwrap_or_default();

    match ext.as_str() {
        "pdf" => Ok(pdf_extract::extract_text(path)?),
        "docx" => parse_docx(path),
        "md" | "txt" => Ok(std::fs::read_to_string(path)?),
        _ => bail!("Codificação não suportada"),
    }
}

/// Read a .docx file and concatenate its paragraph text, separating paragraphs
/// with a blank line so the chunker sees paragraph-aware boundaries.
fn parse_docx(path: &str) -> anyhow::Result<String> {
    let docx_file = DocxFile::from_file(path).map_err(|e| anyhow!("{e:?}"))?;
    let docx = docx_file.parse().map_err(|e| anyhow!("{e:?}"))?;

    let paragraphs: Vec<String> = docx
        .document
        .body
        .content
        .iter()
        .filter_map(|content| match content {
            BodyContent::Paragraph(para) => Some(para.text()),
            _ => None,
        })
        .collect();

    Ok(paragraphs.join("\n\n"))
}

/// Fetch a URL's raw HTML using a desktop User-Agent. Non-2xx responses fail.
pub async fn fetch_url(url: &str) -> anyhow::Result<String> {
    let client = reqwest::Client::new();
    let resp = client
        .get(url)
        .header(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NexusAI/1.0",
        )
        .send()
        .await?;

    if !resp.status().is_success() {
        bail!("Falha ao buscar URL");
    }

    Ok(resp.text().await?)
}

/// Extract the main article content from raw HTML, stripping nav/header/footer
/// chrome (via dom_smoothie Readability). Empty extraction is treated as a
/// dynamic/JS-rendered page (D-13 / KB-04).
pub fn extract_article(html: &str) -> anyhow::Result<ExtractedArticle> {
    let mut readability =
        Readability::new(html, None, None).map_err(|e| anyhow!("{e}"))?;
    let article = readability.parse().map_err(|e| anyhow!("{e}"))?;

    let text_content = article.text_content.to_string();
    if text_content.trim().is_empty() {
        bail!("Conteúdo não encontrado (página dinâmica)");
    }

    Ok(ExtractedArticle {
        title: article.title.to_string(),
        text_content,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn article_html() -> String {
        std::fs::read_to_string(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/tests/fixtures/article.html"
        ))
        .expect("article.html fixture must exist")
    }

    #[test]
    fn test_scrape_strips_chrome() {
        let article = extract_article(&article_html()).expect("extract article");
        // The unique article-body sentence must survive.
        assert!(
            article.text_content.contains("FRASE_PRINCIPAL_DO_ARTIGO_UNICA"),
            "article body sentence must be present in text_content"
        );
        // Navigation, sidebar, and footer boilerplate must be stripped.
        assert!(
            !article.text_content.contains("MENU_NAVEGACAO_BOILERPLATE"),
            "nav boilerplate must be removed"
        );
        assert!(
            !article.text_content.contains("RODAPE_DIREITOS_RESERVADOS"),
            "footer boilerplate must be removed"
        );
    }
}
