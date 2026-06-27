/**
 * Memoized markdown renderer with syntax highlighting (CHAT-05, D-10, D-11, D-12).
 *
 * Uses react-markdown@10.1.0 + rehype-highlight@7.0.2 + remark-gfm.
 * Wrapped in React.memo to prevent re-rendering sibling messages during streaming
 * (anti-pattern: quadratic re-parsing — see RESEARCH.md §Pitfall 3).
 *
 * Code blocks use a custom CodeBlock component with:
 *   - Language badge (top-right, bg-muted text-muted-foreground)
 *   - Copy button that shows on hover ("Copiar" → "Copiado!" 2s timeout)
 *   - Monospace 13px text (text-[13px] leading-relaxed)
 *
 * NOTE: Uses non-prose fallback (no @tailwindcss/typography) per Tailwind v4 setup.
 * All markdown element styles are provided via custom component overrides.
 */

import { memo, useState, Fragment } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { Citation } from "@/lib/kb/citations";

// Extract plain text from React children recursively (for clipboard copy).
// rehype-highlight wraps code tokens in <span> elements, so we can't use String(children).
function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node !== null && typeof node === "object" && "props" in node) {
    const props = (node as React.ReactElement<{ children?: ReactNode }>).props;
    return extractText(props.children);
  }
  return "";
}

interface CodeBlockProps {
  language?: string;
  rawText: string;      // plain text for the clipboard button
  children: ReactNode;  // highlighted React nodes for visual display
}

// D-11: Code block with copy button (hover) + language badge (top-right)
// UI-SPEC: "Copiar" on hover, "Copiado!" active state, 2s timeout
function CodeBlock({ language, rawText, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // UI-SPEC: 2s timeout
  };

  return (
    <div className="relative group my-3 rounded-md overflow-hidden border border-border">
      {/* Top bar: language badge + copy button */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-muted border-b border-border">
        {language ? (
          // D-11: language badge top-right (bg-muted text-muted-foreground per UI-SPEC)
          <span className="text-xs font-medium text-muted-foreground">
            {language}
          </span>
        ) : (
          <span />
        )}
        {/* D-11: copy button — visible on hover (.group-hover:opacity-100) */}
        <button
          onClick={handleCopy}
          className={cn(
            "text-xs px-2 py-0.5 rounded transition-all duration-200",
            "bg-background border border-border text-muted-foreground",
            "opacity-0 group-hover:opacity-100",
            "hover:text-foreground hover:bg-muted"
          )}
        >
          {/* UI-SPEC: "Copiar" → "Copiado!" */}
          {copied ? "Copiado!" : "Copiar"}
        </button>
      </div>
      {/* Code content: 13px monospace, 1.6 line-height per UI-SPEC */}
      <pre className="overflow-x-auto p-4 bg-muted/50">
        <code className="text-[13px] leading-relaxed font-mono">{children}</code>
      </pre>
    </div>
  );
}

// D-04: Render inline [n] citation markers as clickable accent superscript buttons.
// Each marker is a real button (keyboard-activatable, role/aria-label "Fonte {n}") that
// resolves n against the per-message citation map and scrolls to / highlights the matching
// source card. If no citation map is present (ungrounded message) or n has no entry, [n]
// renders as plain text — never wrapped.
const CITATION_RE = /\[(\d+)\]/g;

function CitationMarkers({
  text,
  citationMap,
}: {
  text: string;
  citationMap?: Map<number, Citation>;
}): ReactNode {
  if (!citationMap || citationMap.size === 0) return text;

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  // Reset lastIndex defensively (module-level regex with /g is stateful).
  CITATION_RE.lastIndex = 0;

  while ((match = CITATION_RE.exec(text)) !== null) {
    const n = Number(match[1]);
    const citation = citationMap.get(n);
    if (!citation) continue; // unknown marker → leave as plain text

    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    parts.push(
      <sup key={`cite-${match.index}-${n}`} className="ml-0.5">
        <button
          type="button"
          role="link"
          aria-label={`Fonte ${n}`}
          data-citation-target={n}
          onClick={() => {
            const card = document.querySelector(
              `[data-citation-card="${n}"]`,
            ) as HTMLElement | null;
            card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
            if (card) {
              card.classList.add("ring-2", "ring-accent");
              setTimeout(
                () => card.classList.remove("ring-2", "ring-accent"),
                1500,
              );
            }
          }}
          className={cn(
            "text-xs font-medium text-accent align-super",
            "cursor-pointer hover:underline",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
          )}
        >
          [{n}]
        </button>
      </sup>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (parts.length === 0) return text; // no resolvable markers
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));

  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>{p}</Fragment>
      ))}
    </>
  );
}

