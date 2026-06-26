/**
 * File attachment preview shown above message input before sending (D-16).
 * Images show thumbnail (base64 data URL).
 * Documents show icon + filename.
 * Remove button (X) to deselect (D-16).
 * D-19: Multiple files in a row with 8px gap (gap-2).
 */

import { X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FileAttachment } from "@/lib/stores/chat";

interface FileAttachmentPreviewProps {
  attachments: FileAttachment[];
  onRemove: (filename: string) => void;
}

function isImageType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export function FileAttachmentPreview({
  attachments,
  onRemove,
}: FileAttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    // D-19: Multiple files in row, 8px gap (gap-2)
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {attachments.map((file) => (
        <div
          key={file.filename}
          className={cn(
            "relative group flex items-center gap-2",
            "bg-muted rounded-md border border-border",
            "px-2 py-1.5 max-w-[200px]"
          )}
        >
          {/* D-16: Image thumbnail OR document icon */}
          {isImageType(file.mimeType) ? (
            <img
              src={`data:${file.mimeType};base64,${file.base64Data}`}
              alt={file.filename}
              className="w-8 h-8 object-cover rounded"
            />
          ) : (
            <FileText size={20} className="shrink-0 text-muted-foreground" />
          )}

          {/* Filename + size */}
          <div className="min-w-0">
            <p className="text-xs font-medium truncate text-foreground">
              {file.filename}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.fileSizeBytes)}
            </p>
          </div>

          {/* D-16: Remove button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 absolute -top-1.5 -right-1.5 rounded-full bg-muted border border-border"
            onClick={() => onRemove(file.filename)}
            aria-label={`Remover ${file.filename}`}
          >
            <X size={10} />
          </Button>
        </div>
      ))}
    </div>
  );
}
