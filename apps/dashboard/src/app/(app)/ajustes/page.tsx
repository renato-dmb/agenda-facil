import Link from 'next/link';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import {
  Briefcase,
  Clock,
  Repeat,
  BookOpen,
  Plug,
  Bell,
} from 'lucide-react';

const SECTIONS = [
  {
    href: '/ajustes/servicos',
    title: 'Serviços',
    description: 'Tipos de atendimento, duração e preço',
    icon: Briefcase,
  },
  {
    href: '/ajustes/horarios',
    title: 'Horário de funcionamento',
    description: 'Grade semanal que o bot considera para encaixes',
    icon: Clock,
  },
  {
    href: '/ajustes/recorrencia',
    title: 'Recorrência',
    description: 'Mensagens automáticas para clientes que sumiram',
    icon: Repeat,
  },
  {
    href: '/ajustes/lembretes',
    title: 'Lembretes',
    description: 'Confirmação pré-atendimento + follow-up pós',
    icon: Bell,
  },
  {
    href: '/ajustes/conhecimento',
    title: 'Base de conhecimento',
    description: 'Como o bot responde — políticas, FAQs, tom de voz',
    icon: BookOpen,
  },
  {
    href: '/ajustes/integracoes',
    title: 'Integrações',
    description: 'WhatsApp + Google Calendar + pausar/retomar bot',
    icon: Plug,
  },
];

export default function AjustesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ajustes</h1>
        <p className="text-muted-foreground">Configure como o bot atende.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.href} href={s.href}>
              <Card className="transition-colors hover:bg-accent">
                <CardContent className="flex items-start gap-3 p-5">
                  <div className="rounded-md bg-muted p-2">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-base">{s.title}</CardTitle>
                    <CardDescription>{s.description}</CardDescription>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
