import { createFileRoute, Outlet } from "@tanstack/react-router";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ConversationList } from "./components/ConversationList";

// D-01: Two-column split layout — conversation list always visible (per D-01)
// D-02: Resizable with autoSaveId for localStorage persistence
export const Route = createFileRoute("/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  return (
    // Outer div provides explicit pixel dimensions so react-resizable-panels'
    // ResizeObserver measures the correct container size. ResizablePanelGroup
    // fills 100% of this wrapper via its built-in h-full w-full classes.
    // Sidebar = w-12 = 3rem; calc(100vw - 3rem) leaves the correct remaining width.
    <div style={{ height: "100vh", width: "calc(100vw - 3rem)", overflow: "hidden" }}>
      <ResizablePanelGroup orientation="horizontal" className="h-full">
        {/* D-02: Conversation list — default 22% (~254px). In v4, minSize/maxSize are
            in pixels so they're omitted here to avoid clamping the defaultSize (%). */}
        <ResizablePanel defaultSize={22}>
          <ConversationList />
        </ResizablePanel>

        {/* Drag handle with visual indicator */}
        <ResizableHandle withHandle />

        {/* Chat view — fills remaining space */}
        <ResizablePanel defaultSize={78}>
          <Outlet />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
