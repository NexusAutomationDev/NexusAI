import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useBenchmarkStore } from "@/lib/stores/benchmark";
import { toast } from "sonner";

// Inline model label resolver — same list as BenchmarkPrompt/BenchmarkColumn
const MODEL_LABELS: Record<string, string> = {
	"gpt-4.1": "GPT-4.1",
	"gpt-4o": "GPT-4o",
	"claude-opus-4": "Claude Opus 4",
	"claude-sonnet-4-5": "Claude Sonnet 4.5",
	"gemini-2.0-flash": "Gemini 2.0 Flash",
	"gemini-2.5-pro": "Gemini 2.5 Pro",
};

function getModelLabel(model: string): string {
	return MODEL_LABELS[model] ?? model;
}

export function ScoringBar() {
	const activeSession = useBenchmarkStore((s) => s.activeSession);
	const setWinner = useBenchmarkStore((s) => s.setWinner);

	if (!activeSession) return null;

	const { columns, winnerId, scored } = activeSession;

	// CRITICAL: allDone computed as selector — NOT stored state (avoids race conditions per RESEARCH.md)
	const allDone = columns.every(
		(c) => c.status === "done" || c.status === "error",
	);

	const isDisabled = !allDone || scored;

	// ToggleGroup value: use sentinel '__tie__' (null would be "uncontrolled")
	const toggleValue =
		winnerId === null && scored ? "__tie__" : (winnerId ?? undefined);

	async function handleValueChange(val: string) {
		if (isDisabled || !val) return;
		// Convert sentinel back to null for SQLite storage
		const modelId = val === "__tie__" ? null : val;
		await setWinner(modelId);
		toast("Avaliação registrada.");
	}

	return (
		// D-03: sticky na base, border-t, bg-secondary, h-[52px]
		<div className="flex h-[52px] shrink-0 items-center justify-between border-t border-border bg-secondary px-4 py-2">
			<span className="text-xs font-medium text-muted-foreground">
				{scored ? "Avaliação registrada" : "Qual resposta foi melhor?"}
			</span>

			{/* D-03: ToggleGroup com estados de modelo + Empate
			    200ms transition-opacity quando habilita (UI-SPEC §Animation) */}
			<ToggleGroup
				type="single"
				disabled={isDisabled}
				value={toggleValue}
				onValueChange={handleValueChange}
				className="transition-opacity duration-200"
				style={{ opacity: isDisabled ? 0.5 : 1 }}
			>
				{columns.map((col) => (
					<ToggleGroupItem
						key={col.model}
						value={col.model}
						className="h-7 px-3 text-sm font-medium"
					>
						{getModelLabel(col.model)}
					</ToggleGroupItem>
				))}
				<ToggleGroupItem
					value="__tie__"
					className="h-7 px-3 text-sm font-medium"
				>
					Empate
				</ToggleGroupItem>
			</ToggleGroup>
		</div>
	);
}
