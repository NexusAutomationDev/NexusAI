import { createFileRoute } from '@tanstack/react-router';
import { ModelsSection } from '../../components/settings/ModelsSection';

export const Route = createFileRoute('/settings/models')({
  component: ModelsSection,
});
