import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ModuleStubProps {
  moduleName: string; // e.g., "Chat", "Agentes"
}

export function ModuleStub({ moduleName }: ModuleStubProps) {
  return (
    <TooltipProvider>
      <div className="flex h-full w-full items-center justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-center text-muted-foreground">
              <p className="text-sm font-medium">{moduleName}</p>
              <p className="mt-1 text-xs opacity-60">Em breve</p>
            </div>
          </TooltipTrigger>
          <TooltipContent>Em breve</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
