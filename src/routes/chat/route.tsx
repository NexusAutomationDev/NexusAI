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
  // Explicit viewport-based dimensions so react-resizable-panels ResizeObserver
  // measures the correct container size regardless of flex/percentage cascade.
  // Sidebar is w-12 = 3rem; calc(100vw - 3rem) = remaining width after sidebar.
  return (
    <ResizablePanelGroup
      direction="horizontal"
      style={{ height: "100vh", width: "calc(100vw - 3rem)" }}
    >
      {/* D-02: Conversation list — default ~280px, range 20%-40% of viewport */}
      <ResizablePanel defaultSize={22} minSize={18} maxSize={35}>
        <ConversationList />
      </ResizablePanel>

      {/* Drag handle with visual indicator */}
      <ResizableHandle withHandle />

      {/* Chat view — fills remaining space */}
      <ResizablePanel defaultSize={78}>
        <Outlet />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
