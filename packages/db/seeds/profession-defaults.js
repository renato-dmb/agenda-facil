/**
 * Catálogo padrão (serviços + horários) por tipo de profissão.
 *
 * Um tenant criado pelo painel nascia vazio, e quem estava configurando acabava
 * copiando o catálogo de outro tenant — foi assim que uma clínica de estética
 * ganhou "Corte" e "Barba". Aqui fica o ponto de partida de cada profissão, para
 * que `tenants.createNew` entregue um tenant já operável.
 *
 * Preços e durações são PONTO DE PARTIDA — o profissional ajusta em
 * Ajustes → Serviços no dashboard. O que não pode é nascer com serviço de
 * outra profissão.
 *
 * As chaves devem espelhar as opções do <select> de profissão em
 * apps/dashboard/src/app/(app)/admin/admin-client.tsx (há teste garantindo isso).
 */

// Jornadas mais comuns, reaproveitadas pelos catálogos abaixo.
const SEG_A_SEX = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  start_time: '09:00',
  end_time: '18:00',
}));

const TER_A_SAB = [
  { weekday: 2, start_time: '09:00', end_time: '19:00' },
  { weekday: 3, start_time: '09:00', end_time: '19:00' },
  { weekday: 4, start_time: '09:00', end_time: '19:00' },
  { weekday: 5, start_time: '09:00', end_time: '19:00' },
  { weekday: 6, start_time: '09:00', end_time: '18:00' },
];

const CATALOGS = {
  barbearia: {
    services: [
      { name: 'Corte', duration_minutes: 30, price_cents: 5000 },
      { name: 'Barba', duration_minutes: 30, price_cents: 4000 },
      { name: 'Corte + Barba', duration_minutes: 60, price_cents: 8000 },
      { name: 'Sobrancelha', duration_minutes: 15, price_cents: 2000 },
    ],
    businessHours: TER_A_SAB,
  },

  salao: {
    services: [
      { name: 'Corte feminino', duration_minutes: 60, price_cents: 9000 },
      { name: 'Escova', duration_minutes: 45, price_cents: 6000 },
      { name: 'Coloração', duration_minutes: 120, price_cents: 20000 },
      { name: 'Hidratação', duration_minutes: 60, price_cents: 8000 },
      { name: 'Manicure', duration_minutes: 45, price_cents: 5000 },
    ],
    businessHours: TER_A_SAB,
  },

  odonto: {
    services: [
      { name: 'Consulta de avaliação', duration_minutes: 30, price_cents: 15000 },
      { name: 'Limpeza (profilaxia)', duration_minutes: 45, price_cents: 20000 },
      { name: 'Restauração', duration_minutes: 60, price_cents: 30000 },
      { name: 'Clareamento', duration_minutes: 60, price_cents: 60000 },
    ],
    businessHours: SEG_A_SEX,
  },

  psicologia: {
    services: [
      { name: 'Sessão individual', duration_minutes: 50, price_cents: 20000 },
      { name: 'Sessão de casal', duration_minutes: 80, price_cents: 30000 },
      { name: 'Primeira consulta', duration_minutes: 60, price_cents: 20000 },
    ],
    businessHours: SEG_A_SEX,
  },

  estetica: {
    services: [
      { name: 'Limpeza de pele', duration_minutes: 60, price_cents: 15000 },
      { name: 'Design de sobrancelha', duration_minutes: 30, price_cents: 5000 },
      { name: 'Peeling facial', duration_minutes: 45, price_cents: 18000 },
      { name: 'Massagem relaxante', duration_minutes: 60, price_cents: 13000 },
      { name: 'Depilação', duration_minutes: 45, price_cents: 9000 },
    ],
    businessHours: TER_A_SAB,
  },

  personal: {
    services: [
      { name: 'Avaliação física', duration_minutes: 60, price_cents: 15000 },
      { name: 'Treino individual', duration_minutes: 60, price_cents: 10000 },
      { name: 'Treino em dupla', duration_minutes: 60, price_cents: 14000 },
    ],
    businessHours: SEG_A_SEX,
  },

  // Fallback: também atende profissão desconhecida, nula ou ainda não mapeada.
  outro: {
    services: [{ name: 'Atendimento', duration_minutes: 60, price_cents: 0 }],
    businessHours: SEG_A_SEX,
  },
};

const FALLBACK = 'outro';

const PROFESSION_TYPES = Object.freeze(Object.keys(CATALOGS));

function normalize(professionType) {
  return String(professionType ?? '')
    .trim()
    .toLowerCase();
}

/**
 * Catálogo inicial de uma profissão.
 *
 * @param {string} professionType chave da profissão; desconhecida/vazia cai no genérico.
 * @returns {{ services: Array<{name: string, duration_minutes: number, price_cents: number, display_order: number}>,
 *             businessHours: Array<{weekday: number, start_time: string, end_time: string}> }}
 *          Estruturas novas a cada chamada — o chamador pode mutar à vontade.
 */
function defaultsFor(professionType) {
  const catalog = CATALOGS[normalize(professionType)] || CATALOGS[FALLBACK];
  return {
    services: catalog.services.map((s, i) => ({ ...s, display_order: i })),
    businessHours: catalog.businessHours.map((h) => ({ ...h })),
  };
}

module.exports = { defaultsFor, PROFESSION_TYPES };
