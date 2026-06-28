import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useBenchmarkStore } from "@/lib/stores/benchmark";
import { useSettingsStore } from "@/lib/stores/settings";
import { Channel, invoke } from "@tauri-apps/api/core";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";

// StreamEvent type — same pattern as in chat.ts
type StreamEvent =
	| { event: "token"; data: { text: string } }
	| { event: "done"; data: Record<string, never> }
	| { event: "error"; data: { message: string } };

// Available models for benchmark — derived from settings AVAILABLE_MODELS list.
// Subset of most common models for pre-run selection.
const AVAILABLE_MODELS = [
	{ value: "gpt-4.1", label: "GPT-4.1", provider: "OpenAI" },
	{ value: "gpt-4o", label: "GPT-4o", provider: "OpenAI" },
	{
		value: "anthropic/claude-opus-4",
		label: "Claude Opus 4",
		provider: "OpenRouter",
	},
	{
		value: "anthropic/claude-sonnet-4-5",
		label: "Claude Sonnet 4.5",
		provider: "OpenRouter",
	},
	{
		value: "google/gemini-2.0-flash-001",
		label: "Gemini 2.0 Flash",
		provider: "OpenRouter",
	},
	{
		value: "google/gemini-2.5-pro-preview",
		label: "Gemini 2.5 Pro",
		provider: "OpenRouter",
	},
];

export function BenchmarkPrompt() {
	const benchmarkModel = useSettingsStore((s) => s.benchmarkModel);
	const {
		startSession,
		appendToken,
		setColumnDone,
		setColumnError,
		setColumnStreaming,
		setColumnSyntheticId,
	} = useBenchmarkStore();

	const [prompt, setPrompt] = useState("");
	const [selectedModels, setSelectedModels] = useState<string[]>([
		benchmarkModel ?? "gpt-4o",
		AVAILABLE_MODELS[2]?.value ?? "anthropic/claude-opus-4",
	]);

	// D-02: pre-fill with Settings defaults on mount
	useEffect(() => {
		const defaultModel = useSettingsStore.getState().benchmarkModel ?? "gpt-4o";
		setSelectedModels([
			defaultModel,
			AVAILABLE_MODELS[2]?.value ?? "anthropic/claude-opus-4",
		]);
	}, []);

	const canAddColumn = selectedModels.length < 4;
	const canRemoveColumn = selectedModels.length > 2;
	const canStart = prompt.trim().length > 0 && selectedModels.every(Boolean);

	function addColumn() {
		if (!canAddColumn) return;
		const unused = AVAILABLE_MODELS.find(
			(m) => !selectedModels.includes(m.value),
		);
		setSelectedModels((prev) => [
			...prev,
			unused?.value ?? AVAILABLE_MODELS[0].value,
		]);
	}

	function removeColumn(idx: number) {
		if (!canRemoveColumn) return;
		setSelectedModels((prev) => prev.filter((_, i) => i !== idx));
	}

	function updateModel(idx: number, model: string) {
		setSelectedModels((prev) => prev.map((m, i) => (i === idx ? model : m)));
	}

	// D-01: column count fixed before benchmark starts (ResizablePanelGroup cannot add panels after mount)
	// Start session in store → renders BenchmarkColumns (unmounts this component)
	async function handleStart() {
		if (!canStart) return;
		const sessionId = startSession(prompt.trim(), selectedModels);

		// Fire N parallel streams — one Channel per column (RESEARCH.md §Pattern)
		// IMPORTANT: use Promise.allSettled (not all) so one error doesn't cancel others
		const streams = selectedModels.map((model, colIdx) => {
			const syntheticId = `${sessionId}-col-${colIdx}`;
			setColumnSyntheticId(colIdx, syntheticId);
			setColumnStreaming(colIdx);

			const channel = new Channel<StreamEvent>();
			channel.onmessage = (event) => {
				if (event.event === "token") {
					appendToken(colIdx, event.data.text);
				} else if (event.event === "done") {
					setColumnDone(colIdx);
				} else if (event.event === "error") {
					setColumnError(colIdx, event.data.message);
				}
			};

			return invoke("stream_chat", {
				input: {
					// Single-turn: benchmark is always one user message (Pitfall 4)
					conversationId: syntheticId,
					messages: [
						{ role: "user", content: prompt.trim(), attachments: null },
					],
					model,
				},
				onEvent: channel,
			}).catch((e: unknown) => {
				setColumnError(colIdx, e instanceof Error ? e.message : String(e));
			});
		});

		// Fire all concurrently — no await here (we want parallel, not sequential)
		Promise.allSettled(streams);
	}

	return (
		<div className="flex flex-1 flex-col gap-4 p-4">
			{/* Prompt textarea */}
			<textarea
				className="min-h-[76px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				placeholder="Digite o prompt para comparar os modelos..."
				rows={3}
				value={prompt}
				onChange={(e) => setPrompt(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canStart) {
						handleStart();
					}
				}}
			/>

			<Separator />

			{/* Model selectors — D-02 */}
			<div className="flex flex-col gap-2">
				{selectedModels.map((model, idx) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: index is stable for model selectors
					<div key={idx} className="flex h-11 items-center gap-2">
						<Select
							value={model}
							onValueChange={(val) => updateModel(idx, val)}
						>
							<SelectTrigger
								className="h-9 flex-1"
								aria-label={`Modelo da coluna ${idx + 1}`}
							>
								<SelectValue placeholder="Selecionar modelo" />
							</SelectTrigger>
							<SelectContent>
								{AVAILABLE_MODELS.map((m) => (
									<SelectItem key={m.value} value={m.value}>
										<span className="text-sm">{m.label}</span>
										<span className="ml-2 text-xs text-muted-foreground">
											{m.provider}
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<Button
							variant="ghost"
							size="sm"
							className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
							disabled={!canRemoveColumn}
							onClick={() => removeColumn(idx)}
							aria-label="Remover coluna"
							title={canRemoveColumn ? "Remover coluna" : undefined}
						>
							<X size={16} />
						</Button>
					</div>
				))}

				{canAddColumn && (
					<Button
						variant="outline"
						size="sm"
						className="h-9 w-fit gap-1"
						onClick={addColumn}
						title={
							!canAddColumn ? "Máximo de 4 modelos por sessão." : undefined
						}
					>
						<Plus size={16} />
						Modelo
					</Button>
				)}
			</div>

			{/* Empty state */}
			{prompt.trim().length === 0 && (
				<div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
					<p className="text-base font-medium text-foreground">
						Compare modelos lado a lado
					</p>
					<p className="max-w-sm text-sm text-muted-foreground">
						Selecione dois ou mais modelos, digite um prompt e inicie o
						benchmark para ver as respostas em paralelo.
					</p>
				</div>
			)}

			{/* CTA — Iniciar benchmark */}
			<div className="flex justify-end">
				<Button variant="default" disabled={!canStart} onClick={handleStart}>
					Iniciar benchmark
				</Button>
			</div>
		</div>
	);
}
