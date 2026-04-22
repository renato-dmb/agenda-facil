import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, conversations } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatPhone, relativeFromNow } from '@/lib/format';

type Row = {
  phone: string;
  customer_name: string | null;
  state: string;
  history: Array<{ role: string; content: unknown }>;
  updated_at: string;
};

function lastUserText(history: Row['history']): string {
  if (!Array.isArray(history)) return '';
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    if (m.role === 'user' && typeof m.content === 'string') {
      return m.content.slice(0, 80);
    }
  }
  return '';
}

export default async function ConversasPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const rows = (await conversations.listByTenant(tenant.id)) as Row[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Conversas</h1>
          <p className="text-muted-foreground">{rows.length} total</p>
        </div>
        <Button asChild>
          <Link href="/conversas/nova">+ Nova</Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma conversa ainda.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Lista</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {rows.map((c) => (
              <Link
                href={`/conversas/${encodeURIComponent(c.phone)}`}
                key={c.phone}
                className="flex items-start justify-between py-3 hover:bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium">{c.customer_name || '(sem nome)'}</p>
                    {c.state === 'paused' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                        IA pausada
                      </span>
                    )}
                    {c.state === 'escalated' && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">
                        escalado
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">{formatPhone(c.phone)}</p>
                  <p className="mt-1 truncate text-sm">{lastUserText(c.history)}</p>
                </div>
                <p className="ml-3 shrink-0 text-xs text-muted-foreground">
                  {relativeFromNow(c.updated_at)}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
