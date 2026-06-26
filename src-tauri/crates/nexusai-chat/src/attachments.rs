//! File picker and base64 encoder for chat attachments (CHAT-04, D-15 to D-19).

use std::path::Path;
use crate::schema::FileAttachment;

const MAX_FILE_SIZE_BYTES: u64 = 10 * 1024 * 1024; // D-17: 10MB limit

const ALLOWED_TYPES: &[(&str, &str)] = &[
    ("png", "image/png"),
    ("jpg", "image/jpeg"),
    ("jpeg", "image/jpeg"),
    ("webp", "image/webp"),
    ("pdf", "application/pdf"),
    ("txt", "text/plain"),
    ("md", "text/markdown"),
    (
        "docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ),
];

pub async fn pick_and_encode_file_impl(app: tauri::AppHandle) -> Result<FileAttachment, String> {
    use tauri_plugin_dialog::DialogExt;

    let file_path = app
        .dialog()
        .file()
        .add_filter(
            "Imagens e Documentos",
            &["png", "jpg", "jpeg", "webp", "pdf", "txt", "md", "docx"],
        )
        .blocking_pick_file()
        .ok_or_else(|| "Seleção cancelada".to_string())?;

    let path_str = file_path.to_string_lossy().to_string();
    let path = Path::new(&path_str);

    // Validate extension — T-02-02-01: allowlist prevents path traversal via mime-type confusion
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mime_type = ALLOWED_TYPES
        .iter()
        .find(|(e, _)| *e == ext.as_str())
        .map(|(_, m)| *m)
        .ok_or_else(|| format!("Tipo de arquivo não suportado: .{ext}"))?;

    let contents = std::fs::read(path).map_err(|e| format!("Erro ao ler arquivo: {e}"))?;

    // Enforce size limit — T-02-02-02: prevents DoS via large file encoding
    let file_size = contents.len() as u64;
    if file_size > MAX_FILE_SIZE_BYTES {
        return Err(format!(
            "Arquivo muito grande. Tamanho: {}MB. Limite: 10MB.",
            file_size / (1024 * 1024)
        ));
    }

    use base64::Engine;
    let base64_data =
        base64::engine::general_purpose::STANDARD.encode(&contents);

    let filename = path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // Sanitize filename — T-02-02-01: strip directory separators
    let safe_filename = filename
        .replace(['/', '\\', '.'], "_")
        .replace("__", "_");

    Ok(FileAttachment {
        filename: safe_filename,
        mime_type: mime_type.to_string(),
        base64_data,
        file_size_bytes: file_size,
    })
}
