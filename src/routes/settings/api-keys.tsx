import { createFileRoute } from '@tanstack/react-router';
import { ApiKeysSection } from '../../components/settings/ApiKeysSection';

export const Route = createFileRoute('/settings/api-keys')({
  component: ApiKeysSection,
});
