import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { SettingsNav } from '../../components/settings/SettingsNav';

export const Route = createFileRoute('/settings/')({
  beforeLoad: ({ location }) => {
    // Redirect /settings to /settings/api-keys by default
    if (location.pathname === '/settings' || location.pathname === '/settings/') {
      throw redirect({ to: '/settings/api-keys' });
    }
  },
  component: SettingsLayout,
});

function SettingsLayout() {
  return (
    <div className="flex h-full">
      {/* Sub-nav sidebar — w-40 (160px) per UI-SPEC §Settings Page Layout */}
      <aside className="w-40 border-r border-border bg-secondary/50 py-4 px-2 flex-shrink-0">
        <SettingsNav />
      </aside>
      {/* Settings content panel — px-8 py-6 per UI-SPEC */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <Outlet />
      </div>
    </div>
  );
}
