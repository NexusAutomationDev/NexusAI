import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/settings/")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className="flex h-full">
      {/* Sub-nav sidebar (160px) — populated in Plan 03 */}
      <nav className="w-40 border-r border-border bg-secondary/50 py-4 px-2">
        <p className="text-xs text-muted-foreground px-2">
          {/* Placeholder — Plan 03 replaces this with SettingsNav */}
          Carregando…
        </p>
      </nav>
      {/* Settings panel */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <Outlet />
      </div>
    </div>
  );
}
