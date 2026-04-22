'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2 } from 'lucide-react';
import { formatPhone } from '@/lib/format';

type Contact = { id: string; phone: string; name: string | null };

export function ContactsClient({
  mode,
  initial,
}: {
  mode: 'public' | 'private';
  initial: Contact[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [list, setList] = useState<Contact[]>(initial);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function toggleMode() {
    const next = mode === 'public' ? 'private' : 'public';
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/dashboard/audience-mode', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: next }),
      });
      const data = await res.json();
      if (!data.ok) setError(data.error || 'Falha ao mudar modo');
      else router.refresh();
    });
  }

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 10) {
      setError('Número inválido');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/dashboard/contacts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Falha ao adicionar');
        return;
      }
      setPhone('');
      setName('');
      router.refresh();
    });
  }

  async function removeContact(c: Contact) {
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/dashboard/contacts', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: c.phone }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Falha ao remover');
        return;
      }
      setList((s) => s.filter((x) => x.id !== c.id));
      router.refresh();
    });
  }

  const modeDescription =
    mode === 'public'
      ? 'Bot responde todos os contatos, exceto os listados abaixo.'
      : 'Bot responde APENAS os contatos listados abaixo.';

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Modo de atendimento</span>
            <span className="rounded-full bg-muted px-3 py-1 text-sm">
              {mode === 'public' ? '🌐 Público' : '🔒 Privado'}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{modeDescription}</p>
          <Button variant="outline" onClick={toggleMode} disabled={pending}>
            Mudar para {mode === 'public' ? 'privado' : 'público'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {mode === 'public' ? 'Ignorados' : 'Liberados'} ({list.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={addContact} className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="tel"
              placeholder="+55 11 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={pending}
            />
            <Input
              type="text"
              placeholder="Nome (opcional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={pending}
            />
            <Button type="submit" disabled={pending || !phone.trim()}>
              Adicionar
            </Button>
          </form>
          {error && <p className="text-sm text-destructive">{error}</p>}

          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Lista vazia.</p>
          ) : (
            <ul className="divide-y">
              {list.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{c.name || '(sem nome)'}</p>
                    <p className="text-sm text-muted-foreground">{formatPhone(c.phone)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeContact(c)}
                    disabled={pending}
                    aria-label="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
