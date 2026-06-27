/**
 * KB citation utilities for RAG-grounded chat (Plan 03-06, KB-02).
 *
 * Bridges the `query_kb` retriever (Plan 03-03) and the chat answer surface:
 *  - `retrieveForQuery` runs hybrid retrieval and returns the top chunks.
 *  - `buildCitationPrompt` produces the PT-BR grounding scaffold (03-RESEARCH §Pattern 5):
 *    an instruction line + a numbered, 1-based chunk list. The number IS the citation id
 *    the LLM emits inline as `[n]`.
 *  - `buildCitationMap` indexes number → chunk so the `[n]` renderer + source cards
 *    resolve markers to chunk metadata (D-04).
 *
 * Persistence (see chat store): the retrieved `Citation[]` is the source of truth for
 * source cards (D-06 cards-only fallback — independent of whether the model emitted [n]).
 * Citations travel with the assistant message via an HTML-comment sentinel embedded in
 * the persisted content (parsed back out by `splitCitations`), so no DB migration is
 * needed and cards survive a reload.
 */

import { commands, type Citation as BindingCitation, type KbKind } from '@/lib/bindings';

// Mirror the bindings Citation type so consumers import from one place (the plan's contract).
export interface Citation {
  id: string;
  itemId: string;
  itemTitle: string;
  kind: KbKind;
  section: string | null;
  snippet: string;
}

/** Human label for a chunk's source kind, used in the citation prompt + cards. */
export function kindLabel(kind: KbKind): string {
  switch (kind) {
    case 'file':
      return 'arquivo';
    case 'note':
      return 'nota';
    case 'url':
      return 'URL';
    default:
      return 'fonte';
  }
}

/**
 * Run hybrid retrieval (query_kb) and return the top chunks (KB-02).
 * Returns an empty array on no hits — the caller still sends, and the prompt
 * instructs the model to say it did not find anything.
 */
export async function retrieveForQuery(query: string, topK = 6): Promise<Citation[]> {
  const result = await commands.queryKb({ query, topK });
  if (result.status === 'error') {
    throw new Error(result.error);
  }
  return result.data.chunks as Citation[];
}

/**
 * Build the PT-BR citation/grounding prompt (03-RESEARCH §Pattern 5).
 * Numbering is 1-based and is the citation id the model surfaces as `[n]`.
 */
export function buildCitationPrompt(chunks: Citation[]): string {
  const instruction =
    'Responda APENAS com base nos trechos abaixo. ' +
    'Cite a fonte de cada afirmação usando o número entre colchetes correspondente, ex: [1]. ' +
    'Se a resposta não estiver nos trechos, diga que não encontrou.';

  if (chunks.length === 0) {
    return `${instruction}\n\n(Nenhum trecho relevante foi encontrado na base de conhecimento.)`;
  }

  const numbered = chunks
    .map((c, i) => {
      const n = i + 1;
      const label = kindLabel(c.kind);
      const section = c.section ? `, seção: ${c.section}` : '';
      return `[${n}] (${label}: ${c.itemTitle}${section}) ${c.snippet}`;
    })
    .join('\n');

  return `${instruction}\n\n${numbered}`;
}

/**
 * Index 1-based marker number → chunk, so inline `[n]` markers and source cards
 * resolve to chunk metadata (D-04).
 */
export function buildCitationMap(chunks: Citation[]): Map<number, Citation> {
  const map = new Map<number, Citation>();
  chunks.forEach((c, i) => map.set(i + 1, c));
  return map;
}

// ─── Persistence sentinel ──────────────────────────────────────────────────────
// Citations are embedded in the persisted assistant message content as a trailing
// HTML comment so they survive reload without a DB schema change. `splitCitations`
// recovers them; `embedCitations` appends them after the answer body.

const CITATION_SENTINEL = '<!--nexus-citations:';
const CITATION_SENTINEL_END = '-->';

/** Append the retrieved citations to an answer body for persistence. */
export function embedCitations(answer: string, chunks: Citation[]): string {
  if (chunks.length === 0) return answer;
  const payload = JSON.stringify(chunks);
  return `${answer}\n${CITATION_SENTINEL}${payload}${CITATION_SENTINEL_END}`;
}

/**
 * Split a persisted message back into its visible body + citations.
 * Ungrounded messages (no sentinel) return `{ body: content, citations: [] }`.
 */
export function splitCitations(content: string): { body: string; citations: Citation[] } {
  const start = content.lastIndexOf(CITATION_SENTINEL);
  if (start === -1) return { body: content, citations: [] };

  const payloadStart = start + CITATION_SENTINEL.length;
  const end = content.indexOf(CITATION_SENTINEL_END, payloadStart);
  if (end === -1) return { body: content, citations: [] };

  const payload = content.slice(payloadStart, end);
  try {
    const citations = JSON.parse(payload) as Citation[];
    const body = content.slice(0, start).replace(/\n+$/, '');
    return { body, citations: Array.isArray(citations) ? citations : [] };
  } catch {
    return { body: content, citations: [] };
  }
}

// Re-export the binding type alias for callers that want the canonical shape.
export type { BindingCitation };
