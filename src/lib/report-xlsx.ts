import ExcelJS from "exceljs";
import { pct } from "./stats";
import { executiveSummary } from "./report-text";
import { STATUS_LABEL, SERVICE_LABEL } from "./constants";
import type { ReportInput } from "./report-pdf";

const FONT = "Arial";
const HEAD_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF031660" } };
const SOFT_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8ECF3" } };

function sheet(wb: ExcelJS.Workbook, name: string, widths: number[]) {
  const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }] });
  widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  return ws;
}

function title(ws: ExcelJS.Worksheet, text: string, sub?: string) {
  const r = ws.addRow([text]);
  r.font = { name: FONT, size: 14, bold: true, color: { argb: "FF031660" } };
  if (sub) ws.addRow([sub]).font = { name: FONT, size: 10, color: { argb: "FF666B78" } };
  ws.addRow([]);
}

function header(ws: ExcelJS.Worksheet, cols: string[]) {
  const r = ws.addRow(cols);
  r.eachCell((c) => {
    c.font = { name: FONT, size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = HEAD_FILL;
    c.alignment = { vertical: "middle", wrapText: true };
  });
  return r;
}

function body(ws: ExcelJS.Worksheet, values: (string | number | ExcelJS.CellFormulaValue)[]) {
  const r = ws.addRow(values);
  r.eachCell({ includeEmpty: true }, (c) => (c.font = { name: FONT, size: 10 }));
  return r;
}

function totalRow(r: ExcelJS.Row) {
  r.eachCell({ includeEmpty: true }, (c) => {
    c.font = { name: FONT, size: 10, bold: true };
    c.fill = SOFT_FILL;
  });
}

const PCT = "0.0%";
const iso = (s: string) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "");

