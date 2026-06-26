import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/appearance')({
  component: () => (
    <div>
      <h1 className="text-xl font-semibold">Aparência</h1>
      <p className="mt-2 text-sm text-muted-foreground">Carregando… (Plan 04)</p>
    </div>
  ),
});
