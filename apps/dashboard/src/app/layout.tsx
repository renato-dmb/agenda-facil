import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'agenda-fácil',
  description: 'Painel do profissional',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
