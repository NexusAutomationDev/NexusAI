/**
 * Scrollable message list with auto-scroll during streaming (D-13).
 *
 * Auto-scroll pattern (RESEARCH.md §Pattern 3):
 * - `wheel` event = user-initiated scroll → set userScrolledRef = true
 * - `scroll` event = DOM change → update isNearBottomRef
 * - Auto-scroll only if !userScrolledRef && isNearBottomRef
 * - Clear userScrolledRef when user scrolls to bottom
 *
 * This pattern avoids the common pitfall of scroll hijacking when
 * content grows during streaming (RESEARCH.md §Pitfall 2).
 */

import { useEffect, useRef } from "react";
import { useChatStore } from "@/lib/stores/chat";
import { MessageBubble } from "./MessageBubble";
import type { Message } from "@/lib/db/schema";

interface MessageListProps {
  messages: Message[];
  conversationId: string;
  onDeleteMessage?: (messageId: string) => void;
  onEditMessage?: (messageId: string, content: string) => void;
  onRegenerate?: (messageId: string) => void;
}

export function MessageList({
  messages,
  conversationId,
  onDeleteMessage,
  onEditMessage,
  onRegenerate,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const userScrolledRef = useRef(false);
  const isNearBottomRef = useRef(true);

  const { isStreaming, streamingContent, streamingConversationId } =
    useChatStore();
  const isThisConversationStreaming =
    isStreaming && streamingConversationId === conversationId;

  // D-13: Auto-scroll setup (wheel + scroll event detection)
  // Wheel event distinguishes user-initiated scroll from layout-shift scroll (Pitfall 2)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = () => {
      // User-initiated scroll (wheel/trackpad) — stop auto-scrolling
      userScrolledRef.current = true;
    };

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      isNearBottomRef.current = distanceFromBottom < 100; // D-13: within 100px

      // If user scrolled back to bottom, clear the "user scrolled" flag
      if (isNearBottomRef.current) {
        userScrolledRef.current = false;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: true });
    el.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Auto-scroll when new content arrives (messages or streaming tokens)
  useEffect(() => {
    if (!userScrolledRef.current && isNearBottomRef.current) {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages.length, streamingContent]);

  // The streaming message is a synthetic Message shown while streaming
  // It uses the accumulated streamingContent from the store
  const hasStreamingMessage = isThisConversationStreaming;

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto"
      // UI-SPEC: 16px scroll padding at bottom (keeps last message above input)
      style={{ scrollPaddingBottom: "16px" }}
    >
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onDelete={onDeleteMessage}
          onEdit={onEditMessage}
          onRegenerate={onRegenerate}
        />
      ))}

      {/* Streaming message — shown while AI is responding (D-26) */}
      {hasStreamingMessage && (
        <MessageBubble
          key="streaming"
          message={
            {
              id: "streaming",
              conversationId,
              role: "assistant",
              content: streamingContent || "",
              model: useChatStore.getState().currentModel,
              createdAt: new Date(),
              deletedAt: null,
            } as Message
          }
          isStreaming={true}
          streamingContent={streamingContent}
        />
      )}

      {/* Bottom spacer for scroll padding */}
      <div className="h-4" />
    </div>
  );
}
