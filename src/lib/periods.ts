import { addDays, todayBogota, monthBounds } from "./dates";

export type PeriodType = "mensual" | "trimestral" | "semestral" | "anual" | "personalizado";
export type Period = { type: PeriodType; start: string; end: string; label: string };

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const pad = (n: number) => String(n).padStart(2, "0");
const longDate = (d: string) => `${Number(d.slice(8))} de ${MESES[Number(d.slice(5, 7)) - 1]} de ${d.slice(0, 4)}`;

type Params = { tipo?: string; anio?: string; mes?: string; trimestre?: string; semestre?: string; desde?: string; hasta?: string };

// Convierte los datos del formulario en un período con fechas de inicio y fin (inclusive).
export function periodFromParams(p: Params): Period {
  const today = todayBogota();
  const y = Number(p.anio) >= 2000 && Number(p.anio) <= 2100 ? Number(p.anio) : Number(today.slice(0, 4));
  const type = (["mensual", "trimestral", "semestral", "anual", "personalizado"].includes(p.tipo ?? "") ? p.tipo : "mensual") as PeriodType;

  if (type === "anual") return { type, start: `${y}-01-01`, end: `${y}-12-31`, label: `Año ${y}` };

  if (type === "semestral") {
    const h = p.semestre === "2" ? 2 : 1;
    return h === 1
      ? { type, start: `${y}-01-01`, end: `${y}-06-30`, label: `Primer semestre de ${y} (enero a junio)` }
      : { type, start: `${y}-07-01`, end: `${y}-12-31`, label: `Segundo semestre de ${y} (julio a diciembre)` };
  }

  if (type === "trimestral") {
    const q = [1, 2, 3, 4].includes(Number(p.trimestre)) ? Number(p.trimestre) : Math.ceil(Number(today.slice(5, 7)) / 3);
    const m1 = (q - 1) * 3 + 1;
    const last = monthBounds(`${y}-${pad(m1 + 2)}-01`).last;
    return { type, start: `${y}-${pad(m1)}-01`, end: last, label: `Trimestre ${q} de ${y} (${MESES[m1 - 1]} a ${MESES[m1 + 1]})` };
  }

  if (type === "personalizado") {
    const ok = (d?: string) => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
    let start = ok(p.desde) ? (p.desde as string) : `${today.slice(0, 7)}-01`;
    let end = ok(p.hasta) ? (p.hasta as string) : today;
    if (end < start) [start, end] = [end, start];
    // Máximo 5 años para no pedirle demasiado a la base de datos
    if (end > addDays(start, 1826)) end = addDays(start, 1826);
    return { type, start, end, label: `Del ${longDate(start)} al ${longDate(end)}` };
  }

  const m = Number(p.mes) >= 1 && Number(p.mes) <= 12 ? Number(p.mes) : Number(today.slice(5, 7));
  const b = monthBounds(`${y}-${pad(m)}-01`);
  return { type: "mensual", start: b.first, end: b.last, label: `${cap(MESES[m - 1])} de ${y}` };
}
