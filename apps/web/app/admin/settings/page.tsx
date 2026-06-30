import { GlobalSettingsView } from '@/features/settings/components/global-settings-view';
import { verifyAuth } from '@/services/auth-service';

export const dynamic = 'force-dynamic';

export default async function SettingsPage(): Promise<React.JSX.Element> {
  const auth = await verifyAuth();
  if (!auth) {
    return (
      <div className="space-y-stack-md">
        <h1 className="font-hanken text-display-lg text-on-surface">Configuración</h1>
        <p className="text-body-md text-on-surface-variant">Sin sesión activa.</p>
      </div>
    );
  }

  return <GlobalSettingsView />;
}
