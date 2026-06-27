//! Ingestion: file/url/note → raw text (KB-01, KB-04).
//! Wave 0: contract + RED test for URL scraping; impl in Plan 03-01.
//!
//! Run: `cargo test -p nexusai-kb scrape`

/// Main-content extraction result from an HTML page (Readability-style).
#[derive(Debug, Clone)]
pub struct ExtractedArticle {
    pub title: String,
    pub text_content: String,
}

/// Extract the main article content from raw HTML, stripping nav/header/footer
/// chrome (via dom_smoothie).
///
/// RED stub — real implementation lands in Plan 03-01.
pub fn extract_article(_html: &str) -> anyhow::Result<ExtractedArticle> {
    unimplemented!("extract_article implemented in Plan 03-01")
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
