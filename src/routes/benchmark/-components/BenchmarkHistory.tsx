import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BenchmarkResult } from "@/lib/db/schema";
import {
	type BenchmarkSessionWithResults,
	useBenchmarkHistory,
} from "@/lib/queries/benchmark";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// Inline label resolver — consistent with ScoringBar and BenchmarkColumn
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

function truncatePrompt(text: string, maxLen = 60): string {
	return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

// D-04: winner badge logic (per UI-SPEC §Color §Winner badge na história)
function WinnerBadge({ results }: { results: BenchmarkResult[] }) {
	const winner = results.find((r) => r.isWinner);
	const tie = results.find((r) => r.isTie);
	if (winner) {
		return (
			<Badge variant="default" className="text-xs font-medium">
				{getModelLabel(winner.model)}
			</Badge>
		);
	}
	if (tie) {
		return (
			<Badge variant="secondary" className="text-xs font-medium">
				Empate
			</Badge>
		);
	}
	return (
		<Badge
			variant="outline"
			className="text-xs font-medium text-muted-foreground"
		>
			Não avaliado
		</Badge>
	);
}

function HistoryRow({ session }: { session: BenchmarkSessionWithResults }) {
	const truncated = truncatePrompt(session.prompt);
	const isLong = session.prompt.length > 60;
	const createdAt =
		session.createdAt instanceof Date
			? session.createdAt
			: new Date(session.createdAt);

	const relativeDate = formatDistanceToNow(createdAt, {
		addSuffix: true,
		locale: ptBR,
	});
	const absoluteDate = createdAt.toLocaleString("pt-BR");

	return (
		<TableRow className="h-10">
			{/* Prompt — 60 chars truncated with tooltip (D-04) */}
			<TableCell className="px-4 text-sm font-normal">
				{isLong ? (
					<Tooltip>
						<TooltipTrigger asChild>
							<span className="cursor-default">{truncated}</span>
						</TooltipTrigger>
						<TooltipContent side="top" className="max-w-sm">
							{session.prompt}
						</TooltipContent>
					</Tooltip>
				) : (
					<span>{truncated}</span>
				)}
			</TableCell>

			{/* Models — one badge per result row */}
			<TableCell className="px-4">
				<div className="flex flex-wrap gap-1">
					{session.results.map((r) => (
						<Badge
							key={r.id}
							variant="secondary"
							className="text-xs font-medium"
						>
							{getModelLabel(r.model)}
						</Badge>
					))}
				</div>
			</TableCell>

			{/* Winner badge */}
			<TableCell className="px-4">
				<WinnerBadge results={session.results} />
			</TableCell>

			{/* Date — relative with absolute tooltip */}
			<TableCell className="px-4">
				<Tooltip>
					<TooltipTrigger asChild>
						<span className="cursor-default text-xs text-muted-foreground">
							{relativeDate}
						</span>
					</TooltipTrigger>
					<TooltipContent side="top">{absoluteDate}</TooltipContent>
				</Tooltip>
			</TableCell>
		</TableRow>
	);
}

export function BenchmarkHistory() {
	const { data: sessions, isLoading } = useBenchmarkHistory();

	if (isLoading) {
		return (
			<div className="flex flex-1 items-center justify-center p-8">
				<p className="text-sm text-muted-foreground">Carregando histórico...</p>
			</div>
		);
	}

	if (!sessions || sessions.length === 0) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
				<p className="text-base font-medium text-foreground">
					Nenhum benchmark registrado
				</p>
				<p className="text-sm text-muted-foreground">
					Inicie sua primeira sessão na aba &ldquo;Nova sessão&rdquo;.
				</p>
			</div>
		);
	}

	return (
		<ScrollArea className="h-full">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="px-4">Prompt</TableHead>
						<TableHead className="px-4">Modelos</TableHead>
						<TableHead className="px-4">Vencedor</TableHead>
						<TableHead className="px-4">Data</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{sessions.map((session) => (
						<HistoryRow key={session.id} session={session} />
					))}
				</TableBody>
			</Table>
		</ScrollArea>
	);
}
