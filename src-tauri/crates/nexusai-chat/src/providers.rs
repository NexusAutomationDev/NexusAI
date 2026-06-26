//! LLM provider client factory.
//! Supports OpenAI (direct), OpenRouter (OpenAI-compatible), and Gemini (via OpenRouter).
//! API keys read from OS Keychain — NEVER passed as Tauri command arguments.

use async_openai::{
    config::OpenAIConfig,
    types::{
        ChatCompletionRequestMessage, ChatCompletionRequestUserMessageContent,
        ChatCompletionRequestUserMessageContentPart,
    },
    Client,
};
use keyring::Entry;
use crate::schema::{ChatMessage, MessageRole};

const SERVICE: &str = "nexusai";

pub enum Provider {
    OpenAI,
    OpenRouter,
    Gemini,
}

/// Determine which provider backend handles a given model ID.
pub fn provider_for_model(model: &str) -> Provider {
    if model.starts_with("anthropic/")
        || model.starts_with("google/")
        || model.starts_with("openrouter/")
        || model.starts_with("meta-llama/")
        || model.starts_with("mistralai/")
    {
        Provider::OpenRouter
    } else if model.starts_with("gemini") {
        Provider::Gemini
    } else {
        Provider::OpenAI
    }
}

/// Build an async-openai Client configured for the correct provider.
/// Returns Err if the API key is not configured in OS Keychain.
pub fn build_client(model: &str) -> Result<(Client<OpenAIConfig>, String), String> {
    match provider_for_model(model) {
        Provider::OpenAI => {
            let key = get_keychain_key("openai")?;
            let config = OpenAIConfig::new().with_api_key(key);
            Ok((Client::with_config(config), model.to_string()))
        }
        Provider::OpenRouter => {
            let key = get_keychain_key("openrouter")?;
            let config = OpenAIConfig::new()
                .with_api_key(key)
                .with_api_base("https://openrouter.ai/api/v1");
            Ok((Client::with_config(config), model.to_string()))
        }
        Provider::Gemini => {
            let key = get_keychain_key("gemini")?;
            let config = OpenAIConfig::new()
                .with_api_key(key)
                .with_api_base("https://generativelanguage.googleapis.com/v1beta/openai");
            Ok((Client::with_config(config), model.to_string()))
        }
    }
}

fn get_keychain_key(provider: &str) -> Result<String, String> {
    let entry = Entry::new(SERVICE, provider)
        .map_err(|e| format!("Keychain error: {e}"))?;
    entry.get_password()
        .map_err(|_| format!("API key not configured for provider '{provider}'. Configure it in Settings → API Keys."))
}

/// Build the async-openai message list from a Vec<ChatMessage>.
/// Per D-23: full conversation history is always sent (not just the latest message).
pub fn build_api_messages(
    messages: &[ChatMessage],
) -> Result<Vec<ChatCompletionRequestMessage>, String> {
    messages.iter().map(|msg| {
        let role = match msg.role {
            MessageRole::User => async_openai::types::Role::User,
            MessageRole::Assistant => async_openai::types::Role::Assistant,
        };

        // Text-only messages
        if msg.attachments.as_ref().map(|a| a.is_empty()).unwrap_or(true) {
            let request_msg = match role {
                async_openai::types::Role::User => {
                    ChatCompletionRequestMessage::User(
                        async_openai::types::ChatCompletionRequestUserMessage {
                            content: ChatCompletionRequestUserMessageContent::Text(
                                msg.content.clone()
                            ),
                            name: None,
                        }
                    )
                }
                async_openai::types::Role::Assistant => {
                    ChatCompletionRequestMessage::Assistant(
                        async_openai::types::ChatCompletionRequestAssistantMessage {
                            content: Some(async_openai::types::ChatCompletionRequestAssistantMessageContent::Text(
                                msg.content.clone()
                            )),
                            name: None,
                            tool_calls: None,
                            function_call: None,
                            refusal: None,
                            audio: None,
                        }
                    )
                }
                _ => {
                    return Err(format!("Unsupported role: {:?}", role));
                }
            };
            return Ok(request_msg);
        }

        // Multimodal messages with attachments — base64 inline (D-18)
        // Only user messages can have attachments
        let mut parts: Vec<ChatCompletionRequestUserMessageContentPart> = vec![
            ChatCompletionRequestUserMessageContentPart::Text(
                async_openai::types::ChatCompletionRequestMessageContentPartText {
                    text: msg.content.clone(),
                }
            ),
        ];

        if let Some(attachments) = &msg.attachments {
            for att in attachments {
                let data_url = format!("data:{};base64,{}", att.mime_type, att.base64_data);
                let image_part = ChatCompletionRequestUserMessageContentPart::ImageUrl(
                    async_openai::types::ChatCompletionRequestMessageContentPartImage {
                        image_url: async_openai::types::ImageUrl {
                            url: data_url,
                            detail: None,
                        },
                    }
                );
                parts.push(image_part);
            }
        }

        Ok(ChatCompletionRequestMessage::User(
            async_openai::types::ChatCompletionRequestUserMessage {
                content: ChatCompletionRequestUserMessageContent::Array(parts),
                name: None,
            }
        ))
    }).collect()
}
