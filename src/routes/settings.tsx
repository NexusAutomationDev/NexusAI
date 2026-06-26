import { createFileRoute, Outlet } from '@tanstack/react-router';
import { SettingsNav } from '../components/settings/SettingsNav';

export const Route = createFileRoute('/settings')({
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className="flex h-full">
      <aside className="w-40 border-r border-border bg-secondary/50 py-4 px-2 flex-shrink-0">
        <SettingsNav />
      </aside>
      <div className="flex-1 overflow-auto px-8 py-6">
        <Outlet />
      </div>
    </div>
  );
}
