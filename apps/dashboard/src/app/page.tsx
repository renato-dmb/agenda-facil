import { redirect } from 'next/navigation';

export default function Root() {
  // Middleware protege rotas — se chegou aqui, está autenticado.
  redirect('/home');
}
