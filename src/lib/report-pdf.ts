import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Stats } from "./stats";
import { pct } from "./stats";
import { executiveSummary } from "./report-text";
import { STATUS_LABEL, SERVICE_LABEL } from "./constants";

export type ReportInput = {
  orgName: string;
  title: string;
  createdAt: Date;
  achievements: string | null;
  needs: string | null;
  observations: string | null;
  stats: Stats;
};

const INK = rgb(0.012, 0.086, 0.376); // #031660
const LAMP = rgb(0.157, 0.282, 0.753); // #2848c0
const GRAY = rgb(0.38, 0.4, 0.46);
const FOG = rgb(0.91, 0.925, 0.953);
const SOFT = rgb(0.8, 0.85, 1);
const WHITE = rgb(1, 1, 1);
const W = 595.28;
const H = 841.89;
const M = 50;

const REPL: Record<string, string> = { "→": "->", "↔": "<->", "“": '"', "”": '"', "‘": "'", "’": "'", "–": "-", "—": "-", "…": "...", "•": "-", "≥": ">=", "≤": "<=", "×": "x", "✓": "" };
// Las fuentes estándar del PDF solo cubren Latin-1 (incluye tildes, ñ, ¿ y ¡): lo demás se reemplaza.
export function safe(s: string): string {
  return s
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[→↔“”‘’–—…•≥≤×✓]/g, (c) => REPL[c] ?? "")
    .replace(/[^\n\x20-\x7E\u00A0-\u00FF]/g, "?");
}

// Cifras, porcentajes y fracciones se alinean a la derecha en las tablas
const numLike = (c: string | number | undefined) => typeof c === "number" || (typeof c === "string" && /^[\d.,\s%/-]+( atendidas)?$/.test(c.trim()) && c.trim() !== "");

const fmtPct = (v: number | null) => (v === null ? "-" : `${String(v).replace(".", ",")} %`);
const longDate = (d: Date) => d.toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "long", year: "numeric" });
const shortISO = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

class Builder {
  doc!: PDFDocument;
  font!: PDFFont;
  bold!: PDFFont;
  page!: PDFPage;
  y = 0;

  static async create() {
    const b = new Builder();
    b.doc = await PDFDocument.create();
    b.font = await b.doc.embedFont(StandardFonts.Helvetica);
    b.bold = await b.doc.embedFont(StandardFonts.HelveticaBold);
    return b;
  }

  newPage() {
    this.page = this.doc.addPage([W, H]);
    this.y = H - M;
  }

