'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Template = {
  content: string;
  offset_minutes: number | null;
  active: boolean;
};

export function RemindersClient({
  initialPre,
  initialPost,
}: {
  initialPre: Template;
  initialPost: Template;
}) {
  return (
    <div className="space-y-6">
      <ReminderCard
        kind="pre_appointment"
        title="Pré-atendimento"
        description="Confirmação antes do horário combinado. Ajuda a reduzir no-show."
        direction="antes"
        defaultMinutes={120}
        initial={initialPre}
      />
      <ReminderCard
        kind="post_appointment"
        title="Pós-atendimento (pesquisa CSAT)"
        description="Follow-up que abre a pesquisa de satisfação CSAT. O bot coleta nota 1-5, comentário livre e interesse em retorno. Se o cliente quiser retorno, sugere horários automaticamente."
        direction="depois"
        defaultMinutes={120}
        initial={initialPost}
      />
    </div>
  );
}

function ReminderCard({
  kind,
  title,
  description,
  direction,
  defaultMinutes,
  initial,
}: {
  kind: 'pre_appointment' | 'post_appointment';
  title: string;
  description: string;
  direction: 'antes' | 'depois';
  defaultMinutes: number;
  initial: Template;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [active, setActive] = useState(initial.active);
  const [content, setContent] = useState(initial.content);
  const [minutesAbs, setMinutesAbs] = useState(
    Math.abs(initial.offset_minutes ?? (direction === 'antes' ? -defaultMinutes : defaultMinutes)),
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const signedMinutes = direction === 'antes' ? -minutesAbs : minutesAbs;

  async function save() {
    setError(null);
    setSaved(false);
    if (!content.trim()) {
      setError('Mensagem obrigatória');
      return;
    }
    if (!Number.isFinite(minutesAbs) || minutesAbs <= 0) {
      setError('Minutos precisa ser maior que zero');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/dashboard/reminders', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind,
          content: content.trim(),
          offset_minutes: signedMinutes,
          active,
        }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Falha');
      else {
        setSaved(true);
        router.refresh();
      }
    });
  }

  const preview = content
    .replace(/\{first_name\}/gi, 'Renato')
    .replace(/\{nome\}/gi, 'Renato Silva')
    .replace(/\{time\}/gi, '14:30')
    .replace(/\{date\}/gi, '22/04')
    .replace(/\{weekday\}/gi, 'quarta-feira')
    .replace(/\{service\}/gi, 'Corte');

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => {
              setActive(e.target.checked);
              setSaved(false);
            }}
            className="h-4 w-4"
            disabled={pending}
          />
          <span className="text-sm">Ativado</span>
        </label>

        <div>
          <Label className="text-xs">Disparar quantos minutos {direction}?</Label>
          <div className="mt-1 flex items-center gap-2">
            <Input
              type="number"
              min={5}
              step={5}
              value={minutesAbs}
              onChange={(e) => {
                setMinutesAbs(Number(e.target.value) || 0);
                setSaved(false);
              }}
              className="w-32"
              disabled={!active || pending}
            />
            <span className="text-sm text-muted-foreground">
              minutos {direction === 'antes' ? 'antes do início' : 'após o término'} do agendamento
            </span>
          </div>
        </div>

        <div>
          <Label className="text-xs">Mensagem</Label>
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setSaved(false);
            }}
            rows={4}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            disabled={!active || pending}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Variáveis: <code className="rounded bg-muted px-1">{'{first_name}'}</code>{' '}
            <code className="rounded bg-muted px-1">{'{time}'}</code>{' '}
            <code className="rounded bg-muted px-1">{'{date}'}</code>{' '}
            <code className="rounded bg-muted px-1">{'{weekday}'}</code>{' '}
            <code className="rounded bg-muted px-1">{'{service}'}</code>
          </p>
        </div>

        {content && (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Preview
            </p>
            <p className="whitespace-pre-wrap text-sm">{preview}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending}>
            {pending ? 'Salvando...' : 'Salvar'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-emerald-600">Salvo ✓</p>}
        </div>
      </CardContent>
    </Card>
  );
}
