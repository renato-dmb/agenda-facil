'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

type Contact = {
  phone: string | null;
  display_name: string | null;
};

export function NewMessageForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [phone, setPhone] = useState('');
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showSug, setShowSug] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (search.length < 2) {
      setContacts([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(
        `/api/dashboard/whatsapp-contacts?q=${encodeURIComponent(search)}`,
      );
      const data = await res.json();
      if (data.ok) setContacts(data.contacts || []);
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  function pick(c: Contact) {
    setPhone(c.phone || '');
    setSearch(c.display_name || c.phone || '');
    setShowSug(false);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!phone.trim() || !text.trim()) {
      setError('Telefone e mensagem obrigatórios');
      return;
    }
    startTransition(async () => {
      const res = await fetch('/api/dashboard/send-message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), text: text.trim() }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error || 'Falha ao enviar');
        return;
      }
      router.push(`/conversas/${encodeURIComponent(phone.trim())}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={send} className="space-y-4">
          <div className="relative">
            <Label className="text-xs">Buscar contato</Label>
            <Input
              placeholder="Nome ou telefone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setShowSug(true);
              }}
              onFocus={() => setShowSug(true)}
              onBlur={() => setTimeout(() => setShowSug(false), 200)}
              disabled={pending}
            />
            {showSug && contacts.length > 0 && (
              <div className="absolute left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-md border bg-card shadow-sm">
                {contacts.map((c) => (
                  <button
                    type="button"
                    key={c.phone || c.display_name}
                    onClick={() => pick(c)}
                    className="flex w-full flex-col gap-0.5 border-b px-3 py-2 text-left last:border-none hover:bg-muted"
                  >
                    <span className="text-sm font-medium">
                      {c.display_name || '(sem nome)'}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs">Telefone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+55 11 99999-9999"
              disabled={pending}
            />
          </div>

          <div>
            <Label className="text-xs">Mensagem</Label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              disabled={pending}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending || !phone.trim() || !text.trim()}>
              {pending ? 'Enviando...' : 'Enviar'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push('/conversas')}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
