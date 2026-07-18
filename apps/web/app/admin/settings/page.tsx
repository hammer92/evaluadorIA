'use client';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { GlobalSettingsView } from '@/features/settings/components/global-settings-view';

export default function SettingsPage(): React.JSX.Element {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <div className="space-y-stack-md">
        <h1 className="font-hanken text-display-lg text-on-surface">Configuración</h1>
      </div>
    );
  }

  if (auth.claims?.role !== 'admin') {
    return (
      <div className="space-y-stack-md">
        <h1 className="font-hanken text-display-lg text-on-surface">Configuración</h1>
        <p className="text-body-md text-on-surface-variant">
          Acceso restringido a administradores.
        </p>
      </div>
    );
  }

  return <GlobalSettingsView />;
}
