import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBenchmarkStore } from "@/lib/stores/benchmark";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BenchmarkColumns } from "./-components/BenchmarkColumns";
import { BenchmarkHistory } from "./-components/BenchmarkHistory";
import { BenchmarkPrompt } from "./-components/BenchmarkPrompt";
import { ScoringBar } from "./-components/ScoringBar";

export const Route = createFileRoute("/benchmark/")({
	component: BenchmarkPage,
});

function BenchmarkPage() {
	const [activeTab, setActiveTab] = useState<"session" | "history">("session");
	const activeSession = useBenchmarkStore((s) => s.activeSession);
	const isRunning = activeSession !== null;

	return (
		<div className="flex h-screen flex-col overflow-hidden pl-12">
			<Tabs
				value={activeTab}
				onValueChange={(v) => setActiveTab(v as "session" | "history")}
				className="flex flex-1 flex-col overflow-hidden"
			>
				{/* Module header */}
				<div className="flex h-11 shrink-0 items-center border-b border-border px-4">
					<TabsList className="h-7">
						<TabsTrigger
							value="session"
							className="h-7 px-3 text-sm font-medium"
						>
							Nova sessão
						</TabsTrigger>
						<TabsTrigger
							value="history"
							className="h-7 px-3 text-sm font-medium"
						>
							Histórico
						</TabsTrigger>
					</TabsList>
				</div>

				{/* Nova sessão tab */}
				<TabsContent
					value="session"
					className="mt-0 flex flex-1 flex-col overflow-hidden"
				>
					{!isRunning ? (
						<BenchmarkPrompt />
					) : (
						<div className="flex flex-1 flex-col overflow-hidden">
							<BenchmarkColumns />
							<ScoringBar />
						</div>
					)}
				</TabsContent>

				{/* Histórico tab */}
				<TabsContent value="history" className="mt-0 flex-1 overflow-auto">
					<BenchmarkHistory />
				</TabsContent>
			</Tabs>
		</div>
	);
}
