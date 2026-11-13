// Funciones puras de cumpleaños (sin base de datos). Solo se guardan día y mes.
export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const pad = (n: number) => String(n).padStart(2, "0");

export function formatBirthday(month: number, day: number): string {
  return `${day} de ${MESES[month - 1]}`;
}

export function parseBirthday(fd: FormData): { month: number | null; day: number | null; error?: string } {
  const m = String(fd.get("birthMonth") ?? "").trim();
  const d = String(fd.get("birthDay") ?? "").trim();
  if (!m && !d) return { month: null, day: null };
  const mo = Number(m);
  const da = Number(d);
  if (!Number.isInteger(mo) || mo < 1 || mo > 12 || !Number.isInteger(da) || da < 1 || da > MAX_DAY[mo - 1]) {
    return { month: null, day: null, error: "Revisa el cumpleaños: elige el mes y escribe un día válido." };
  }
  return { month: mo, day: da };
}

// Próxima fecha (YYYY-MM-DD) en que cae el cumpleaños, desde `today`. El 29 de febrero se celebra el 28 en años no bisiestos.
export function nextOccurrence(month: number, day: number, today: string): string {
  const make = (y: number) => {
    const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return `${y}-${pad(month)}-${pad(month === 2 && day === 29 && !leap ? 28 : day)}`;
  };
  const y = Number(today.slice(0, 4));
  const c = make(y);
  return c >= today ? c : make(y + 1);
}

export function whenText(daysUntil: number): string {
  if (daysUntil === 0) return "Hoy";
  if (daysUntil === 1) return "Mañana";
  return `En ${daysUntil} días`;
}
