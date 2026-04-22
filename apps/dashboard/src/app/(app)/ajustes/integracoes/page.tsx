import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, googleOAuth } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IntegrationsClient } from './integrations-client';

const BOT_PUBLIC_URL = process.env.NEXT_PUBLIC_BOT_URL || process.env.BOT_PUBLIC_URL;

export default async function IntegracoesPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const gcalToken = await googleOAuth.getByTenantId(tenant.id);
  const pairUrl = BOT_PUBLIC_URL
    ? `${BOT_PUBLIC_URL}/pair/${tenant.slug}`
    : `/pair/${tenant.slug}`;
  const pairResetUrl = `${pairUrl}?reset=1`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/ajustes" className="text-sm text-muted-foreground hover:underline">
          ← Ajustes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Integrações</h1>
        <p className="text-muted-foreground">
          Status das conexões e controle geral do bot.
        </p>
      </div>

      <IntegrationsClient initialAiActive={tenant.ai_active !== false} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Google Calendar</span>
            <span
              className={`rounded-full px-3 py-1 text-sm ${
                gcalToken
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {gcalToken ? '✓ conectado' : '⚠ não conectado'}
            </span>
          </CardTitle>
          <CardDescription>
            {gcalToken
              ? `Conta: ${gcalToken.google_account_email || 'desconhecida'}`
              : 'Conecte sua conta Google para que o bot possa consultar e criar eventos.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            A reconexão é manual via script (oauth-setup). Esta integração direta pelo dashboard
            entra na próxima fase.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>WhatsApp</span>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800">
              verificar /health
            </span>
          </CardTitle>
          <CardDescription>
            Pareamento e reset do dispositivo ligado ao Baileys.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={pairUrl} target="_blank" rel="noopener noreferrer">
              Ver status / parear
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={pairResetUrl} target="_blank" rel="noopener noreferrer">
              Trocar de número (reset)
            </a>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
