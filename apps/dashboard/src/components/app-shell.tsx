'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Calendar,
  MessageCircle,
  Users,
  UserCog,
  Settings,
  Star,
  Megaphone,
  Clock,
  Search,
  BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV: NavItem[] = [
  { href: '/home', label: 'Início', icon: Home },
  { href: '/buscar', label: 'Buscar', icon: Search },
  { href: '/agendamentos', label: 'Agenda', icon: Calendar },
  { href: '/conversas', label: 'Conversas', icon: MessageCircle },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/reviews', label: 'Avaliações', icon: Star },
  { href: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { href: '/lista-espera', label: 'Espera', icon: Clock },
  { href: '/campanhas', label: 'Campanhas', icon: Megaphone },
  { href: '/contatos', label: 'Contatos', icon: UserCog },
  { href: '/ajustes', label: 'Ajustes', icon: Settings },
];

export function AppShell({
  children,
  tenantName,
  tenantSlug,
}: {
  children: React.ReactNode;
  tenantName: string;
  tenantSlug: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 border-r bg-card p-4 md:flex md:flex-col">
        <div className="mb-8 px-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">agenda-fácil</p>
          <p className="truncate text-base font-semibold">{tenantName}</p>
          <p className="truncate text-xs text-muted-foreground">@{tenantSlug}</p>
        </div>
        <nav className="space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-muted',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex items-center gap-1">
          <Button variant="ghost" className="flex-1 justify-start" onClick={logout}>
            Sair
          </Button>
          <ThemeToggle />
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">agenda-fácil</p>
            <p className="text-sm font-semibold">{tenantName}</p>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={logout}>
              Sair
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 pb-24 md:p-8 md:pb-8">{children}</main>

        {/* Bottom nav (mobile) */}
        <nav className="fixed inset-x-0 bottom-0 flex border-t bg-card md:hidden">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
