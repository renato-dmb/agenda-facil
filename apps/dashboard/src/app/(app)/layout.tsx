import { redirect } from 'next/navigation';
import { resolveSessionTenant } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ativa = await resolveSessionTenant();
  if (!ativa) redirect('/login');
  const { tenant } = ativa;

  return (
    <AppShell tenantName={tenant.name} tenantSlug={tenant.slug}>
      {children}
    </AppShell>
  );
}
