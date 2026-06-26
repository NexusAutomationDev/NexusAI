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
    // h-full w-full: fills AppShell's <main> which is already flex-1 overflow-auto
    <div className="flex h-full w-full">
      <ResizablePanelGroup
        direction="horizontal"
        className="h-full w-full"
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
    </div>
  );
}
