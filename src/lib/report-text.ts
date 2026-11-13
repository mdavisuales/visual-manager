import type { Stats } from "./stats";

const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;
const p = (v: number | null) => (v === null ? "sin datos" : `${String(v).replace(".", ",")} %`);

// Resumen ejecutivo automático, escrito con las cifras del período.
export function executiveSummary(s: Stats): string[] {
  const r = s.requests;
  const st = r.byStatus;
  const out: string[] = [];

  out.push(
    r.received === 0
      ? `Durante ${s.period.label} el ministerio no recibió solicitudes de apoyo técnico por el portal.`
      : `Durante ${s.period.label} el ministerio recibió ${n(r.received, "solicitud", "solicitudes")} de apoyo técnico: ${st.APROBADA ?? 0} aprobadas, ${st.EJECUTADA ?? 0} ejecutadas, ${st.RECHAZADA ?? 0} rechazadas, ${st.CANCELADA ?? 0} canceladas y ${(st.PENDIENTE ?? 0) + (st.EN_REVISION ?? 0)} sin resolver.${r.late ? ` ${n(r.late, "llegó", "llegaron")} con menos de la anticipación requerida.` : ""}`,
  );

  const sv = s.services;
  out.push(
    sv.total === 0
      ? "No hubo servicios programados en el período."
      : `Se programaron ${n(sv.total, "servicio", "servicios")}: ${sv.byStatus.REALIZADO ?? 0} realizados, ${sv.byStatus.PROGRAMADO ?? 0} programados y ${sv.byStatus.CANCELADO ?? 0} cancelados.`,
  );

  const t = s.team;
  out.push(
    t.assignments.total === 0
      ? `El equipo cuenta con ${n(t.activeServers, "servidor activo", "servidores activos")}. No hubo asignaciones en el período.`
      : `El equipo cuenta con ${n(t.activeServers, "servidor activo", "servidores activos")} y ${n(t.assignments.total, "asignación", "asignaciones")} en el período, con una tasa de confirmación de ${p(t.confirmationRate)}. De las asistencias registradas, la tasa de asistencia fue ${p(t.attendanceRate)} (${t.attendance.presentes} presentes y ${t.attendance.ausentes} ausentes${t.attendance.sinRegistro ? `; ${t.attendance.sinRegistro} sin registrar` : ""}).`,
  );

  const c = s.changes;
  if (c.replacements.total + c.swaps.total + c.emergencies.total > 0)
    out.push(
      `Se gestionaron ${n(c.replacements.total, "reemplazo", "reemplazos")} (${c.replacements.aceptados} aceptados), ${n(c.swaps.total, "intercambio", "intercambios")} (${c.swaps.aceptados} aceptados) y ${n(c.emergencies.total, "reporte de emergencia", "reportes de emergencia")}.`,
    );

  const i = s.inventory;
  out.push(
    `El inventario registra ${n(i.units, "unidad", "unidades")} en ${n(i.items, "equipo", "equipos")}: ${i.states.disponible} disponibles, ${i.states.enUso} en uso, ${i.states.prestado} prestadas, ${i.states.mantenimiento} en mantenimiento y ${i.states.danado} dañadas. En el período hubo ${n(i.loansInPeriod, "préstamo", "préstamos")}, ${i.newDamaged} unidades nuevas con daños y ${i.sentToMaintenance} enviadas a mantenimiento${i.overdueNow ? `; hay ${n(i.overdueNow, "préstamo vencido", "préstamos vencidos")} sin devolver` : ""}.`,
  );
  if (i.issues.reported) out.push(`Se reportaron ${n(i.issues.reported, "novedad técnica", "novedades técnicas")}, de las cuales ${i.issues.resolved} ya fueron atendidas.`);

  if (s.training)
    out.push(
      s.training.list.length === 0
        ? "No hubo capacitaciones registradas en el período."
        : `Se registraron ${n(s.training.list.length, "capacitación", "capacitaciones")} (${s.training.held} realizadas) con ${n(s.training.participants, "participación", "participaciones")}; completó el proceso ${p(s.training.completionRate)} de los participantes.`,
    );
  return out;
}
