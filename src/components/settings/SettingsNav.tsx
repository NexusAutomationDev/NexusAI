import { Link, useRouterState } from '@tanstack/react-router';
import { Separator } from '../ui/separator';
import { cn } from '../../lib/utils';

interface NavItem {
  route: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { route: '/settings/api-keys', label: 'Chaves de API' },
  { route: '/settings/models',   label: 'Modelos' },
  { route: '/settings/appearance', label: 'Aparência' },
];

export function SettingsNav() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <nav className="flex flex-col gap-1 py-2">
      <p className="px-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
        Configurações
      </p>
      <Separator className="mb-2" />
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.route}
          to={item.route}
          className={cn(
            'flex h-9 items-center rounded-md px-3 text-sm font-medium',
            'text-muted-foreground transition-colors',
            'hover:bg-muted hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            currentPath === item.route && 'bg-muted text-foreground'
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
