import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { tenants, knowledge } from '@agenda-facil/db';
import { redirect } from 'next/navigation';
import { KnowledgeClient } from './knowledge-client';

const SECTIONS = [
  {
    key: 'services',
    title: 'Serviços',
    hint: 'Descreva o que você oferece, estilos, acabamentos.',
  },
  {
    key: 'hours',
    title: 'Horários',
    hint: 'Dias de folga, intervalos, observações.',
  },
  {
    key: 'policies',
    title: 'Políticas',
    hint: 'Cancelamento, atrasos, pagamento, no-show.',
  },
  { key: 'faq', title: 'FAQ', hint: 'Perguntas frequentes dos clientes.' },
  { key: 'tone', title: 'Tom de voz', hint: 'Como o bot deve se comunicar.' },
];

function fallbackFromFile(slug: string, section: string): string {
  try {
    const file = path.join(
      process.cwd(),
      '..',
      'bot',
      'tenants',
      slug,
      `${section}.md`,
    );
    if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  } catch {
    // ignora (em prod standalone build o path muda)
  }
  return '';
}

export default async function ConhecimentoPage() {
  const session = await readSession();
  if (!session) redirect('/login');
  const tenant = await tenants.getById(session.tenant_id);
  if (!tenant) redirect('/login');

  const db = (await knowledge.listByTenant(tenant.id)) as Array<{
    section: string;
    content: string;
  }>;
  const dbMap = new Map(db.map((r) => [r.section, r.content]));

  const initial = SECTIONS.map((s) => ({
    key: s.key,
    title: s.title,
    hint: s.hint,
    content: dbMap.get(s.key) ?? fallbackFromFile(tenant.slug, s.key),
    fromFallback: !dbMap.has(s.key),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/ajustes" className="text-sm text-muted-foreground hover:underline">
          ← Ajustes
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Base de conhecimento</h1>
        <p className="text-muted-foreground">
          Tudo que o bot precisa saber pra responder. Use linguagem natural — o conteúdo entra no
          system prompt da IA.
        </p>
      </div>

      <KnowledgeClient sections={initial} />
    </div>
  );
}
