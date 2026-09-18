import { LoginForm } from '@/components/login-form';
import { resolveSessionTenant } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  // Só manda pro /home se o tenant da sessão ainda existir. Com um cookie
  // órfão (tenant apagado), cair aqui é o fim do caminho: mostra o formulário
  // em vez de devolver pro /home, que devolveria pra cá de novo.
  const ativa = await resolveSessionTenant();
  if (ativa) redirect('/home');
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <LoginForm />
    </div>
  );
}
