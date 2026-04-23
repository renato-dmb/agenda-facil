// Fixture de KB mínima pra Claude ter o que responder em perguntas de dúvida.
module.exports = {
  knowledge: [
    {
      name: 'servicos',
      content:
        '# Serviços\n\nCorte clássico (30 min, R$ 45). Barba simples (20 min, R$ 30). Combo corte+barba (50 min, R$ 65).',
    },
    {
      name: 'politicas',
      content:
        '# Políticas\n\nAtrasos acima de 15 min precisam remarcar. Cancelamento sem custo se avisado com 2h de antecedência.',
    },
  ],
  services: [
    { name: 'Corte clássico', duration_minutes: 30, price_cents: 4500 },
    { name: 'Barba', duration_minutes: 20, price_cents: 3000 },
  ],
  // Seg-sex 9-12 e 14-18
  business_hours: [
    { weekday: 1, start_time: '09:00', end_time: '12:00' },
    { weekday: 1, start_time: '14:00', end_time: '18:00' },
    { weekday: 2, start_time: '09:00', end_time: '12:00' },
    { weekday: 2, start_time: '14:00', end_time: '18:00' },
    { weekday: 3, start_time: '09:00', end_time: '12:00' },
    { weekday: 3, start_time: '14:00', end_time: '18:00' },
    { weekday: 4, start_time: '09:00', end_time: '12:00' },
    { weekday: 4, start_time: '14:00', end_time: '18:00' },
    { weekday: 5, start_time: '09:00', end_time: '12:00' },
    { weekday: 5, start_time: '14:00', end_time: '18:00' },
  ],
};