  ensure(h: number) {
    if (this.y - h < M + 25) this.newPage();
  }

  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const out: string[] = [];
    for (const para of safe(text).split("\n")) {
      if (para.trim() === "") {
        out.push("");
        continue;
      }
      let line = "";
      for (const word of para.split(" ")) {
        const test = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(test, size) <= width) line = test;
        else {
          if (line) out.push(line);
          line = word;
        }
      }
      out.push(line);
    }
    return out;
  }

  fit(text: string, font: PDFFont, size: number, width: number): string {
    let t = safe(String(text));
    if (font.widthOfTextAtSize(t, size) <= width) return t;
    while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > width) t = t.slice(0, -1);
    return t + "...";
  }

  text(text: string, o: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number; gap?: number } = {}) {
    const size = o.size ?? 10.5;
    const font = o.bold ? this.bold : this.font;
    const x = M + (o.indent ?? 0);
    const lines = this.wrap(text, font, size, W - M - x);
    this.begin(size * 1.45 * Math.min(lines.length, 3) + 4);
    for (const line of lines) {
      this.ensure(size + 4);
      if (line) this.page.drawText(line, { x, y: this.y - size, size, font, color: o.color ?? INK });
      this.y -= size * 1.45;
    }
    this.y -= o.gap ?? 4;
  }

  // Los títulos quedan "pendientes" y se dibujan junto con el contenido que sigue, para que nunca queden solos al final de una página.
  pending: { text: string; level: 1 | 2 } | null = null;

  h1(text: string) {
    if (this.pending) this.begin(30);
    this.pending = { text, level: 1 };
  }

  h2(text: string) {
    if (this.pending) this.begin(30);
    this.pending = { text, level: 2 };
  }

  // Reserva espacio para el título pendiente + `content` puntos de contenido, y dibuja el título.
  begin(content: number) {
    const p = this.pending;
    if (!p) {
      this.ensure(content);
      return;
    }
    this.pending = null;
    this.ensure((p.level === 1 ? 58 : 30) + content);
    if (p.level === 1) {
      this.y -= 14;
      this.page.drawText(safe(p.text), { x: M, y: this.y - 15, size: 16, font: this.bold, color: INK });
      this.y -= 24;
      this.page.drawRectangle({ x: M, y: this.y, width: 44, height: 3, color: LAMP });
      this.y -= 14;
    } else {
      this.y -= 6;
      this.page.drawText(safe(p.text), { x: M, y: this.y - 12, size: 12, font: this.bold, color: INK });
      this.y -= 22;
    }
  }

  bullets(items: string[]) {
    for (const it of items) {
      const lines = this.wrap(it, this.font, 10.5, W - 2 * M - 14);
      this.begin(lines.length * 15 + 4);
      this.page.drawText("-", { x: M + 2, y: this.y - 10.5, size: 10.5, font: this.bold, color: LAMP });
      for (const l of lines) {
        this.page.drawText(l, { x: M + 14, y: this.y - 10.5, size: 10.5, font: this.font, color: INK });
        this.y -= 15;
      }
      this.y -= 3;
    }
  }

  kpis(items: { label: string; value: string }[]) {
    const cols = 3;
    const gap = 10;
    const w = (W - 2 * M - gap * (cols - 1)) / cols;
    for (let i = 0; i < items.length; i += cols) {
      this.begin(58);
      items.slice(i, i + cols).forEach((k, j) => {
        const x = M + j * (w + gap);
        this.page.drawRectangle({ x, y: this.y - 50, width: w, height: 50, color: FOG });
        this.page.drawRectangle({ x, y: this.y - 50, width: 3, height: 50, color: LAMP });
        this.page.drawText(safe(k.value), { x: x + 12, y: this.y - 24, size: 18, font: this.bold, color: INK });
        this.page.drawText(this.fit(k.label, this.font, 8.5, w - 18), { x: x + 12, y: this.y - 40, size: 8.5, font: this.font, color: GRAY });
      });
      this.y -= 60;
    }
    this.y -= 4;
  }

  table(headers: string[], rows: (string | number)[][], widths: number[]) {
    const total = widths.reduce((a, b) => a + b, 0);
    const scale = (W - 2 * M) / total;
    const cw = widths.map((w) => w * scale);
    const rowH = 17;
    const drawHeader = () => {
      this.ensure(rowH * 2);
      this.page.drawRectangle({ x: M, y: this.y - rowH, width: W - 2 * M, height: rowH, color: INK });
      let x = M;
      headers.forEach((h, i) => {
        const txt = this.fit(h, this.bold, 8.5, cw[i] - 8);
        const numeric = numLike(rows[0]?.[i]);
        const tx = numeric ? x + cw[i] - 4 - this.bold.widthOfTextAtSize(txt, 8.5) : x + 4;
        this.page.drawText(txt, { x: tx, y: this.y - 12, size: 8.5, font: this.bold, color: WHITE });
        x += cw[i];
      });
      this.y -= rowH;
    };
    // Una tabla corta no se parte entre páginas; una larga empieza con al menos 4 filas
    this.begin(rows.length <= 14 ? rowH * (rows.length + 1) + 10 : rowH * 5);
    drawHeader();
    rows.forEach((r, ri) => {
      if (this.y - rowH < M + 25) {
        this.newPage();
        drawHeader();
      }
      if (ri % 2 === 0) this.page.drawRectangle({ x: M, y: this.y - rowH, width: W - 2 * M, height: rowH, color: FOG });
      let x = M;
      r.forEach((cell, i) => {
        const isNum = numLike(cell);
        const txt = this.fit(String(cell), this.font, 9, cw[i] - 8);
        const tw = this.font.widthOfTextAtSize(txt, 9);
        this.page.drawText(txt, { x: isNum ? x + cw[i] - 4 - tw : x + 4, y: this.y - 12, size: 9, font: this.font, color: INK });
        x += cw[i];
      });
      this.y -= rowH;
    });
    this.y -= 10;
  }

  // Gráfico de barras horizontales
  bars(title: string, data: { label: string; value: number }[], suffix = "") {
    const items = data.filter((d) => d.label);
    this.h2(title);
    if (items.length === 0 || items.every((d) => d.value === 0)) {
      this.text("Sin datos en el período.", { color: GRAY });
      return;
    }
    this.begin(Math.min(items.length, 6) * 18 + 10);
    const max = Math.max(...items.map((d) => d.value), 1);
    const labelW = 150;
    const barMax = W - 2 * M - labelW - 55;
    for (const d of items) {
      this.ensure(18);
      this.page.drawText(this.fit(d.label, this.font, 9, labelW - 8), { x: M, y: this.y - 11, size: 9, font: this.font, color: INK });
      const w = d.value > 0 ? Math.max(3, (d.value / max) * barMax) : 0;
      this.page.drawRectangle({ x: M + labelW, y: this.y - 12, width: barMax, height: 11, color: FOG });
      if (w) this.page.drawRectangle({ x: M + labelW, y: this.y - 12, width: w, height: 11, color: LAMP });
      this.page.drawText(`${d.value}${suffix}`, { x: M + labelW + barMax + 6, y: this.y - 11, size: 9, font: this.bold, color: INK });
      this.y -= 18;
    }
    this.y -= 8;
  }
}

