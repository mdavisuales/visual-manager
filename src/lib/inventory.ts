import { prisma } from "./db";
import { overlaps } from "./scheduling";
import { todayBogota, toDateOnly } from "./dates";

export type Owner = { requestId?: string; serviceId?: string };
export type Ev = { date: Date; startTime: string; endTime: string };

export const ownerWhere = (o: Owner) => (o.requestId ? { requestId: o.requestId } : { serviceId: o.serviceId });

// "En quién" se guardan las elecciones de un evento: la solicitud si existe; si no, el servicio.
export async function ownerForService(sv: { id: string; requestId: string | null }): Promise<Owner> {
  return sv.requestId ? { requestId: sv.requestId } : { serviceId: sv.id };
}

export async function loadPicks(o: Owner) {
  return prisma.equipmentPick.findMany({
    where: ownerWhere(o),
    include: { package: { include: { items: { include: { equipment: true } } } }, equipment: true },
    orderBy: { createdAt: "asc" },
  });
}

export type Pick = Awaited<ReturnType<typeof loadPicks>>[number];
export type Line = { equipmentId: string; name: string; needed: number; sources: string[] };

// Une paquetes completos y equipos individuales, sumando las cantidades de un mismo equipo.
export function consolidate(picks: Pick[]): Line[] {
  const map = new Map<string, Line>();
  const add = (eqId: string, name: string, qty: number, source: string) => {
    const l = map.get(eqId) ?? { equipmentId: eqId, name, needed: 0, sources: [] };
    l.needed += qty;
    l.sources.push(source);
    map.set(eqId, l);
  };
  for (const p of picks) {
    if (p.package) {
      for (const it of p.package.items) add(it.equipmentId, it.equipment.name, it.quantity * p.quantity, `${p.package.name}${p.quantity > 1 ? ` ×${p.quantity}` : ""}`);
    } else if (p.equipment) {
      add(p.equipment.id, p.equipment.name, p.quantity, "Individual");
    }
  }
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export type Avail = {
  total: number;
  maintenance: number;
  damaged: number;
  onLoan: number;
  reservedOther: number;
  reservedDetail: string[];
  available: number;
  active: boolean;
};

// Cuántas unidades quedan realmente libres para un evento (fecha y horario), sin contar las reservas del propio evento.
export async function availability(ids: string[], ev: Ev, owner: Owner): Promise<Map<string, Avail>> {
  const out = new Map<string, Avail>();
  if (ids.length === 0) return out;
  const today = toDateOnly(todayBogota());
  const evEnd = new Date(ev.date.getTime() + 86399999);

  const [items, loans, reservations] = await Promise.all([
    prisma.equipment.findMany({ where: { id: { in: ids } } }),
    prisma.equipmentLoan.findMany({ where: { equipmentId: { in: ids }, returnedAt: null } }),
    prisma.equipmentReservation.findMany({
      where: {
        equipmentId: { in: ids },
        date: ev.date,
        status: { in: ["RESERVADO", "EN_USO"] },
        NOT: owner.requestId ? { requestId: owner.requestId } : { serviceId: owner.serviceId },
      },
      include: { request: true, service: true },
    }),
  ]);

  for (const e of items) {
    // Un préstamo sin devolver sigue ocupando el equipo si ya empezó y aún no vence (o si ya venció y no lo han devuelto)
    const onLoan = loans
      .filter((l) => l.equipmentId === e.id && l.loanedAt <= evEnd && (l.expectedReturn >= ev.date || l.expectedReturn < today))
      .reduce((n, l) => n + l.quantity, 0);
    const res = reservations.filter((r) => r.equipmentId === e.id && overlaps(r.startTime, r.endTime, ev.startTime, ev.endTime));
    const reservedOther = res.reduce((n, r) => n + r.quantity, 0);
    out.set(e.id, {
      total: e.quantity,
      maintenance: e.qtyMaintenance,
      damaged: e.qtyDamaged,
      onLoan,
      reservedOther,
      reservedDetail: res.map((r) => `${r.quantity} para “${r.request?.activityName ?? r.service?.title ?? "otro evento"}”`),
      available: Math.max(0, e.quantity - e.qtyMaintenance - e.qtyDamaged - onLoan - reservedOther),
      active: e.active,
    });
  }
  return out;
}

export function issuesText(a: Avail, needed: number): string[] {
  const out: string[] = [];
  if (!a.active) out.push("el equipo está desactivado");
  if (a.damaged) out.push(`${a.damaged} dañado(s)`);
  if (a.maintenance) out.push(`${a.maintenance} en mantenimiento`);
  if (a.onLoan) out.push(`${a.onLoan} prestado(s)`);
  if (a.reservedOther) out.push(`reservado(s) ${a.reservedDetail.join(", ")}`);
  if (out.length === 0 && needed > a.total) out.push(`solo hay ${a.total} en el inventario`);
  return out;
}

// Estado actual de las unidades (para el inventario): en uso y prestadas ahora mismo.
export async function currentUsage(ids?: string[]) {
  const [loans, inUse] = await Promise.all([
    prisma.equipmentLoan.groupBy({ by: ["equipmentId"], where: { returnedAt: null, ...(ids ? { equipmentId: { in: ids } } : {}) }, _sum: { quantity: true } }),
    prisma.equipmentReservation.groupBy({ by: ["equipmentId"], where: { status: "EN_USO", ...(ids ? { equipmentId: { in: ids } } : {}) }, _sum: { quantity: true } }),
  ]);
  const map = new Map<string, { loaned: number; inUse: number }>();
  for (const l of loans) map.set(l.equipmentId, { loaned: l._sum.quantity ?? 0, inUse: 0 });
  for (const u of inUse) map.set(u.equipmentId, { ...(map.get(u.equipmentId) ?? { loaned: 0 }), inUse: u._sum.quantity ?? 0 });
  return map;
}

export type StateCounts = { disponible: number; enUso: number; prestado: number; mantenimiento: number; danado: number };

export function stateCounts(e: { quantity: number; qtyMaintenance: number; qtyDamaged: number }, u?: { loaned: number; inUse: number }): StateCounts {
  const prestado = u?.loaned ?? 0;
  const enUso = u?.inUse ?? 0;
  const disponible = Math.max(0, e.quantity - e.qtyMaintenance - e.qtyDamaged - prestado - enUso);
  return { disponible, enUso, prestado, mantenimiento: e.qtyMaintenance, danado: e.qtyDamaged };
}

export const STATE_META: { key: keyof StateCounts; label: string; style: string }[] = [
  { key: "disponible", label: "Disponible", style: "bg-emerald-100 text-emerald-900" },
  { key: "enUso", label: "En uso", style: "bg-sky-100 text-sky-900" },
  { key: "prestado", label: "Prestado", style: "bg-violet-100 text-violet-900" },
  { key: "mantenimiento", label: "En mantenimiento", style: "bg-amber-100 text-amber-900" },
  { key: "danado", label: "Dañado", style: "bg-red-100 text-red-900" },
];

export async function logMove(
  equipmentId: string,
  type: string,
  quantity: number,
  note: string | null,
  userId: string | null,
  deltas?: { damaged?: number; maintenance?: number },
) {
  await prisma.equipmentMovement.create({
    data: { equipmentId, type: type as never, quantity, note, userId, damagedDelta: deltas?.damaged ?? 0, maintenanceDelta: deltas?.maintenance ?? 0 },
  });
}

// Cuando cambia la fecha u horario de un evento, sus reservas vigentes lo siguen.
export async function syncReservations(o: Owner, ev: Ev) {
  await prisma.equipmentReservation.updateMany({
    where: { ...ownerWhere(o), status: { in: ["RESERVADO", "EN_USO"] } },
    data: { date: ev.date, startTime: ev.startTime, endTime: ev.endTime },
  });
}

export async function releaseReserved(o: Owner) {
  await prisma.equipmentReservation.updateMany({ where: { ...ownerWhere(o), status: "RESERVADO" }, data: { status: "CANCELADO" } });
}
