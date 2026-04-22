'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Section = {
  key: string;
  title: string;
  hint: string;
  content: string;
  fromFallback: boolean;
};

export function KnowledgeClient({ sections }: { sections: Section[] }) {
  const router = useRouter();
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <SectionEditor key={s.key} initial={s} onSaved={() => router.refresh()} />
      ))}
    </div>
  );
}

function SectionEditor({ initial, onSaved }: { initial: Section; onSaved: () => void }) {
  const [content, setContent] = useState(initial.content);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const dirty = content !== initial.content;

  async function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await fetch('/api/dashboard/knowledge', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ section: initial.key, content }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Falha');
      else {
        setSaved(true);
        onSaved();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{initial.title}</span>
          {initial.fromFallback && !dirty && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
              usando template inicial
            </span>
          )}
        </CardTitle>
        <CardDescription>{initial.hint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setSaved(false);
          }}
          rows={8}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          disabled={pending}
        />
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={pending || !dirty}>
            {pending ? 'Salvando...' : 'Salvar'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {saved && <p className="text-sm text-emerald-600">Salvo ✓</p>}
        </div>
      </CardContent>
    </Card>
  );
}
