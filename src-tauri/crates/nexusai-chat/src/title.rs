//! Auto-generate conversation title from first user/assistant exchange (D-06).
//! Called after the first AI response completes in a new conversation.

use async_openai::types::{
    ChatCompletionRequestMessage, ChatCompletionRequestUserMessage,
    ChatCompletionRequestUserMessageContent, CreateChatCompletionRequestArgs,
};
use crate::providers::build_client;
use crate::schema::{GenerateTitleInput, GenerateTitleOutput};

/// Generate a concise 3-8 word conversation title using the LLM (D-06).
/// Uses a non-streaming single-completion call (title generation is fast, <1s).
/// Falls back to a truncated first-message title if the API call fails.
pub async fn generate_conversation_title_impl(
    input: GenerateTitleInput,
) -> Result<GenerateTitleOutput, String> {
    let (client, model) = build_client(&input.model)?;

    let user_snippet = &input.first_user_message
        [..input.first_user_message.len().min(200)];
    let assistant_snippet = &input.first_assistant_message
        [..input.first_assistant_message.len().min(200)];

    let prompt = format!(
        "Generate a concise 3-8 word title for this conversation. Return ONLY the title, no quotes, no punctuation at the end.\n\nUser: {}\nAssistant: {}\n\nTitle:",
        user_snippet,
        assistant_snippet,
    );

    let messages = vec![
        ChatCompletionRequestMessage::User(ChatCompletionRequestUserMessage {
            content: ChatCompletionRequestUserMessageContent::Text(prompt),
            name: None,
        }),
    ];

    let request = CreateChatCompletionRequestArgs::default()
        .model(&model)
        .messages(messages)
        .max_tokens(20u32) // Title should be very short
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .chat()
        .create(request)
        .await
        .map_err(|e| format!("Title generation API error: {e}"))?;

    let title = response
        .choices
        .first()
        .and_then(|c| c.message.content.as_ref())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| {
            // Fallback: truncate first user message to 50 chars
            let truncated = &input.first_user_message
                [..input.first_user_message.len().min(50)];
            truncated.trim().to_string()
        });

    Ok(GenerateTitleOutput { title })
}
