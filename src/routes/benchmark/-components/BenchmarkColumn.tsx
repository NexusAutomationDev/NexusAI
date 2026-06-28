import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { type ColumnState, useBenchmarkStore } from "@/lib/stores/benchmark";
import { MarkdownRenderer } from "@/routes/chat/components/MarkdownRenderer";
import { AlertCircle, Check, Loader2, Square } from "lucide-react";

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

function getModelLabel(model: string): string {
	return AVAILABLE_MODELS.find((m) => m.value === model)?.label ?? model;
}
function getProviderLabel(model: string): string {
	return AVAILABLE_MODELS.find((m) => m.value === model)?.provider ?? "";
}

interface StreamingIndicatorProps {
	status: ColumnState["status"];
}
function StreamingIndicator({ status }: StreamingIndicatorProps) {
	if (status === "streaming") {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<Loader2
						size={14}
						className="animate-spin text-muted-foreground"
						aria-label="Gerando resposta"
					/>
				</TooltipTrigger>
				<TooltipContent>Gerando resposta...</TooltipContent>
			</Tooltip>
		);
	}
	if (status === "done") {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<Check
						size={14}
						className="text-muted-foreground"
						aria-label="Resposta completa"
					/>
				</TooltipTrigger>
				<TooltipContent>Resposta completa</TooltipContent>
			</Tooltip>
		);
	}
	if (status === "error") {
		return (
			<AlertCircle
				size={14}
				className="text-destructive"
				aria-label="Erro na resposta"
			/>
		);
	}
	return null;
}

interface BenchmarkColumnProps {
	column: ColumnState;
	colIdx: number;
}

export function BenchmarkColumn({ column, colIdx }: BenchmarkColumnProps) {
	const stopColumn = useBenchmarkStore((s) => s.stopColumn);

	return (
		<div className="flex h-full flex-col">
			{/* Column header: 44px (h-11) — model picker + provider badge + status + stop */}
			<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
				<Select value={column.model} disabled>
					<SelectTrigger
						className="h-7 flex-1 border-0 bg-transparent p-0 shadow-none text-sm font-medium focus:ring-0"
						aria-label={`Modelo da coluna ${colIdx + 1}`}
					>
						<SelectValue>{getModelLabel(column.model)}</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{AVAILABLE_MODELS.map((m) => (
							<SelectItem key={m.value} value={m.value}>
								{m.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<span className="shrink-0 text-xs font-medium text-muted-foreground">
					{getProviderLabel(column.model)}
				</span>

				<StreamingIndicator status={column.status} />

				{/* Stop button — visible only during streaming */}
				{column.status === "streaming" && (
					<Tooltip>
						<TooltipTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className="h-7 w-7 p-0 text-muted-foreground"
								onClick={() => stopColumn(colIdx)}
								aria-label="Parar esta coluna"
							>
								<Square size={12} />
							</Button>
						</TooltipTrigger>
						<TooltipContent>Parar esta coluna</TooltipContent>
					</Tooltip>
				)}
			</div>

			{/* Response content area */}
			<ScrollArea className="flex-1">
				<div className="p-4">
					{column.status === "error" ? (
						<p className="text-sm text-destructive">
							{column.error ?? "Erro ao gerar resposta. Tente novamente."}
						</p>
					) : column.content ? (
						<MarkdownRenderer content={column.content} />
					) : column.status === "streaming" ? (
						<span className="animate-pulse text-sm text-muted-foreground">
							▋
						</span>
					) : null}
				</div>
			</ScrollArea>
		</div>
	);
}
