import { LoginForm } from '@/components/login-form';
import { readSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
  const session = await readSession();
  if (session) redirect('/home');
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <LoginForm />
    </div>
  );
}
