/**
 * TanStack Query hooks for benchmark history and score persistence.
 * Follows the same patterns as src/lib/queries/chat.ts.
 *
 * useBenchmarkHistory — fetch up to 100 past sessions (D-04: flat list, no pagination in v1)
 * saveBenchmarkScore — insert session + results rows, invalidate cache
 */

import { db } from "@/lib/db/proxy";
import {
	type BenchmarkResult,
	type BenchmarkSession,
	benchmarkResults,
	benchmarkSessions,
} from "@/lib/db/schema";
import type { ActiveBenchmarkSession } from "@/lib/stores/benchmark";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { desc, inArray } from "drizzle-orm";

export type BenchmarkSessionWithResults = BenchmarkSession & {
	results: BenchmarkResult[];
};

export function useBenchmarkHistory() {
	return useQuery<BenchmarkSessionWithResults[]>({
		queryKey: ["benchmark-history"],
		staleTime: 30_000,
		queryFn: async (): Promise<BenchmarkSessionWithResults[]> => {
			const sessions = await db
				.select()
				.from(benchmarkSessions)
				.orderBy(desc(benchmarkSessions.createdAt))
				.limit(100);

			if (sessions.length === 0) return [];

			const results = await db
				.select()
				.from(benchmarkResults)
				.where(
					inArray(
						benchmarkResults.sessionId,
						sessions.map((s) => s.id),
					),
				);

			return sessions.map((s) => ({
				...s,
				results: results.filter((r) => r.sessionId === s.id),
			}));
		},
	});
}

interface SaveBenchmarkScoreParams {
	session: ActiveBenchmarkSession;
	winnerId: string | null; // null = tie; string = model ID (not '__tie__' sentinel)
}

/**
 * Persist a completed benchmark session and its column results to SQLite.
 * Called by benchmarkStore.setWinner() after updating UI state.
 *
 * Uses winnerId=null to mean tie (is_tie=true on all result rows).
 * Uses winnerId=modelId to mean that specific model won (is_winner=true on its row).
 */
export async function saveBenchmarkScore({
	session,
	winnerId,
}: SaveBenchmarkScoreParams): Promise<void> {
	const now = new Date();
	const isTie = winnerId === null;

	// Insert session row
	await db.insert(benchmarkSessions).values({
		id: session.sessionId,
		prompt: session.prompt,
		createdAt: now,
		scoredAt: now,
	});

	// Insert one result row per column
	const rows = session.columns.map((col) => ({
		id: crypto.randomUUID(),
		sessionId: session.sessionId,
		model: col.model,
		response: col.content,
		isWinner: !isTie && winnerId === col.model,
		isTie,
		createdAt: now,
	}));

	await db.insert(benchmarkResults).values(rows);
}

/**
 * Hook-based version for use inside React components that need to invalidate cache.
 * For non-hook contexts (store), use saveBenchmarkScore directly.
 */
export function useSaveBenchmarkScore() {
	const queryClient = useQueryClient();

	return async (params: SaveBenchmarkScoreParams): Promise<void> => {
		await saveBenchmarkScore(params);
		await queryClient.invalidateQueries({ queryKey: ["benchmark-history"] });
	};
}
