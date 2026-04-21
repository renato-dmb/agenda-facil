export default function Home() {
  return (
    <main style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 640 }}>
      <h1>agenda-facil</h1>
      <p>Dashboard em construção. Fase 2.</p>
      <p style={{ color: '#666', fontSize: 14 }}>
        Por enquanto, o onboarding é feito via CLI:
      </p>
      <pre style={{ background: '#f4f4f4', padding: 12, fontSize: 13 }}>
{`pnpm bot:seed
pnpm bot:oauth <slug>
pnpm bot:pair <slug>
pnpm bot:dev`}
      </pre>
    </main>
  );
}