export async function buildXlsx(input: ReportInput): Promise<Uint8Array> {
  const s = input.stats;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Visual Manager";
  wb.created = input.createdAt;

  /* ---- Resumen ---- */
  {
    const ws = sheet(wb, "Resumen", [46, 18, 18]);
    title(ws, `Informe ministerial – ${input.orgName}`, `${s.period.label} (del ${iso(s.period.start)} al ${iso(s.period.end)})`);
    header(ws, ["Indicador", "Valor", ""]);
    const rows: [string, number][] = [
      ["Solicitudes recibidas", s.requests.received],
      ["Servicios en el período", s.services.total],
      ["Servidores activos", s.team.activeServers],
      ["Asignaciones (sin canceladas)", s.team.assignments.total],
      ["Asignaciones confirmadas", s.team.assignments.confirmadas],
      ["Asistencias (presentes)", s.team.attendance.presentes],
      ["Ausencias", s.team.attendance.ausentes],
      ["Unidades en inventario", s.inventory.units],
      ["Préstamos en el período", s.inventory.loansInPeriod],
      ["Novedades técnicas reportadas", s.inventory.issues.reported],
    ];
    const first = ws.rowCount + 1;
    rows.forEach(([k, v]) => body(ws, [k, v]));
    // Tasas calculadas con fórmulas a partir de las filas de arriba
    const rAsig = first + 3, rConf = first + 4, rPres = first + 5, rAus = first + 6;
    const t1 = body(ws, ["Tasa de confirmación", { formula: `IF(B${rAsig}=0,"",B${rConf}/B${rAsig})`, result: (s.team.confirmationRate ?? 0) / 100 }]);
    const t2 = body(ws, ["Tasa de asistencia", { formula: `IF((B${rPres}+B${rAus})=0,"",B${rPres}/(B${rPres}+B${rAus}))`, result: (s.team.attendanceRate ?? 0) / 100 }]);
    t1.getCell(2).numFmt = PCT;
    t2.getCell(2).numFmt = PCT;
    ws.addRow([]);
    ws.addRow(["Resumen ejecutivo"]).font = { name: FONT, size: 11, bold: true };
    for (const para of executiveSummary(s)) {
      const r = ws.addRow([para]);
      ws.mergeCells(r.number, 1, r.number, 3);
      r.getCell(1).alignment = { wrapText: true, vertical: "top" };
      r.getCell(1).font = { name: FONT, size: 10 };
      r.height = Math.max(30, Math.ceil(para.length / 85) * 14);
    }
    ws.addRow([]);
    const note = ws.addRow(["Notas: las cifras de inventario son una foto del momento en que se generó el informe; las demás corresponden al período indicado. Fechas en hora de Colombia."]);
    ws.mergeCells(note.number, 1, note.number, 3);
    note.getCell(1).alignment = { wrapText: true, vertical: "top" };
    note.getCell(1).font = { name: FONT, size: 9, italic: true, color: { argb: "FF666B78" } };
    note.height = 28;
  }

  /* ---- Solicitudes ---- */
  {
    const ws = sheet(wb, "Solicitudes", [34, 40, 18, 16, 14, 14]);
    title(ws, "Solicitudes de apoyo técnico", s.period.label);
    header(ws, ["Estado", "Cantidad", "% del total"]);
    const first = ws.rowCount + 1;
    const keys = Object.keys(STATUS_LABEL);
    const last = first + keys.length - 1;
    const totalAt = last + 1;
    keys.forEach((k, idx) => {
      const r = body(ws, [STATUS_LABEL[k], s.requests.byStatus[k] ?? 0, { formula: `IF($B$${totalAt}=0,0,B${first + idx}/$B$${totalAt})`, result: (pct(s.requests.byStatus[k] ?? 0, s.requests.received) ?? 0) / 100 }]);
      r.getCell(3).numFmt = PCT;
    });
    const tr = body(ws, ["Total recibidas", { formula: `SUM(B${first}:B${last})`, result: s.requests.received }, { formula: `IF(B${totalAt}=0,0,1)`, result: s.requests.received ? 1 : 0 }]);
    tr.getCell(3).numFmt = PCT;
    totalRow(tr);
    ws.addRow([]);
    body(ws, ["Con poca anticipación", s.requests.late]);
    body(ws, ["Anticipación promedio (días)", s.requests.avgDaysAhead ?? "Sin datos"]);
    ws.addRow([]);
    ws.addRow(["Por ministerio"]).font = { name: FONT, size: 11, bold: true };
    header(ws, ["Ministerio", "Solicitudes"]);
    s.requests.byMinistry.forEach((m) => body(ws, [m.name, m.count]));
    ws.addRow([]);
    ws.addRow(["Detalle de solicitudes"]).font = { name: FONT, size: 11, bold: true };
    header(ws, ["Código", "Actividad", "Ministerio", "Fecha del evento", "Estado", "Poca anticipación"]);
    s.requests.list.forEach((r) => body(ws, [r.code, r.activity, r.ministry, iso(r.eventDate), STATUS_LABEL[r.status] ?? r.status, r.late ? "Sí" : "No"]));
  }

  /* ---- Servicios ---- */
  {
    const ws = sheet(wb, "Servicios", [14, 44, 14, 16, 12]);
    title(ws, "Servicios y eventos", s.period.label);
    header(ws, ["Estado", "Cantidad"]);
    const first = ws.rowCount + 1;
    const keys = Object.keys(SERVICE_LABEL);
    keys.forEach((k) => body(ws, [SERVICE_LABEL[k], s.services.byStatus[k] ?? 0]));
    totalRow(body(ws, ["Total", { formula: `SUM(B${first}:B${first + keys.length - 1})`, result: s.services.total }]));
    ws.addRow([]);
    header(ws, ["Fecha", "Servicio", "Horario", "Estado", "Servidores"]);
    s.services.list.forEach((v) => body(ws, [iso(v.date), v.title, `${v.start} - ${v.end}`, SERVICE_LABEL[v.status] ?? v.status, v.servers]));
  }

  /* ---- Servidores ---- */
  {
    const ws = sheet(wb, "Servidores", [34, 12, 13, 12, 12, 15, 15]);
    title(ws, "Participación de los servidores", s.period.label);
    header(ws, ["Servidor", "Asignados", "Confirmados", "Presentes", "Ausentes", "% confirmación", "% asistencia"]);
    const first = ws.rowCount + 1;
    s.team.perServer.forEach((p, idx) => {
      const n = first + idx;
      const r = body(ws, [p.name, p.asignados, p.confirmados, p.presentes, p.ausentes, { formula: `IF(B${n}=0,0,C${n}/B${n})`, result: p.asignados ? p.confirmados / p.asignados : 0 }, { formula: `IF((D${n}+E${n})=0,0,D${n}/(D${n}+E${n}))`, result: p.presentes + p.ausentes ? p.presentes / (p.presentes + p.ausentes) : 0 }]);
      r.getCell(6).numFmt = PCT;
      r.getCell(7).numFmt = PCT;
    });
    const last = first + s.team.perServer.length - 1;
    const n = last + 1;
    const sum = (col: string, v: number) => ({ formula: s.team.perServer.length ? `SUM(${col}${first}:${col}${last})` : "0", result: v });
    const tr = body(ws, [
      "Total",
      sum("B", s.team.perServer.reduce((a, p) => a + p.asignados, 0)),
      sum("C", s.team.perServer.reduce((a, p) => a + p.confirmados, 0)),
      sum("D", s.team.perServer.reduce((a, p) => a + p.presentes, 0)),
      sum("E", s.team.perServer.reduce((a, p) => a + p.ausentes, 0)),
      { formula: `IF(B${n}=0,0,C${n}/B${n})`, result: (s.team.confirmationRate ?? 0) / 100 },
      { formula: `IF((D${n}+E${n})=0,0,D${n}/(D${n}+E${n}))`, result: (s.team.attendanceRate ?? 0) / 100 },
    ]);
    tr.getCell(6).numFmt = PCT;
    tr.getCell(7).numFmt = PCT;
    totalRow(tr);
    ws.addRow([]);
    body(ws, ["Servidores activos", s.team.activeServers]);
    body(ws, ["Integrantes nuevos en el período", s.team.newMembers]);
    body(ws, ["Asignaciones canceladas por el ministerio", s.team.assignments.canceladas]);
    body(ws, ["Asistencia sin registrar", s.team.attendance.sinRegistro]);
  }

  /* ---- Cambios ---- */
  {
    const ws = sheet(wb, "Cambios de turno", [28, 10, 13, 13, 13, 16]);
    title(ws, "Reemplazos, intercambios y emergencias", s.period.label);
    header(ws, ["Tipo", "Total", "Aceptados", "Rechazados", "Pendientes", "% aceptación"]);
    const rows: [string, { total: number; aceptados: number; rechazados: number; pendientes: number }][] = [["Reemplazos", s.changes.replacements], ["Intercambios", s.changes.swaps]];
    rows.forEach(([k, v]) => {
      const n = ws.rowCount + 1;
      const r = body(ws, [k, v.total, v.aceptados, v.rechazados, v.pendientes, { formula: `IF(B${n}=0,0,C${n}/B${n})`, result: v.total ? v.aceptados / v.total : 0 }]);
      r.getCell(6).numFmt = PCT;
    });
    ws.addRow([]);
    header(ws, ["Emergencias", "Total", "Atendidas"]);
    body(ws, ["Reportes de emergencia", s.changes.emergencies.total, s.changes.emergencies.resueltas]);
  }

  /* ---- Inventario ---- */
  {
    const ws = sheet(wb, "Inventario", [40, 14, 14]);
    title(ws, "Inventario y gestión técnica", `Estado al ${input.createdAt.toLocaleDateString("es-CO", { timeZone: "America/Bogota" })} · movimientos de ${s.period.label}`);
    header(ws, ["Estado de las unidades", "Unidades", "% del total"]);
    const first = ws.rowCount + 1;
    const st = s.inventory.states;
    const list: [string, number][] = [["Disponibles", st.disponible], ["En uso", st.enUso], ["Prestadas", st.prestado], ["En mantenimiento", st.mantenimiento], ["Dañadas", st.danado]];
    const last = first + list.length - 1;
    const totalAt = last + 1;
    list.forEach(([k, v], idx) => {
      const r = body(ws, [k, v, { formula: `IF($B$${totalAt}=0,0,B${first + idx}/$B$${totalAt})`, result: s.inventory.units ? v / s.inventory.units : 0 }]);
      r.getCell(3).numFmt = PCT;
    });
    totalRow(body(ws, ["Total de unidades", { formula: `SUM(B${first}:B${last})`, result: list.reduce((a, [, v]) => a + v, 0) }]));
    ws.addRow([]);
    header(ws, ["Movimiento del período", "Valor"]);
    const i = s.inventory;
    body(ws, ["Equipos registrados (referencias)", i.items]);
    body(ws, ["Préstamos realizados", i.loansInPeriod]);
    body(ws, ["Préstamos devueltos", i.loansReturned]);
    body(ws, ["Préstamos vencidos sin devolver (al generar)", i.overdueNow]);
    body(ws, ["Unidades nuevas con daños", i.newDamaged]);
    body(ws, ["Unidades enviadas a mantenimiento", i.sentToMaintenance]);
    body(ws, ["Novedades técnicas reportadas", i.issues.reported]);
    body(ws, ["Novedades técnicas atendidas", i.issues.resolved]);
    ws.addRow([]);
    header(ws, ["Categoría", "Unidades"]);
    i.byCategory.forEach((c) => body(ws, [c.name, c.units]));
  }

  /* ---- Formación ---- */
  if (s.training) {
    const ws = sheet(wb, "Formación", [14, 44, 16, 14]);
    title(ws, "Formación y capacitación", s.period.label);
    header(ws, ["Indicador", "Valor"]);
    body(ws, ["Capacitaciones en el período", s.training.list.length]);
    body(ws, ["Realizadas", s.training.held]);
    body(ws, ["Participaciones", s.training.participants]);
    body(ws, ["Completaron", s.training.completed]);
    const n = ws.rowCount;
    const r = body(ws, ["Tasa de finalización", { formula: `IF(B${n - 1}=0,0,B${n}/B${n - 1})`, result: (s.training.completionRate ?? 0) / 100 }]);
    r.getCell(2).numFmt = PCT;
    ws.addRow([]);
    header(ws, ["Fecha", "Capacitación", "Participantes", "Completaron"]);
    s.training.list.forEach((x) => body(ws, [iso(x.date), x.title, x.participants, x.completed]));
  }

  /* ---- Narrativa ---- */
  {
    const ws = sheet(wb, "Logros y necesidades", [100]);
    title(ws, "Logros, necesidades y observaciones", s.period.label);
    for (const [label, text] of [["Logros del período", input.achievements], ["Necesidades", input.needs], ["Observaciones relevantes", input.observations]] as const) {
      ws.addRow([label]).font = { name: FONT, size: 11, bold: true };
      const t = text?.trim() || "Sin registro.";
      const r = ws.addRow([t]);
      r.getCell(1).alignment = { wrapText: true, vertical: "top" };
      r.getCell(1).font = { name: FONT, size: 10 };
      r.height = Math.max(20, Math.ceil(t.length / 100) * 14 + t.split("\n").length * 4);
      ws.addRow([]);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
