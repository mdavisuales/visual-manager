import { prisma } from "./db";
import { getSettings } from "./settings";
import { currentUsage, stateCounts } from "./inventory";
import { addDays, todayBogota, toDateOnly, isoDay } from "./dates";
import type { Period } from "./periods";

export type Counts = Record<string, number>;

export type Stats = {
  generatedAt: string;
  period: Period;
  requests: {
    received: number;
    byStatus: Counts;
    late: number;
    avgDaysAhead: number | null;
    byMinistry: { name: string; count: number }[];
    list: { code: string; activity: string; ministry: string; eventDate: string; status: string; late: boolean }[];
  };
  services: {
    total: number;
    byStatus: Counts;
    list: { title: string; date: string; start: string; end: string; status: string; servers: number }[];
  };
  team: {
    activeServers: number;
    newMembers: number;
    assignments: { total: number; confirmadas: number; pendientes: number; canceladas: number };
    attendance: { presentes: number; ausentes: number; sinRegistro: number };
    confirmationRate: number | null;
    attendanceRate: number | null;
    perServer: { name: string; asignados: number; confirmados: number; presentes: number; ausentes: number }[];
  };
  changes: {
    replacements: { total: number; aceptados: number; rechazados: number; pendientes: number };
    swaps: { total: number; aceptados: number; rechazados: number; pendientes: number };
    emergencies: { total: number; resueltas: number };
  };
  inventory: {
    items: number;
    units: number;
    states: { disponible: number; enUso: number; prestado: number; mantenimiento: number; danado: number };
    byCategory: { name: string; units: number }[];
    loansInPeriod: number;
    loansReturned: number;
    overdueNow: number;
    newDamaged: number;
    sentToMaintenance: number;
    issues: { reported: number; resolved: number };
  };
  training: null | {
    held: number;
    participants: number;
    completed: number;
    completionRate: number | null;
    list: { title: string; date: string; status: string; participants: number; completed: number }[];
  };
};

export const pct = (a: number, b: number): number | null => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
const tally = (arr: string[]): Counts => arr.reduce<Counts>((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});

