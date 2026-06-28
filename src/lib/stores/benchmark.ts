/**
 * Benchmark Zustand store — manages active benchmark session state.
 * Follows the same pattern as src/lib/stores/chat.ts.
 *
 * IMPORTANT: allDone is NOT stored state — compute as selector to avoid race conditions:
 * useStore(useBenchmarkStore, s => s.activeSession?.columns.every(
 *   c => c.status === 'done' || c.status === 'error'
 * ) ?? false)
 *
 * IMPORTANT: Each benchmark column uses N separate stream_chat invocations with
 * synthetic conversationIds (sessionId + '-col-' + colIdx) for per-column stop support.
 * See RESEARCH.md §Architecture Patterns for rationale.
 *
 * SECURITY (T-04-01-01): setWinner validates winnerId against column model IDs
 * to prevent arbitrary string tampering.
 */

import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export type ColumnStatus = "idle" | "streaming" | "done" | "error";

export interface ColumnState {
	model: string;
	content: string; // accumulated token text
	status: ColumnStatus;
	error?: string;
	syntheticId?: string; // sessionId-col-N, for stop_streaming lookup
}

export interface ActiveBenchmarkSession {
	sessionId: string;
	prompt: string;
	columns: ColumnState[]; // length 2–4
	winnerId: string | null; // model ID, '__tie__', or null (not scored yet)
	scored: boolean;
}

interface BenchmarkStore {
	activeSession: ActiveBenchmarkSession | null;

	startSession: (prompt: string, models: string[]) => string;
	appendToken: (colIdx: number, text: string) => void;
	setColumnDone: (colIdx: number) => void;
	setColumnError: (colIdx: number, msg: string) => void;
	setColumnStreaming: (colIdx: number) => void;
	setColumnSyntheticId: (colIdx: number, id: string) => void;
	stopColumn: (colIdx: number) => Promise<void>;
	stopAll: () => Promise<void>;
	setWinner: (modelId: string | null) => Promise<void>;
	resetSession: () => void;
}

export const useBenchmarkStore = create<BenchmarkStore>((set, get) => ({
	activeSession: null,

	startSession: (prompt, models) => {
		const sessionId = crypto.randomUUID();
		const columns: ColumnState[] = models.map((model) => ({
			model,
			content: "",
			status: "idle",
		}));
		set({
			activeSession: {
				sessionId,
				prompt,
				columns,
				winnerId: null,
				scored: false,
			},
		});
		return sessionId;
	},

	appendToken: (colIdx, text) =>
		set((s) => {
			if (!s.activeSession) return s;
			const columns = s.activeSession.columns.map((col, i) =>
				i === colIdx ? { ...col, content: col.content + text } : col,
			);
			return { activeSession: { ...s.activeSession, columns } };
		}),

	setColumnDone: (colIdx) =>
		set((s) => {
			if (!s.activeSession) return s;
			const columns = s.activeSession.columns.map((col, i) =>
				i === colIdx ? { ...col, status: "done" as ColumnStatus } : col,
			);
			return { activeSession: { ...s.activeSession, columns } };
		}),

	setColumnError: (colIdx, msg) =>
		set((s) => {
			if (!s.activeSession) return s;
			const columns = s.activeSession.columns.map((col, i) =>
				i === colIdx
					? { ...col, status: "error" as ColumnStatus, error: msg }
					: col,
			);
			return { activeSession: { ...s.activeSession, columns } };
		}),

	setColumnStreaming: (colIdx) =>
		set((s) => {
			if (!s.activeSession) return s;
			const columns = s.activeSession.columns.map((col, i) =>
				i === colIdx ? { ...col, status: "streaming" as ColumnStatus } : col,
			);
			return { activeSession: { ...s.activeSession, columns } };
		}),

	setColumnSyntheticId: (colIdx, id) =>
		set((s) => {
			if (!s.activeSession) return s;
			const columns = s.activeSession.columns.map((col, i) =>
				i === colIdx ? { ...col, syntheticId: id } : col,
			);
			return { activeSession: { ...s.activeSession, columns } };
		}),

	stopColumn: async (colIdx) => {
		const { activeSession } = get();
		if (!activeSession) return;
		const col = activeSession.columns[colIdx];
		if (!col?.syntheticId) return;
		try {
			await invoke("stop_streaming", { conversationId: col.syntheticId });
		} catch {
			// Ignore — stream may have already finished
		}
	},

	stopAll: async () => {
		const { activeSession, stopColumn } = get();
		if (!activeSession) return;
		await Promise.allSettled(
			activeSession.columns.map((_, idx) => stopColumn(idx)),
		);
	},

	setWinner: async (modelId) => {
		const { activeSession } = get();
		if (!activeSession || activeSession.scored) return;

		// T-04-01-01: validate winnerId against column model IDs to prevent tampering
		if (
			modelId !== null &&
			!activeSession.columns.find((c) => c.model === modelId)
		) {
			console.warn(
				"[benchmarkStore] setWinner: invalid modelId rejected:",
				modelId,
			);
			return;
		}

		// Update UI state synchronously
		set((s) => ({
			activeSession: s.activeSession
				? { ...s.activeSession, winnerId: modelId, scored: true }
				: null,
		}));

		// Persist to SQLite via queries/benchmark.ts
		try {
			const { saveBenchmarkScore } = await import("@/lib/queries/benchmark");
			await saveBenchmarkScore({
				session: activeSession,
				winnerId: modelId,
			});
		} catch (e) {
			console.error("[benchmarkStore] Failed to persist score:", e);
		}
	},

	resetSession: () => set({ activeSession: null }),
}));
