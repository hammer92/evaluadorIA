import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BillingCard } from '@/features/settings/components/billing-card';
import { ProfileForm } from '@/features/settings/components/profile-form';
import { TeamList } from '@/features/settings/components/team-list';
import { verifyAuth } from '@/services/auth-service';

export const dynamic = 'force-dynamic';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}): Promise<React.JSX.Element> {
  const auth = await verifyAuth();
  if (!auth) {
    return (
      <div className="space-y-stack-md">
        <h1 className="font-hanken text-display-lg text-on-surface">Settings</h1>
        <p className="text-body-md text-on-surface-variant">Sin sesión activa.</p>
      </div>
    );
  }
  const tab = searchParams.tab ?? 'profile';
  const isAdmin = auth.role === 'admin';

  return (
    <div className="space-y-stack-lg">
      <header className="space-y-stack-sm">
        <p className="text-label-sm text-outline-tv">CUENTA</p>
        <h1 className="font-hanken text-display-lg text-on-surface">Settings</h1>
        <p className="text-body-lg text-on-surface-variant">Preferencias y datos de tu cuenta.</p>
      </header>
      <Tabs defaultValue={tab} className="space-y-stack-lg">
        <TabsList className="border-b border-border-standard bg-transparent p-0">
          <TabsTrigger
            value="profile"
            className="rounded-none border-b-2 border-transparent px-stack-md py-stack-sm font-hanken text-label-sm uppercase tracking-wider text-on-surface-variant data-[state=active]:border-brand-secondary data-[state=active]:text-navy"
          >
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="team"
            disabled={!isAdmin}
            className="rounded-none border-b-2 border-transparent px-stack-md py-stack-sm font-hanken text-label-sm uppercase tracking-wider text-on-surface-variant data-[state=active]:border-brand-secondary data-[state=active]:text-navy disabled:opacity-50"
          >
            Team
          </TabsTrigger>
          <TabsTrigger
            value="billing"
            className="rounded-none border-b-2 border-transparent px-stack-md py-stack-sm font-hanken text-label-sm uppercase tracking-wider text-on-surface-variant data-[state=active]:border-brand-secondary data-[state=active]:text-navy"
          >
            Billing
          </TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <ProfileForm user={auth} />
        </TabsContent>
        <TabsContent value="team">
          <TeamList />
        </TabsContent>
        <TabsContent value="billing">
          <BillingCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
