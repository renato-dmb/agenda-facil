import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ExportButtons } from './export-buttons';

export default async function ExportarPage() {
  const session = await readSession();
  if (!session) redirect('/login');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/ajustes" className="text-sm text-muted-foreground hover:underline">
          ← Ajustes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Exportar dados</h1>
        <p className="text-muted-foreground">
          Baixe seus dados em CSV. Útil pra backup, análise em planilha ou migração.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planilhas</CardTitle>
          <CardDescription>Clique para baixar.</CardDescription>
        </CardHeader>
        <CardContent>
          <ExportButtons />
        </CardContent>
      </Card>
    </div>
  );
}
