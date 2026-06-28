import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useBenchmarkStore } from "@/lib/stores/benchmark";
import React, { useEffect } from "react";
import { BenchmarkColumn } from "./BenchmarkColumn";

export function BenchmarkColumns() {
	const activeSession = useBenchmarkStore((s) => s.activeSession);
	const stopAll = useBenchmarkStore((s) => s.stopAll);

	// Cancel all streams when component unmounts (user navigates away mid-stream)
	useEffect(() => {
		return () => {
			stopAll();
		};
	}, [stopAll]);

	if (!activeSession) return null;

	const { columns } = activeSession;
	const defaultSize = Math.floor(100 / columns.length);

	return (
		// CRITICAL: orientation="horizontal" (NOT direction= — v4 API rename)
		// CRITICAL: DO NOT add autoSaveId — removed in v4
		// CRITICAL: panel count FIXED here — cannot add/remove after mount (D-01)
		<ResizablePanelGroup orientation="horizontal" className="flex-1 min-h-0">
			{columns.map((col, idx) => (
				<React.Fragment key={`${activeSession.sessionId}-col-${idx}`}>
					{idx > 0 && <ResizableHandle withHandle />}
					<ResizablePanel
						collapsible={true}
						collapsedSize={4}
						defaultSize={defaultSize}
						minSize={15}
					>
						<BenchmarkColumn column={col} colIdx={idx} />
					</ResizablePanel>
				</React.Fragment>
			))}
		</ResizablePanelGroup>
	);
}
