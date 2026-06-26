/**
 * Chat index route — the right panel of the two-column layout.
 * Renders MessageList (history) + MessageInput (bottom-fixed) for the active conversation.
 *
 * D-34: Empty state when no conversation selected ("Comece uma conversa").
 * D-28: Cmd/Ctrl+K keyboard shortcut to create new conversation.
 * D-24: Edit flow — soft-delete message, pre-fill MessageInput with original content for re-send.
 * D-14: Regenerate flow — soft-delete AI message and subsequent messages, re-send conversation.
 * D-09: MessageInput is bottom-fixed (handled inside MessageInput via sticky bottom-0).
 */

import { useEffect, useCallback, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";
import { useChatStore } from "@/lib/stores/chat";
import {
  useMessages,
  useDeleteMessage,
  useCreateConversation,
} from "@/lib/queries/chat";
import { MessageList } from "./components/MessageList";
import { MessageInput } from "./components/MessageInput";

export const Route = createFileRoute("/chat/")({
  component: ChatView,
});

function ChatView() {
  const navigate = useNavigate();

  // D-24: editDraft state — set when user clicks Edit on a message
  // MessageInput consumes this to pre-fill the textarea, then calls onEditDraftConsumed to clear it
  const [editDraft, setEditDraft] = useState<string | null>(null);

  const {
    activeConversationId,
    setActiveConversationId,
    currentModel,
    isStreaming,
  } = useChatStore();

  const conversationId = activeConversationId;

  const { mutateAsync: createConversation } = useCreateConversation();
  const { mutateAsync: deleteMessage } = useDeleteMessage();
  const { data: messages = [] } = useMessages(conversationId);

  // D-28: Cmd/Ctrl+K creates new conversation
  const handleNewConversation = useCallback(async () => {
    const conv = await createConversation();
    setActiveConversationId(conv.id);
    navigate({ to: "/chat/" });
  }, [createConversation, setActiveConversationId, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // D-28: Cmd+K (macOS) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        handleNewConversation();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNewConversation]);

  const handleDeleteMessage = async (messageId: string) => {
    if (!conversationId) return;
    await deleteMessage({ messageId, conversationId });
  };

  // D-24: Edit flow — soft-delete original message and pre-fill textarea with its content.
  // The user then edits the pre-filled text and sends, creating a new message.
  // This completes the full edit → re-send cycle as specified in D-24.
  const handleEditMessage = async (messageId: string, content: string) => {
    if (!conversationId) return;
    // 1. Soft-delete the original message so it disappears from the list
    await deleteMessage({ messageId, conversationId });
    // 2. Pre-fill the textarea with the original content so user can edit and re-send
    setEditDraft(content);
  };

  // D-14: Regenerate flow — soft-delete the target AI message and all subsequent messages,
  // then re-send the user message that originally prompted it.
  // MessageBubble renders the Regenerate button conditionally: {isAi && onRegenerate && !isStreaming}
  // so the button only appears on finished AI messages when this handler is wired.
  const handleRegenerate = useCallback(
    async (messageId: string) => {
      if (!conversationId) return;
      // 1. Find the index of the AI message the user wants to regenerate
      const targetIndex = messages.findIndex((m) => m.id === messageId);
      if (targetIndex === -1) return;

      // 2. Soft-delete the target AI message and every message after it
      // (delete in reverse order to keep indexes stable)
      const toDelete = messages.slice(targetIndex);
      for (const msg of [...toDelete].reverse()) {
        await deleteMessage({ messageId: msg.id, conversationId });
      }

      // 3. Find the user message just before the deleted AI message — this is what we re-send
      // We use the MessageInput's handleSend via pre-filling the editDraft with the user message
      const precedingUserMessage = messages
        .slice(0, targetIndex)
        .filter((m) => m.role === "user")
        .at(-1);

      if (!precedingUserMessage) return;

      // 4. Pre-fill textarea with the preceding user message content to trigger a new send
      setEditDraft(precedingUserMessage.content);
    },
    [conversationId, messages, deleteMessage]
  );

  // D-34: Empty state — no conversation selected
  if (!conversationId) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-8">
          <MessageSquare size={40} className="text-muted-foreground opacity-40" />
          <div>
            {/* UI-SPEC copywriting: "Comece uma conversa" */}
            <h2 className="text-lg font-medium text-foreground">
              Comece uma conversa
            </h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">
              {/* UI-SPEC copywriting: empty state body */}
              Digite sua pergunta ou ideia. O modelo escolhido responderá em tempo real.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Active conversation view
  return (
    // D-09: flex column, MessageList takes flex-1, MessageInput sticks to bottom
    <div className="flex h-full flex-col overflow-hidden">
      {/* Message list — scrollable, fills available space */}
      <MessageList
        messages={messages}
        conversationId={conversationId}
        onDeleteMessage={handleDeleteMessage}
        onEditMessage={handleEditMessage}   // D-24: triggers soft-delete + editDraft pre-fill
        onRegenerate={handleRegenerate}     // D-14: triggers soft-delete of AI msg + re-send
      />

      {/* D-09: Bottom-fixed message input */}
      <MessageInput
        conversationId={conversationId}
        onSendComplete={() => {
          // Optional: any post-send actions (scroll is handled in MessageList)
        }}
        editDraft={editDraft}                            // D-24: pre-fill textarea with edited content
        onEditDraftConsumed={() => setEditDraft(null)}   // D-24: clear after textarea is populated
      />
    </div>
  );
}
