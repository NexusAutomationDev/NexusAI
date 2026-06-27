/**
 * Message input component (D-09: bottom-fixed in chat view).
 *
 * Handles:
 * - Auto-growing textarea (react-textarea-autosize, max 200px, D-27: Enter/Shift+Enter)
 * - Model picker (D-20: per-message, dropdown next to send button)
 * - File attachment — BOTH paperclip button AND drag-drop zone (D-15: both required)
 *   - Paperclip: calls pickFile() → invoke('pick_and_encode_file') via Rust file dialog
 *   - Drag-drop: listens to Tauri window onDragDropEvent, encodes dropped paths via
 *     invoke('encode_file_from_path') — DataTransfer API is empty in Tauri webviews
 * - Send/Stop/Regenerate controls (D-14)
 * - Inline error display (D-25)
 * - Title auto-generation (D-06: after first AI response)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import TextareaAutosize from "react-textarea-autosize";
import { Send, Square, Paperclip, AlertCircle, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/lib/stores/chat";
import { useSettingsStore, PROVIDER_LABELS, type ProviderId } from "@/lib/stores/settings";
import {
  useInsertUserMessage,
  useInsertAiMessage,
  useUpdateConversationTitle,
  useMessages,
} from "@/lib/queries/chat";
import { FileAttachmentPreview } from "./FileAttachmentPreview";
import type { NewMessage } from "@/lib/db/schema";
import type { FileAttachment } from "@/lib/stores/chat";
import {
  retrieveForQuery,
  buildCitationPrompt,
  embedCitations,
  type Citation,
} from "@/lib/kb/citations";

interface MessageInputProps {
  conversationId: string;
  onSendComplete?: () => void;
  editDraft?: string | null;         // D-24: pre-fill textarea with edited message content
  onEditDraftConsumed?: () => void;  // D-24: called after textarea is populated
}

export function MessageInput({ conversationId, onSendComplete, editDraft, onEditDraftConsumed }: MessageInputProps) {
  const [inputText, setInputText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isStreaming,
    currentModel,
    setCurrentModel,
    kbScope,
    setKbScope,
    pendingAttachments,
    addAttachment,
    removeAttachment,
    clearAttachments,
    startStream,
    stopStream,
    pickFile,
  } = useChatStore();

  const { mutateAsync: insertUserMessage } = useInsertUserMessage();
  const { mutateAsync: insertAiMessage } = useInsertAiMessage();
  const { mutateAsync: updateTitle } = useUpdateConversationTitle();
  const { data: existingMessages = [] } = useMessages(conversationId);

  // D-22: Default to last model used in conversation (via settings.chatModel fallback)
  const chatModel = useSettingsStore((s) => s.chatModel);
  // availableModels is pre-computed in the store (refreshed on load + after key changes)
  // — reading from store avoids invoke() calls inside this component on every render
  const availableModels = useSettingsStore((s) => s.availableModels);

  // Group available models by provider for the Select dropdown
  const modelsByProvider = availableModels.reduce<Record<ProviderId, typeof availableModels>>((acc, m) => {
    if (!acc[m.provider]) acc[m.provider] = [];
    acc[m.provider].push(m);
    return acc;
  }, {} as Record<ProviderId, typeof availableModels>);

  useEffect(() => {
    if (!currentModel) setCurrentModel(chatModel);
  }, [chatModel, currentModel, setCurrentModel]);

  // Auto-switch model if current model is no longer in availableModels (provider key removed)
  useEffect(() => {
    if (availableModels.length > 0 && !availableModels.find(m => m.value === currentModel)) {
      setCurrentModel(availableModels[0].value);
    }
  }, [availableModels, currentModel, setCurrentModel]);

  // D-24: Pre-fill textarea when edit draft is provided
  useEffect(() => {
    if (editDraft) {
      setInputText(editDraft);
      // Move cursor to end of text
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 0);
      onEditDraftConsumed?.();
    }
  }, [editDraft, onEditDraftConsumed]);

  // D-15: Tauri window drag-drop event handler
  // The browser DataTransfer API is empty in Tauri webviews; use the Tauri-native event instead.
  // onDragDropEvent fires with { type: 'over' | 'drop' | 'leave', paths: string[] }
  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setupDragDrop = async () => {
      const webviewWindow = getCurrentWebviewWindow();
      unlisten = await webviewWindow.onDragDropEvent(async (event) => {
        if (event.payload.type === "over") {
          setIsDragOver(true);
        } else if (event.payload.type === "leave") {
          setIsDragOver(false);
        } else if (event.payload.type === "drop") {
          setIsDragOver(false);
          const paths: string[] = event.payload.paths ?? [];
          for (const path of paths) {
            try {
              // encode_file_from_path applies same validation as pick_and_encode_file
              // (type allowlist D-17, size limit D-17, filename sanitization T-02-02-01)
              const file = await invoke<FileAttachment>("encode_file_from_path", { path });
              addAttachment(file);
            } catch (err) {
              setError(formatError(String(err)));
            }
          }
        }
      });
    };

    setupDragDrop();

    return () => {
      unlisten?.();
    };
  }, [addAttachment]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text && pendingAttachments.length === 0) return;
    if (isStreaming) return;

    setError(null);

    // 1. Build user message and save immediately (D-32: real-time persistence)
    const userMsgId = crypto.randomUUID();
    const now = Date.now();

    const userMsg: NewMessage = {
      id: userMsgId,
      conversationId,
      role: "user",
      content: text,
      model: null,
      createdAt: new Date(now),
      deletedAt: null,
    };
    await insertUserMessage(userMsg);
    setInputText("");
    const attachmentsToSend = [...pendingAttachments];
    clearAttachments();

    // 2a. KB grounding (D-03/D-04) — per-message: when "Usar KB" is on, run hybrid
    // retrieval via the query_kb command (retrieveForQuery → commands.queryKb), prepend a
    // citation prompt as a grounding preamble, and persist the retrieved chunks with the
    // assistant answer (D-06: cards are driven by this array, independent of whether the
    // model emits [n] markers).
    const grounded = kbScope;
    let retrievedChunks: Citation[] = [];
    let groundingPreamble: string | null = null;
    if (grounded) {
      try {
        retrievedChunks = await retrieveForQuery(text);
        groundingPreamble = buildCitationPrompt(retrievedChunks);
      } catch (err) {
        // Retrieval failure is non-fatal — fall back to an ungrounded send (D-25 inline error).
        setError(formatError(String(err)));
        retrievedChunks = [];
        groundingPreamble = null;
      }
    }

    // 2b. Build full conversation history for the API call (D-23)
    // Use null (not undefined) for absent attachments — matches Rust Option<Vec<T>>.
    // Filter guards against Drizzle proxy returning messages with undefined role at runtime.
    const allMessages = [
      ...existingMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          attachments: null as FileAttachment[] | null,
        })),
      // Grounded send: inject the citation prompt + the user's question as a single
      // user turn so the existing stream pipeline (D-01) answers from the KB.
      {
        role: "user" as const,
        content: groundingPreamble
          ? `${groundingPreamble}\n\nPergunta: ${text}`
          : text,
        attachments: attachmentsToSend.length > 0 ? attachmentsToSend : null,
      },
    ];

    // 3. Accumulate stream content and save AI message on completion (D-32)
    let accumulatedContent = "";
    const aiMsgId = crypto.randomUUID();

    await startStream(
      {
        conversationId,
        messages: allMessages,
        model: currentModel,
      },
      (token) => {
        accumulatedContent += token;
      },
      async () => {
        // Stream done — save AI message (D-32)
        // useInsertAiMessage requires _conversationModel to update conversation.lastModel (D-03, D-22)
        // Grounded answers persist their retrieved chunks via a sentinel so source cards
        // survive reload without a DB schema change (D-04/D-06).
        const persistedContent = grounded
          ? embedCitations(accumulatedContent, retrievedChunks)
          : accumulatedContent;
        const aiMsg: NewMessage & { _conversationModel: string } = {
          id: aiMsgId,
          conversationId,
          role: "assistant",
          content: persistedContent,
          model: currentModel,
          createdAt: new Date(Date.now()),
          deletedAt: null,
          _conversationModel: currentModel,
        };
        await insertAiMessage(aiMsg);

        // D-06: Auto-generate title after first exchange (if still "Nova Conversa")
        const isFirstResponse = existingMessages.length === 0;
        if (isFirstResponse) {
          try {
            const { title } = await invoke<{ title: string }>(
              "generate_conversation_title",
              {
                input: {
                  conversationId,
                  firstUserMessage: text,
                  firstAssistantMessage: accumulatedContent,
                  model: currentModel,
                },
              }
            );
            if (title && title !== "Nova Conversa") {
              await updateTitle({ id: conversationId, title });
            }
          } catch {
            // Title generation is non-critical — fallback to truncated first message
            const fallbackTitle =
              text.length > 50 ? text.slice(0, 50).trim() + "…" : text.trim();
            await updateTitle({ id: conversationId, title: fallbackTitle });
          }
        }

        onSendComplete?.();
        textareaRef.current?.focus();
      },
      (errorMsg) => {
        // D-25: Inline error handling
        setError(formatError(errorMsg));
      }
    );
  }, [
    inputText,
    pendingAttachments,
    isStreaming,
    conversationId,
    currentModel,
    kbScope,
    existingMessages,
    insertUserMessage,
    insertAiMessage,
    updateTitle,
    startStream,
    clearAttachments,
    onSendComplete,
  ]);

  // D-27: Enter sends, Shift+Enter = newline
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // D-15: Paperclip file picker (opens OS native dialog via Rust)
  const handlePickFile = async () => {
    try {
      const file = await pickFile();
      if (file) addAttachment(file);
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    // D-09: Bottom-fixed input
    // D-15: drag-drop visual overlay (ring-2 ring-accent when files are dragged over window)
    <div
      className={cn(
        "sticky bottom-0 border-t border-border bg-background",
        isDragOver && "ring-2 ring-accent ring-inset"
      )}
    >
      {/* D-25: Inline error display */}
      {error && (
        <div className="flex items-start gap-2 px-4 py-2 bg-destructive/10 border-b border-destructive/20">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">{error}</p>
          <button
            className="ml-auto text-xs text-destructive hover:underline"
            onClick={() => setError(null)}
          >
            Fechar
          </button>
        </div>
      )}

      {/* D-16: File attachment previews above input */}
      <FileAttachmentPreview
        attachments={pendingAttachments}
        onRemove={removeAttachment}
      />

      {/* Input row */}
      <div className="flex items-end gap-2 px-4 py-3">
        {/* D-15: Paperclip button — opens OS file dialog */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={handlePickFile}
                disabled={isStreaming}
                aria-label="Anexar arquivo"
              >
                <Paperclip size={18} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Anexar arquivo</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Auto-growing textarea */}
        <TextareaAutosize
          ref={textareaRef}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          minRows={1}
          maxRows={8}
          disabled={isStreaming}
          className={cn(
            "flex-1 resize-none bg-transparent text-sm",
            "placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-0",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "py-2"
          )}
        />

        {/* D-03: Per-message KB-scope toggle ("Usar KB" / "KB ativa").
            On-state uses the reserved accent (UI-SPEC accent item 2, mirrors the send button);
            off-state is a muted ghost pill. 36px height (h-9) matches the model picker. */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setKbScope(!kbScope)}
                disabled={isStreaming}
                aria-pressed={kbScope}
                aria-label={kbScope ? "KB ativa" : "Usar KB"}
                className={cn(
                  "h-9 shrink-0 gap-1.5 text-xs focus-visible:ring-2 focus-visible:ring-ring",
                  kbScope
                    ? "bg-accent text-accent-foreground hover:bg-accent/90"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <BookOpen size={14} />
                {kbScope ? "KB ativa" : "Usar KB"}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {kbScope
                ? "Resposta fundamentada na base de conhecimento"
                : "Fundamentar esta mensagem na base de conhecimento"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* D-20: Model picker — dropdown showing current model */}
        <Select
          value={currentModel}
          onValueChange={(val) => setCurrentModel(val)}
          disabled={isStreaming}
        >
          <SelectTrigger className="h-9 w-auto min-w-[120px] text-xs shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(modelsByProvider) as ProviderId[]).map((provider) => (
              <SelectGroup key={provider}>
                <SelectLabel className="text-xs text-muted-foreground px-2 py-1">
                  {PROVIDER_LABELS[provider]}
                </SelectLabel>
                {modelsByProvider[provider].map((m) => (
                  <SelectItem key={m.value} value={m.value} className="text-xs">
                    {m.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        {/* Send / Stop button (D-14) */}
        {isStreaming ? (
          <Button
            variant="default"
            size="sm"
            onClick={stopStream}
            className="h-9 shrink-0 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Square size={14} fill="currentColor" />
            Parar
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={handleSend}
            disabled={
              (!inputText.trim() && pendingAttachments.length === 0) ||
              isStreaming
            }
            className="h-9 shrink-0 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Send size={14} />
            Enviar
          </Button>
        )}
      </div>
    </div>
  );
}

// D-25: Error message formatting per UI-SPEC copywriting contract
// T-02-06-01: normalizes error messages — never displays raw API responses
function formatError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("rate_limit")
  ) {
    return "Limite de taxa atingido. Aguarde alguns momentos e tente novamente.";
  }
  if (
    lower.includes("network") ||
    lower.includes("connection") ||
    lower.includes("failed to fetch") ||
    lower.includes("connect")
  ) {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }
  if (
    lower.includes("not configured") ||
    lower.includes("api key")
  ) {
    return `Erro: ${raw}. Verifique sua chave de API nas configurações ou tente novamente.`;
  }
  return `Erro: ${raw}`;
}
