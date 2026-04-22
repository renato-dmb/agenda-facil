'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

async function download(path: string, filename: string) {
  const res = await fetch(path);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportButtons() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => download('/api/dashboard/export/customers', 'clientes.csv')}
      >
        <Download className="mr-2 h-4 w-4" />
        Clientes
      </Button>
      <Button
        variant="outline"
        onClick={() => download('/api/dashboard/export/appointments', 'agendamentos.csv')}
      >
        <Download className="mr-2 h-4 w-4" />
        Agendamentos
      </Button>
      <Button
        variant="outline"
        onClick={() => download('/api/dashboard/export/reviews', 'avaliacoes.csv')}
      >
        <Download className="mr-2 h-4 w-4" />
        Avaliações
      </Button>
    </div>
  );
}
