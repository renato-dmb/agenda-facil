export const metadata = {
  title: 'agenda-facil',
  description: 'Agente de IA para profissionais liberais',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
