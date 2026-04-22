export function formatPhone(normalized: string | null | undefined) {
  if (!normalized) return '';
  if (normalized.length < 12) return normalized;
  const cc = normalized.slice(0, 2);
  const ddd = normalized.slice(2, 4);
  const num = normalized.slice(4);
  if (num.length === 9) return `+${cc} ${ddd} ${num.slice(0, 5)}-${num.slice(5)}`;
  return `+${cc} ${ddd} ${num.slice(0, 4)}-${num.slice(4)}`;
}

const TZ = 'America/Sao_Paulo';

export function formatDateTime(iso: string | Date | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
}

export function formatDateOnly(iso: string | Date | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: TZ,
  });
}

export function formatTimeOnly(iso: string | Date | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TZ,
  });
}

export function relativeFromNow(iso: string | Date | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d atrás`;
  return formatDateOnly(iso);
}