export async function buildPdf(input: ReportInput): Promise<Uint8Array> {
  const { stats: s } = input;
  const b = await Builder.create();

  /* ---- Portada ---- */
  const cover = b.doc.addPage([W, H]);
  // Degradado de la marca: #031660 -> #2848c0 -> #4d68d4, dibujado con franjas
  const stops: [number, number, number][] = [[3, 22, 96], [40, 72, 192], [77, 104, 212]];
  const bands = 120;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const seg = t < 0.6 ? 0 : 1;
    const u = seg === 0 ? t / 0.6 : (t - 0.6) / 0.4;
    const [a, c] = [stops[seg], stops[seg + 1]];
    const col = rgb((a[0] + (c[0] - a[0]) * u) / 255, (a[1] + (c[1] - a[1]) * u) / 255, (a[2] + (c[2] - a[2]) * u) / 255);
    cover.drawRectangle({ x: 0, y: H - (i + 1) * (H / bands) - 0.5, width: W, height: H / bands + 1, color: col });
  }
  cover.drawRectangle({ x: M, y: H - 330, width: 70, height: 5, color: WHITE });
  cover.drawText("INFORME MINISTERIAL", { x: M, y: H - 300, size: 30, font: b.bold, color: WHITE });
  let cy = H - 372;
  for (const line of b.wrap(input.orgName, b.bold, 20, W - 2 * M)) {
    cover.drawText(line, { x: M, y: cy, size: 20, font: b.bold, color: SOFT });
    cy -= 26;
  }
  cy -= 14;
  cover.drawText("Período reportado", { x: M, y: cy, size: 10, font: b.font, color: SOFT });
  cy -= 20;
  for (const line of b.wrap(s.period.label, b.bold, 15, W - 2 * M)) {
    cover.drawText(line, { x: M, y: cy, size: 15, font: b.bold, color: WHITE });
    cy -= 20;
  }
  cover.drawText(safe(`Del ${shortISO(s.period.start)} al ${shortISO(s.period.end)}`), { x: M, y: cy - 4, size: 10, font: b.font, color: SOFT });
  cover.drawText(safe(`Para presentar a la pastora · Generado el ${longDate(input.createdAt)}`), { x: M, y: 60, size: 9.5, font: b.font, color: SOFT });
  cover.drawText("VISUALES MDA · Visual Manager", { x: M, y: 44, size: 9.5, font: b.bold, color: WHITE });

  /* ---- Resumen ejecutivo ---- */
  b.newPage();
  b.h1("Resumen ejecutivo");
  for (const para of executiveSummary(s)) b.text(para, { gap: 8 });

  b.h2("Cifras clave");
  b.kpis([
    { label: "Solicitudes recibidas", value: String(s.requests.received) },
    { label: "Servicios en el período", value: String(s.services.total) },
    { label: "Asignaciones a servidores", value: String(s.team.assignments.total) },
    { label: "Tasa de confirmación", value: fmtPct(s.team.confirmationRate) },
    { label: "Tasa de asistencia", value: fmtPct(s.team.attendanceRate) },
    { label: "Servidores activos", value: String(s.team.activeServers) },
    { label: "Unidades en inventario", value: String(s.inventory.units) },
    { label: "Préstamos en el período", value: String(s.inventory.loansInPeriod) },
    { label: "Novedades técnicas", value: String(s.inventory.issues.reported) },
  ]);

  /* ---- Solicitudes ---- */
  b.h1("Solicitudes de apoyo técnico");
  const reqRows = Object.keys(STATUS_LABEL).map((k) => ({ label: STATUS_LABEL[k], value: s.requests.byStatus[k] ?? 0 }));
  b.table(["Estado", "Cantidad", "% del total"], [...reqRows.map((r) => [r.label, r.value, fmtPct(pct(r.value, s.requests.received))]), ["Total recibidas", s.requests.received, s.requests.received ? "100 %" : "-"]], [3, 1.4, 1.4]);
  b.bars("Solicitudes por estado", reqRows);
  b.text(
    `Con poca anticipación: ${s.requests.late} solicitudes. Anticipación promedio: ${s.requests.avgDaysAhead === null ? "sin datos" : `${String(s.requests.avgDaysAhead).replace(".", ",")} días`}.`,
    { color: GRAY },
  );
  if (s.requests.byMinistry.length) b.bars("Ministerios que más solicitan apoyo", s.requests.byMinistry.slice(0, 10).map((m) => ({ label: m.name, value: m.count })));

  /* ---- Servicios ---- */
  b.h1("Servicios y eventos");
  b.table(
    ["Estado", "Cantidad"],
    [...Object.keys(SERVICE_LABEL).map((k) => [SERVICE_LABEL[k], s.services.byStatus[k] ?? 0]), ["Total", s.services.total]],
    [3, 1.4],
  );
  if (s.services.list.length) {
    b.h2(`Detalle (primeros ${Math.min(s.services.list.length, 20)})`);
    b.table(["Fecha", "Servicio", "Horario", "Estado", "Servidores"], s.services.list.slice(0, 20).map((v) => [shortISO(v.date), v.title, `${v.start}-${v.end}`, SERVICE_LABEL[v.status] ?? v.status, v.servers]), [1.1, 3.2, 1.3, 1.3, 1.1]);
  }

  /* ---- Equipo ---- */
  b.h1("Participación del equipo");
  const t = s.team;
  b.table(
    ["Indicador", "Valor"],
    [
      ["Servidores activos", t.activeServers],
      ["Integrantes nuevos en el período", t.newMembers],
      ["Asignaciones (sin canceladas)", t.assignments.total],
      ["Asignaciones confirmadas", t.assignments.confirmadas],
      ["Asignaciones por confirmar", t.assignments.pendientes],
      ["Asignaciones canceladas por el ministerio", t.assignments.canceladas],
      ["Asistencias (presentes)", t.attendance.presentes],
      ["Ausencias", t.attendance.ausentes],
      ["Sin registro de asistencia", t.attendance.sinRegistro],
      ["Tasa de confirmación", fmtPct(t.confirmationRate)],
      ["Tasa de asistencia", fmtPct(t.attendanceRate)],
    ],
    [4, 1.6],
  );
  b.bars("Asistencia", [
    { label: "Presentes", value: t.attendance.presentes },
    { label: "Ausentes", value: t.attendance.ausentes },
    { label: "Sin registrar", value: t.attendance.sinRegistro },
  ]);
  if (t.perServer.length) {
    b.h2("Participación por servidor");
    b.table(["Servidor", "Asignados", "Confirmados", "Presentes", "Ausentes"], t.perServer.slice(0, 40).map((p) => [p.name, p.asignados, p.confirmados, p.presentes, p.ausentes]), [3.4, 1.2, 1.3, 1.2, 1.2]);
    b.bars("Servidores con más asignaciones", t.perServer.slice(0, 10).map((p) => ({ label: p.name, value: p.asignados })));
  }

  b.h2("Reemplazos, intercambios y emergencias");
  const c = s.changes;
  b.table(
    ["Tipo", "Total", "Aceptados", "Rechazados", "Pendientes"],
    [
      ["Reemplazos", c.replacements.total, c.replacements.aceptados, c.replacements.rechazados, c.replacements.pendientes],
      ["Intercambios", c.swaps.total, c.swaps.aceptados, c.swaps.rechazados, c.swaps.pendientes],
      ["Emergencias reportadas", c.emergencies.total, `${c.emergencies.resueltas} atendidas`, "", ""],
    ],
    [3, 1, 1.4, 1.4, 1.3],
  );

  /* ---- Inventario ---- */
  b.h1("Inventario y gestión técnica");
  const i = s.inventory;
  b.bars("Estado de las unidades (al generar el informe)", [
    { label: "Disponibles", value: i.states.disponible },
    { label: "En uso", value: i.states.enUso },
    { label: "Prestadas", value: i.states.prestado },
    { label: "En mantenimiento", value: i.states.mantenimiento },
    { label: "Dañadas", value: i.states.danado },
  ]);
  b.table(
    ["Movimiento del período", "Valor"],
    [
      ["Equipos registrados / unidades", `${i.items} / ${i.units}`],
      ["Préstamos realizados", i.loansInPeriod],
      ["Préstamos devueltos", i.loansReturned],
      ["Préstamos vencidos sin devolver (hoy)", i.overdueNow],
      ["Unidades nuevas con daños", i.newDamaged],
      ["Unidades enviadas a mantenimiento", i.sentToMaintenance],
      ["Novedades técnicas reportadas", i.issues.reported],
      ["Novedades técnicas atendidas", i.issues.resolved],
    ],
    [4, 1.6],
  );
  if (i.byCategory.length) b.bars("Unidades por categoría", i.byCategory.slice(0, 10).map((x) => ({ label: x.name, value: x.units })));

  /* ---- Formación ---- */
  if (s.training) {
    b.h1("Formación y capacitación");
    b.table(
      ["Indicador", "Valor"],
      [
        ["Capacitaciones en el período", s.training.list.length],
        ["Capacitaciones realizadas", s.training.held],
        ["Participaciones", s.training.participants],
        ["Participantes que completaron", s.training.completed],
        ["Tasa de finalización", fmtPct(s.training.completionRate)],
      ],
      [4, 1.6],
    );
    if (s.training.list.length)
      b.table(["Fecha", "Capacitación", "Participantes", "Completaron"], s.training.list.slice(0, 20).map((x) => [shortISO(x.date), x.title, x.participants, x.completed]), [1.2, 4, 1.4, 1.4]);
  }

  /* ---- Narrativa ---- */
  b.h1("Logros, necesidades y observaciones");
  b.h2("Logros del período");
  b.text(input.achievements?.trim() || "Sin registro.", { color: input.achievements?.trim() ? INK : GRAY });
  b.h2("Necesidades");
  b.text(input.needs?.trim() || "Sin registro.", { color: input.needs?.trim() ? INK : GRAY });
  b.h2("Observaciones relevantes");
  b.text(input.observations?.trim() || "Sin registro.", { color: input.observations?.trim() ? INK : GRAY });

  /* ---- Pie de página ---- */
  const pages = b.doc.getPages();
  pages.forEach((p, idx) => {
    if (idx === 0) return;
    p.drawLine({ start: { x: M, y: 38 }, end: { x: W - M, y: 38 }, thickness: 0.5, color: FOG });
    p.drawText(safe(`${input.orgName} - ${s.period.label}`).slice(0, 80), { x: M, y: 24, size: 8, font: b.font, color: GRAY });
    const label = `Página ${idx + 1} de ${pages.length}`;
    p.drawText(label, { x: W - M - b.font.widthOfTextAtSize(label, 8), y: 24, size: 8, font: b.font, color: GRAY });
  });

  b.doc.setTitle(safe(input.title));
  b.doc.setAuthor("Visual Manager");
  return b.doc.save();
}
