import { readSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CampaignClient } from './campaign-client';

export default async function CampanhasPage() {
  const session = await readSession();
  if (!session) redirect('/login');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Campanhas</h1>
        <p className="text-muted-foreground">
          Envie mensagem em massa pra segmento da sua base. O envio é espaçado (~2,5s entre
          mensagens) pra não disparar detecção do WhatsApp.
        </p>
      </div>

      <CampaignClient />
    </div>
  );
}
