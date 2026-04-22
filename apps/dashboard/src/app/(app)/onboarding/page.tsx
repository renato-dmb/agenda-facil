import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, services, googleOAuth } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Circle } from 'lucide-react';
import { ActivateButton } from './activate';

const BOT_PUBLIC_URL =
  process.env.BOT_PUBLIC_URL || 'https://bot-production-156b.up.railway.app';

type Step = {
  done: boolean;
  title: string;
  description: string;
  href: string;
  cta: string;
};

export default async function OnboardingPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const [svcList, hoursList, gcalToken] = await Promise.all([
    services.listActive(tenant.id),
    services.listBusinessHours(tenant.id),
    googleOAuth.getByTenantId(tenant.id),
  ]);

  const steps: Step[] = [
    {
      done: svcList.length > 0,
      title: '1. Cadastre seus serviços',
      description: 'Pelo menos 1 serviço (corte, barba, consulta, etc).',
      href: '/ajustes/servicos',
      cta: 'Abrir serviços',
    },
    {
      done: hoursList.length > 0,
      title: '2. Configure horário de funcionamento',
      description: 'Grade semanal — o bot vai usar ao sugerir horários.',
      href: '/ajustes/horarios',
      cta: 'Abrir horários',
    },
    {
      done: !!gcalToken,
      title: '3. Conecte o Google Calendar',
      description: 'Agendamentos criados vão pro seu Calendar automático.',
      href: `${BOT_PUBLIC_URL}/oauth/google/start?slug=${tenant.slug}`,
      cta: 'Conectar Google',
    },
    {
      done: tenant.whatsapp_number != null,
      title: '4. Pareie o WhatsApp',
      description: 'Escaneie o QR code no WhatsApp do seu celular.',
      href: `${BOT_PUBLIC_URL}/pair/${tenant.slug}`,
      cta: 'Parear WhatsApp',
    },
  ];

  const allDone = steps.every((s) => s.done);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Primeiros passos</h1>
        <p className="text-muted-foreground">
          Configure sua conta em 4 etapas. Depois o bot tá pronto pra receber mensagens.
        </p>
      </div>

      {steps.map((s, i) => (
        <Card key={i} className={s.done ? 'opacity-70' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {s.done ? (
                <Check className="h-5 w-5 text-emerald-600" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              {s.title}
            </CardTitle>
            <CardDescription>{s.description}</CardDescription>
          </CardHeader>
          {!s.done && (
            <CardContent>
              <Button asChild>
                <Link href={s.href} target={s.href.startsWith('http') ? '_blank' : undefined}>
                  {s.cta}
                </Link>
              </Button>
            </CardContent>
          )}
        </Card>
      ))}

      {allDone && tenant.status !== 'active' && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader>
            <CardTitle>Tudo pronto! 🎉</CardTitle>
            <CardDescription>
              Ativa sua conta pra o bot começar a responder clientes automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivateButton />
          </CardContent>
        </Card>
      )}

      {tenant.status === 'active' && (
        <Card>
          <CardContent className="py-4 text-center text-sm text-muted-foreground">
            ✓ Conta ativa. <Link href="/home" className="underline">Ir pro dashboard</Link>.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
