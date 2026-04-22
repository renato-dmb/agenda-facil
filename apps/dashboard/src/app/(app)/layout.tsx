import { redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { tenants } from '@agenda-facil/db';
import { AppShell } from '@/components/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession();
  if (!session) redirect('/login');

  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  return (
    <AppShell tenantName={tenant.name} tenantSlug={tenant.slug}>
      {children}
    </AppShell>
  );
}