// Recursively process React children, wrapping [n] markers in string leaves.
function renderWithCitations(
  children: ReactNode,
  citationMap?: Map<number, Citation>,
): ReactNode {
  if (!citationMap || citationMap.size === 0) return children;
  if (typeof children === "string") {
    return <CitationMarkers text={children} citationMap={citationMap} />;
  }
  if (Array.isArray(children)) {
    return children.map((c, i) => (
      <Fragment key={i}>{renderWithCitations(c, citationMap)}</Fragment>
    ));
  }
  return children;
}

interface MarkdownRendererProps {
  content: string;
  /** Per-message citation map; when present, inline [n] markers become source links (D-04). */
  citationMap?: Map<number, Citation>;
}

/**
 * MarkdownRenderer — wrapped in React.memo for streaming performance.
 * When a streaming message's content prop changes, only this instance re-renders.
 * Sibling MessageBubble components are unaffected (React.memo prevents cascade).
 *
 * Security (T-02-05-01): react-markdown escapes HTML by default.
 * No dangerouslySetInnerHTML used. LLM responses rendered as markdown AST.
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  citationMap,
}: MarkdownRendererProps) {
  return (
    // Non-prose fallback: custom component overrides handle all element styling.
    // (No @tailwindcss/typography in Tailwind v4 setup — see index.css)
    <div className="text-sm leading-relaxed text-foreground space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom code renderer — distinguishes inline code from code blocks
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            // rehype-highlight wraps tokens in <span> elements, so children is
            // already a React tree — use extractText() for raw clipboard content.
            const rawText = extractText(children).replace(/\n$/, "");
            const isBlock =
              (node?.position?.start?.line !== node?.position?.end?.line) ||
              rawText.includes("\n");

            if (isBlock || match) {
              // Code block (D-10: rehype-highlight adds language-* className)
              return (
                <CodeBlock
                  language={match?.[1]}
                  rawText={rawText}
                >
                  {children}
                </CodeBlock>
              );
            }

            // Inline code: bg-muted text-muted-foreground per UI-SPEC
            return (
              <code
                className="bg-muted text-muted-foreground rounded px-1 py-0.5 text-[13px] font-mono"
                {...props}
              >
                {children}
              </code>
            );
          },

          // Markdown heading sizes within message bubbles (UI-SPEC: 16/18/20px for h1/h2/h3)
          h1: ({ children }) => (
            <h1 className="text-xl font-medium mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-medium mt-3 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-medium mt-2 mb-1">{children}</h3>
          ),

          // Paragraph spacing — [n] citation markers wrapped here (D-04)
          p: ({ children }) => (
            <p className="mb-2 last:mb-0">
              {renderWithCitations(children, citationMap)}
            </p>
          ),

          // List item — also a common host for [n] markers
          li: ({ children }) => (
            <li>{renderWithCitations(children, citationMap)}</li>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 mb-2">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 mb-2">{children}</ol>
          ),

          // Links — open externally (Tauri: use opener plugin when available)
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
            >
              {children}
            </a>
          ),

          // Blockquote styling
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-border pl-4 text-muted-foreground italic my-2">
              {children}
            </blockquote>
          ),

          // Table styling (remark-gfm provides table support)
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-3 py-1.5 bg-muted text-left font-medium text-xs uppercase">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-3 py-1.5">{children}</td>
          ),

          // Horizontal rule
          hr: () => <hr className="border-border my-4" />,

          // Strong / Em
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic">{children}</em>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
