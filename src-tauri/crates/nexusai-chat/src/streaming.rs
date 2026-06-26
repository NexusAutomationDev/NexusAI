//! stream_chat Tauri command — the core of LLM Chat (CHAT-01).
//! Uses Channel<StreamEvent> per FOUND-05 (never emit() in a loop).
//! Sends full conversation history to support mid-conversation model switching (D-23).

use std::collections::HashMap;
use std::sync::Arc;
use futures::StreamExt;
use tauri::ipc::Channel;
use tokio::sync::{watch, Mutex};
use async_openai::types::CreateChatCompletionRequestArgs;
use nexusai_settings::StreamEvent;
use crate::providers::build_client;
use crate::schema::StreamChatInput;

type CancelMap = Arc<Mutex<HashMap<String, watch::Sender<bool>>>>;

lazy_static::lazy_static! {
    static ref CANCEL_MAP: CancelMap = Arc::new(Mutex::new(HashMap::new()));
}

pub async fn stream_chat_impl(
    input: StreamChatInput,
    on_event: Channel<StreamEvent>,
) -> Result<(), String> {
    let (client, model) = build_client(&input.model)?;

    let api_messages = crate::providers::build_api_messages(&input.messages)?;

    let request = CreateChatCompletionRequestArgs::default()
        .model(&model)
        .messages(api_messages)
        .stream(true)
        .build()
        .map_err(|e| e.to_string())?;

    let (cancel_tx, mut cancel_rx) = watch::channel(false);
    {
        let mut map = CANCEL_MAP.lock().await;
        map.insert(input.conversation_id.clone(), cancel_tx);
    }

    let mut stream = client
        .chat()
        .create_stream(request)
        .await
        .map_err(|e| format!("API error: {e}"))?;

    loop {
        tokio::select! {
            chunk = stream.next() => {
                match chunk {
                    None => break,
                    Some(Err(e)) => {
                        on_event.send(StreamEvent::Error { message: e.to_string() }).ok();
                        break;
                    }
                    Some(Ok(response)) => {
                        if let Some(choice) = response.choices.first() {
                            if let Some(delta_content) = &choice.delta.content {
                                on_event.send(StreamEvent::Token {
                                    text: delta_content.clone(),
                                }).ok();
                            }
                            if choice.finish_reason.is_some() {
                                break;
                            }
                        }
                    }
                }
            }
            _ = cancel_rx.changed() => {
                if *cancel_rx.borrow() {
                    break;
                }
            }
        }
    }

    on_event.send(StreamEvent::Done).ok();

    let mut map = CANCEL_MAP.lock().await;
    map.remove(&input.conversation_id);

    Ok(())
}

pub async fn stop_streaming_impl(conversation_id: String) -> Result<(), String> {
    let map = CANCEL_MAP.lock().await;
    if let Some(tx) = map.get(&conversation_id) {
        tx.send(true).ok();
    }
    Ok(())
}
