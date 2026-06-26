import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/layout/ModuleStub";

export const Route = createFileRoute("/calendar/")({
  component: () => <ModuleStub moduleName="Calendário" />,
});
