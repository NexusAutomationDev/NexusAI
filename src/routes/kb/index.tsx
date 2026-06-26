import { createFileRoute } from "@tanstack/react-router";
import { ModuleStub } from "@/components/layout/ModuleStub";

export const Route = createFileRoute("/kb/")({
  component: () => <ModuleStub moduleName="Base de Conhecimento" />,
});
