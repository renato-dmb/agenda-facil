import { notFound } from 'next/navigation';
import { tenants, services, knowledge, pool } from '@agenda-facil/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const BOT_PUBLIC_URL =
  process.env.BOT_PUBLIC_URL || 'https://bot-production-156b.up.railway.app';

type Service = {
  id: string;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
};

type Hour = { weekday: number; start_time: string; end_time: string };

export default async function PublicLanding({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await tenants.getBySlug(slug);
  if (!tenant || tenant.status !== 'active') notFound();

  const [svc, hours, kb] = await Promise.all([
    services.listActive(tenant.id) as Promise<Service[]>,
    services.listBusinessHours(tenant.id) as Promise<Hour[]>,
    knowledge.listByTenant(tenant.id) as Promise<Array<{ section: string; content: string }>>,
  ]);

  const kbMap = new Map(kb.map((k) => [k.section, k.content]));
  const tone = kbMap.get('tone') || '';
  const policies = kbMap.get('policies') || '';

  const hoursByDay = new Map<number, Hour[]>();
  for (const h of hours) {
    if (!hoursByDay.has(h.weekday)) hoursByDay.set(h.weekday, []);
    hoursByDay.get(h.weekday)!.push(h);
  }

  const waUrl = tenant.whatsapp_number
    ? `https://wa.me/${tenant.whatsapp_number}?text=${encodeURIComponent('Oi! quero agendar')}`
    : null;
  const qrUrl = `${BOT_PUBLIC_URL}/qr/${slug}.png`;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold">{tenant.name}</h1>
          <p className="mt-2 capitalize text-muted-foreground">{tenant.profession_type}</p>
        </header>

        {waUrl && (
          <Card className="mb-6 border-emerald-200 bg-emerald-50">
            <CardContent className="flex flex-col items-center gap-3 py-6">
              <p className="text-sm">Agendar agora é só clicar — você fala direto comigo no WhatsApp.</p>
              <Button asChild size="lg">
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-5 w-5" />
                  Agendar pelo WhatsApp
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {svc.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Serviços</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {svc.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.duration_minutes} minutos</p>
                  </div>
                  {s.price_cents != null && (
                    <p className="font-semibold">R$ {(s.price_cents / 100).toFixed(2)}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {hoursByDay.size > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Horário de funcionamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Array.from({ length: 7 }).map((_, weekday) => {
                const items = hoursByDay.get(weekday) || [];
                return (
                  <div key={weekday} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{DAYS[weekday]}</span>
                    {items.length === 0 ? (
                      <span className="text-muted-foreground">fechado</span>
                    ) : (
                      <span>
                        {items
                          .map(
                            (h) =>
                              `${h.start_time.slice(0, 5)}–${h.end_time.slice(0, 5)}`,
                          )
                          .join(' · ')}
                      </span>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {policies && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Políticas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{policies}</p>
            </CardContent>
          </Card>
        )}

        {waUrl && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>QR code</CardTitle>
              <CardDescription>
                Aponte a câmera do celular pra abrir o WhatsApp direto.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="QR" className="w-56 rounded-md border bg-white p-2" />
            </CardContent>
          </Card>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground">
          agenda-fácil · {tone ? tone.split('\n')[0] : 'feito com carinho'}
        </p>
      </div>
    </div>
  );
}
