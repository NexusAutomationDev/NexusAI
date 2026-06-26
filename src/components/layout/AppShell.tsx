import { Outlet } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      {/* ml-12 = 48px sidebar offset (D-01 layout spec) */}
      <main className="ml-12 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
