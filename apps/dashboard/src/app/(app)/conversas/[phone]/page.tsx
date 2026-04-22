import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { readSession } from '@/lib/auth';
import { tenants, conversations, messages, customers } from '@agenda-facil/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatPhone, formatDateTime } from '@/lib/format';
import { ConversationControls } from './controls';

type MsgRow = {
  id: string;
  direction: 'in' | 'out';
  body: string | null;
  created_at: string;
};

export default async function ConversationDetail({
  params,
}: {
  params: Promise<{ phone: string }>;
}) {
  const { phone: phoneParam } = await params;
  const phone = decodeURIComponent(phoneParam);

  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const conv = await conversations.get(tenant.id, phone);
  if (!conv) notFound();

  const customer = await customers.getByPhone(tenant.id, phone);
  const log = (await messages.listByPhone(tenant.id, phone, { limit: 200 })) as MsgRow[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/conversas" className="text-sm text-muted-foreground hover:underline">
          ← Voltar
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">
          {customer?.name || '(sem nome)'}
        </h1>
        <p className="text-muted-foreground">{formatPhone(phone)}</p>
      </div>

      <ConversationControls phone={phone} state={conv.state} />

      <Card>
        <CardHeader>
          <CardTitle>Histórico ({log.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem mensagens.</p>
          ) : (
            log.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  m.direction === 'in'
                    ? 'bg-muted'
                    : 'ml-auto bg-primary text-primary-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body || '(vazia)'}</p>
                <p
                  className={`mt-1 text-[10px] ${
                    m.direction === 'in' ? 'text-muted-foreground' : 'text-primary-foreground/70'
                  }`}
                >
                  {formatDateTime(m.created_at)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
