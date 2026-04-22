import { readSession } from '@/lib/auth';
import { tenants, contacts } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { ContactsClient } from './contacts-client';

export default async function ContatosPage() {
  const session = await readSession();
  if (!session) redirect('/login');

  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const list = await contacts.listByTenant(tenant.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Contatos</h1>
        <p className="text-muted-foreground">
          Configure quem o bot atende — modo público (atende todos, ignora a lista) ou privado
          (atende só a lista).
        </p>
      </div>

      <ContactsClient
        mode={(tenant.audience_mode as 'public' | 'private') || 'public'}
        initial={list}
      />
    </div>
  );
}
