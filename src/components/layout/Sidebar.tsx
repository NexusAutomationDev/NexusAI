import { Link, useRouterState } from "@tanstack/react-router";
import {
  MessageSquare,  // Chat
  BookOpen,       // KB (Knowledge Base)
  Mail,           // Gmail
  CalendarDays,   // Calendar
  Plug,           // MCP
  Bot,            // Agents
  Settings,       // Settings gear
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export interface SidebarModule {
  id: string;
  icon: React.ElementType;
  label: string;
  route: string;
  implemented: boolean;
}

export const MODULES: SidebarModule[] = [
  { id: "chat",     icon: MessageSquare, label: "Chat",                  route: "/chat",     implemented: true },
  { id: "kb",       icon: BookOpen,      label: "Base de Conhecimento",  route: "/kb",       implemented: false },
  { id: "gmail",    icon: Mail,          label: "Gmail",                 route: "/gmail",    implemented: false },
  { id: "calendar", icon: CalendarDays,  label: "Calendário",            route: "/calendar", implemented: false },
  { id: "mcp",      icon: Plug,          label: "MCPs",                  route: "/mcp",      implemented: false },
  { id: "agents",   icon: Bot,           label: "Agentes",               route: "/agents",   implemented: false },
];

export function Sidebar() {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <TooltipProvider delayDuration={0}>
      {/* D-01: 48px width (w-12), icon-only, fixed left, full height */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-12 flex-col bg-secondary border-r border-border">
        {/* Module icons — top section */}
        <nav className="flex flex-1 flex-col items-center gap-1 py-4">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            const isActive = currentPath.startsWith(mod.route);

            if (!mod.implemented) {
              return (
                // D-03: disabled stubs — opacity-40, "Em breve" tooltip
                <Tooltip key={mod.id}>
                  <TooltipTrigger asChild>
                    <button
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-md",
                        "opacity-40 cursor-not-allowed"
                      )}
                      aria-label={mod.label}
                      aria-disabled="true"
                      onClick={(e) => e.preventDefault()}
                    >
                      <Icon size={20} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Em breve</TooltipContent>
                </Tooltip>
              );
            }

            return (
              <Tooltip key={mod.id}>
                <TooltipTrigger asChild>
                  <Link
                    to={mod.route}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-md",
                      "text-muted-foreground transition-colors",
                      "hover:bg-muted hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isActive && "ring-2 ring-ring text-primary"
                    )}
                    aria-label={mod.label}
                  >
                    <Icon size={20} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">{mod.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </nav>

        {/* Settings gear — bottom of sidebar (D-04) */}
        <div className="flex flex-col items-center pb-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/settings"
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-md mt-auto",
                  "text-muted-foreground transition-colors",
                  "hover:bg-muted hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  currentPath.startsWith("/settings") && "ring-2 ring-ring text-primary"
                )}
                aria-label="Configurações"
              >
                <Settings size={20} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">Configurações</TooltipContent>
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
