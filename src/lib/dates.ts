// Fechas en formato "YYYY-MM-DD". La zona horaria del ministerio es Colombia.
export function todayBogota(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date());
}

export function diffDays(from: string, to: string): number {
  const [a, b, c] = from.split("-").map(Number);
  const [d, e, f] = to.split("-").map(Number);
  return Math.round((Date.UTC(d, e - 1, f) - Date.UTC(a, b - 1, c)) / 86400000);
}

export function toDateOnly(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

// Las fechas de evento se guardan a medianoche UTC; se muestran en UTC para no correrlas de día.
export function formatDateEs(d: Date): string {
  return d.toLocaleDateString("es-CO", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatDateTimeEs(d: Date): string {
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function addDays(s: string, n: number): string {
  const d = toDateOnly(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekdayOf(s: string): number {
  return toDateOnly(s).getUTCDay(); // 0 = domingo
}

export function startOfWeek(s: string): string {
  return addDays(s, -((weekdayOf(s) + 6) % 7)); // semana de lunes a domingo
}

export function monthBounds(s: string): { first: string; last: string } {
  const [y, m] = s.split("-").map(Number);
  const first = `${y}-${String(m).padStart(2, "0")}-01`;
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
  return { first, last };
}

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString("es-CO", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}

export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
