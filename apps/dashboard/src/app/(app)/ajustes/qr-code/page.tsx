import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const BOT_PUBLIC_URL =
  process.env.BOT_PUBLIC_URL || 'https://bot-production-156b.up.railway.app';

export default async function QrCodePage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const imgUrl = `${BOT_PUBLIC_URL}/qr/${tenant.slug}.png`;
  const pageUrl = `${BOT_PUBLIC_URL}/qr/${tenant.slug}`;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/ajustes" className="text-sm text-muted-foreground hover:underline">
          ← Ajustes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">QR code da sua barbearia</h1>
        <p className="text-muted-foreground">
          Imprima e cole na parede/balcão. Cliente escaneia e cai direto no WhatsApp com você.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seu QR</CardTitle>
          <CardDescription>
            Aponta para{' '}
            <code className="rounded bg-muted px-1 text-xs">
              wa.me/{tenant.whatsapp_number || '...'}
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tenant.whatsapp_number ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgUrl}
                alt="QR code"
                className="mx-auto w-72 rounded-md border bg-white p-3"
              />
              <div className="flex justify-center gap-3">
                <a
                  href={imgUrl}
                  download={`qr-${tenant.slug}.png`}
                  className="text-sm underline"
                >
                  baixar PNG
                </a>
                <a
                  href={pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm underline"
                >
                  página pública
                </a>
              </div>
            </>
          ) : (
            <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              Você ainda não cadastrou o número do WhatsApp do negócio nos ajustes. O QR só fica
              disponível quando houver um número.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