// Calcula todas las cifras de un período (fechas inclusive, hora de Colombia).
export async function computeStats(period: Period): Promise<Stats> {
  const settings = await getSettings();
  const startD = toDateOnly(period.start);
  const endD = toDateOnly(period.end);
  const startTs = new Date(`${period.start}T00:00:00-05:00`);
  const endTs = new Date(`${addDays(period.end, 1)}T00:00:00-05:00`); // exclusivo
  const created = { gte: startTs, lt: endTs };

  const [reqs, services, assignments, activeServers, newMembers, changes, equipment, loansOut, loansRet, movements, issues, usage] = await Promise.all([
    prisma.serviceRequest.findMany({ where: { requestDate: created }, orderBy: { eventDate: "asc" } }),
    prisma.service.findMany({
      where: { date: { gte: startD, lte: endD } },
      include: { assignments: { where: { status: { not: "CANCELADA" } }, select: { id: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.assignment.findMany({
      where: { service: { date: { gte: startD, lte: endD }, status: { not: "CANCELADO" } } },
      include: { user: { select: { id: true, name: true } } },
    }),
    prisma.user.count({ where: { role: "SERVIDOR", active: true } }),
    prisma.user.count({ where: { joinDate: { gte: startD, lte: endD } } }),
    prisma.assignmentChange.findMany({ where: { createdAt: created } }),
    prisma.equipment.findMany({ where: { active: true }, include: { category: true } }),
    prisma.equipmentLoan.count({ where: { loanedAt: created } }),
    prisma.equipmentLoan.count({ where: { returnedAt: created } }),
    prisma.equipmentMovement.findMany({ where: { createdAt: created, OR: [{ damagedDelta: { not: 0 } }, { maintenanceDelta: { not: 0 } }] } }),
    prisma.techIssue.findMany({ where: { createdAt: created } }),
    currentUsage(),
  ]);

  // Solicitudes
  const ministries = tally(reqs.map((r) => r.ministry.trim()));
  const requests: Stats["requests"] = {
    received: reqs.length,
    byStatus: tally(reqs.map((r) => r.status)),
    late: reqs.filter((r) => r.late).length,
    avgDaysAhead: reqs.length ? Math.round((reqs.reduce((n, r) => n + r.daysAhead, 0) / reqs.length) * 10) / 10 : null,
    byMinistry: Object.entries(ministries).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 15),
    list: reqs.slice(0, 500).map((r) => ({ code: r.code, activity: r.activityName, ministry: r.ministry, eventDate: isoDay(r.eventDate), status: r.status, late: r.late })),
  };

  // Servicios
  const svc: Stats["services"] = {
    total: services.length,
    byStatus: tally(services.map((s) => s.status)),
    list: services.slice(0, 500).map((s) => ({ title: s.title, date: isoDay(s.date), start: s.startTime, end: s.endTime, status: s.status, servers: s.assignments.length })),
  };

  // Equipo
  const live = assignments.filter((a) => a.status !== "CANCELADA");
  const confirmadas = live.filter((a) => a.status === "CONFIRMADA").length;
  const presentes = live.filter((a) => a.attendance === "PRESENTE").length;
  const ausentes = live.filter((a) => a.attendance === "AUSENTE").length;
  const per = new Map<string, { name: string; asignados: number; confirmados: number; presentes: number; ausentes: number }>();
  for (const a of live) {
    const r = per.get(a.userId) ?? { name: a.user.name, asignados: 0, confirmados: 0, presentes: 0, ausentes: 0 };
    r.asignados++;
    if (a.status === "CONFIRMADA") r.confirmados++;
    if (a.attendance === "PRESENTE") r.presentes++;
    if (a.attendance === "AUSENTE") r.ausentes++;
    per.set(a.userId, r);
  }
  const team: Stats["team"] = {
    activeServers,
    newMembers,
    assignments: { total: live.length, confirmadas, pendientes: live.length - confirmadas, canceladas: assignments.length - live.length },
    attendance: { presentes, ausentes, sinRegistro: live.length - presentes - ausentes },
    confirmationRate: pct(confirmadas, live.length),
    attendanceRate: pct(presentes, presentes + ausentes),
    perServer: Array.from(per.values()).sort((a, b) => b.asignados - a.asignados || a.name.localeCompare(b.name)),
  };

  // Cambios de turno
  const kind = (t: string) => {
    const l = changes.filter((c) => c.type === t);
    return { total: l.length, aceptados: l.filter((c) => c.status === "ACEPTADO").length, rechazados: l.filter((c) => c.status === "RECHAZADO").length, pendientes: l.filter((c) => c.status === "PENDIENTE").length };
  };
  const emerg = changes.filter((c) => c.type === "EMERGENCIA");
  const chg: Stats["changes"] = {
    replacements: kind("REEMPLAZO"),
    swaps: kind("INTERCAMBIO"),
    emergencies: { total: emerg.length, resueltas: emerg.filter((c) => c.status === "RESUELTO").length },
  };

  // Inventario (foto del momento + movimientos del período)
  const states = { disponible: 0, enUso: 0, prestado: 0, mantenimiento: 0, danado: 0 };
  const cat = new Map<string, number>();
  for (const e of equipment) {
    const c = stateCounts(e, usage.get(e.id));
    states.disponible += c.disponible;
    states.enUso += c.enUso;
    states.prestado += c.prestado;
    states.mantenimiento += c.mantenimiento;
    states.danado += c.danado;
    const name = e.category?.name ?? "Sin categoría";
    cat.set(name, (cat.get(name) ?? 0) + e.quantity);
  }
  const overdueNow = await prisma.equipmentLoan.count({ where: { returnedAt: null, expectedReturn: { lt: toDateOnly(todayBogota()) } } });
  const inv: Stats["inventory"] = {
    items: equipment.length,
    units: equipment.reduce((n, e) => n + e.quantity, 0),
    states,
    byCategory: Array.from(cat.entries()).map(([name, units]) => ({ name, units })).sort((a, b) => b.units - a.units),
    loansInPeriod: loansOut,
    loansReturned: loansRet,
    overdueNow,
    newDamaged: movements.reduce((n, m) => n + Math.max(m.damagedDelta, 0), 0),
    sentToMaintenance: movements.reduce((n, m) => n + Math.max(m.maintenanceDelta, 0), 0),
    issues: { reported: issues.length, resolved: issues.filter((i) => i.status === "RESUELTA").length },
  };

  // Formación (solo si el módulo está activo)
  let training: Stats["training"] = null;
  if (settings.training_enabled === "on") {
    const list = await prisma.training.findMany({
      where: { date: { gte: startD, lte: endD }, status: { not: "CANCELADA" } },
      include: { participants: true },
      orderBy: { date: "asc" },
    });
    const parts = list.flatMap((t) => t.participants);
    const completed = parts.filter((p) => p.status === "COMPLETADO").length;
    training = {
      held: list.filter((t) => t.status === "REALIZADA").length,
      participants: parts.length,
      completed,
      completionRate: pct(completed, parts.length),
      list: list.map((t) => ({
        title: t.title,
        date: t.date ? isoDay(t.date) : "",
        status: t.status,
        participants: t.participants.length,
        completed: t.participants.filter((p) => p.status === "COMPLETADO").length,
      })),
    };
  }

  return { generatedAt: new Date().toISOString(), period, requests, services: svc, team, changes: chg, inventory: inv, training };
}
