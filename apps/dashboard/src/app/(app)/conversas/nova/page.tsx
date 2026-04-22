import Link from 'next/link';
import { readSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { NewMessageForm } from './new-form';

export default async function NewMessagePage() {
  const session = await readSession();
  if (!session) redirect('/login');

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/conversas" className="text-sm text-muted-foreground hover:underline">
          ← Conversas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Nova mensagem</h1>
        <p className="text-muted-foreground">
          Envie uma mensagem manual pra qualquer contato do WhatsApp.
        </p>
      </div>

      <NewMessageForm />
    </div>
  );
}
