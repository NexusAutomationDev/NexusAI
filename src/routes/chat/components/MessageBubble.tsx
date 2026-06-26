/**
 * Single message bubble (D-08: full-width alternating backgrounds).
 * User messages: bg-secondary
 * AI messages: bg-card
 *
 * D-21: AI messages show model badge in header
 * D-24: Copy/Edit/Delete actions on hover
 * D-25: Inline error display
 * D-26: Typing indicator for AI while waiting for first token
 *
 * Security (T-02-05-02): Code execution via LLM response is prevented by
 * rendering through MarkdownRenderer (react-markdown AST, not eval()).
 */

import { useState } from "react";
import { Copy, Pencil, Trash2, RefreshCw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "./MarkdownRenderer";
import type { Message } from "@/lib/db/schema";

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean; // true if this message is the one currently streaming
  streamingContent?: string; // accumulated tokens if streaming
  onCopy?: (content: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onRegenerate?: (messageId: string) => void;
}

// D-26: Typing indicator — 3 dots with pulse animation (600ms cycle per UI-SPEC)
function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-muted-foreground"
          style={{
            animation: `pulse 600ms ease-in-out infinite`,
            animationDelay: `${i * 200}ms`,
          }}
        />
      ))}
    </div>
  );
}

export function MessageBubble({
  message,
  isStreaming = false,
  streamingContent,
  onCopy,
  onEdit,
  onDelete,
  onRegenerate,
}: MessageBubbleProps) {
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);

  const isUser = message.role === "user";
  const isAi = message.role === "assistant";

  // Content to render: streaming content takes precedence during stream
  const displayContent =
    isStreaming && streamingContent ? streamingContent : message.content;
  // D-26: Show typing indicator while streaming but no tokens have arrived yet
  const showTypingIndicator = isAi && isStreaming && !streamingContent;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
    onCopy?.(displayContent);
  };

  const handleEditSubmit = () => {
    onEdit?.(message.id, editContent);
    setIsEditing(false);
  };

  return (
    // D-08: full-width alternating backgrounds (user=bg-secondary, AI=bg-card)
    // Animation: fade-in 150ms ease-out per UI-SPEC
    <div
      className={cn(
        "group px-4 py-4 transition-opacity",
        "animate-in fade-in duration-150",
        isUser ? "bg-secondary" : "bg-card"
      )}
    >
      <div className="max-w-3xl mx-auto">
        {/* Message header: role label + model badge (D-21) */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className={cn(
              "text-xs font-medium",
              isUser ? "text-muted-foreground" : "text-foreground"
            )}
          >
            {isUser ? "Você" : "Assistente"}
          </span>
          {/* D-21: Model badge on AI messages — bg-muted text-muted-foreground (NOT accent) */}
          {isAi && message.model && (
            <Badge
              variant="secondary"
              className="text-xs px-1.5 py-0 h-4 bg-muted text-muted-foreground"
            >
              {message.model.split("/").pop() ?? message.model}
            </Badge>
          )}
        </div>

        {/* Message content area */}
        <div className="text-sm leading-relaxed">
          {showTypingIndicator ? (
            // D-26: 3-dot typing indicator while waiting for first token
            <TypingIndicator />
          ) : isEditing && isUser ? (
            // D-24: Edit mode (user messages only — D-24)
            <div className="space-y-2">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full bg-background border border-border rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                rows={3}
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEditSubmit}>
                  Salvar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : isAi ? (
            // AI messages: rendered with MarkdownRenderer (D-10, D-12)
            <MarkdownRenderer content={displayContent} />
          ) : (
            // User messages: plain text (no markdown processing — D-08)
            <p className="whitespace-pre-wrap">{displayContent}</p>
          )}
        </div>

        {/* D-24: Message actions — visible on hover (not during streaming) */}
        {!isStreaming && !isEditing && (
          <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <TooltipProvider>
              {/* Copy button (D-24: any message) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={handleCopy}
                  >
                    {copiedMessage ? <Check size={14} /> : <Copy size={14} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {copiedMessage ? "Copiado!" : "Copiar"}
                </TooltipContent>
              </Tooltip>

              {/* Edit button (D-24: user messages only) */}
              {isUser && onEdit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Editar</TooltipContent>
                </Tooltip>
              )}

              {/* Delete button (D-24: any message) */}
              {onDelete && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => onDelete(message.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Excluir mensagem</TooltipContent>
                </Tooltip>
              )}

              {/* Regenerate button (D-14: AI messages after completion) */}
              {isAi && onRegenerate && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onRegenerate(message.id)}
                    >
                      <RefreshCw size={14} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Regenerar</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>
          </div>
        )}
      </div>
    </div>
  );
}
