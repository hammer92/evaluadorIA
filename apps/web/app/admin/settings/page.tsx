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
    return <p className="text-sm text-muted-foreground">Sin sesión.</p>;
  }
  const tab = searchParams.tab ?? 'profile';
  const isAdmin = auth.role === 'admin';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground text-sm">Preferencias y datos de tu cuenta.</p>
      </div>
      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="team" disabled={!isAdmin}>
            Team
          </TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
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
