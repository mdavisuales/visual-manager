import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export type Person = Prisma.UserGetPayload<{
  include: { areas: true; unavailabilities: true; assignments: { include: { service: true } } };
}>;

export type Problem = {
  code: "INACTIVO" | "SIN_AREA" | "NO_DISPONIBLE" | "CONFLICTO";
  message: string;
};

type Svc = { date: Date; startTime: string; endTime: string };

// "HH:MM" se compara como texto sin problema
export const overlaps = (a1: string, a2: string, b1: string, b2: string) => a1 < b2 && b1 < a2;

// Carga de una vez a los servidores activos con sus áreas, indisponibilidades y asignaciones vigentes.
export async function loadPeople(ids?: string[]): Promise<Person[]> {
  const from = new Date(Date.now() - 2 * 86400000);
  return prisma.user.findMany({
    where: { active: true, ...(ids ? { id: { in: ids } } : {}) },
    include: {
      areas: true,
      unavailabilities: true,
      assignments: {
        where: { status: { not: "CANCELADA" }, service: { status: { not: "CANCELADO" }, date: { gte: from } } },
        include: { service: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

// Revisa si una persona puede cubrir un servicio en un área. `ignore` = asignaciones que se van a liberar.
export function problemsFor(p: Person, areaId: string | null, svc: Svc, ignore: string[] = []): Problem[] {
  const out: Problem[] = [];
  if (!p.active) out.push({ code: "INACTIVO", message: "No está activo en el ministerio." });
  if (areaId && !p.areas.some((a) => a.id === areaId))
    out.push({ code: "SIN_AREA", message: "No tiene esta área de servicio en su perfil." });

  const wd = svc.date.getUTCDay();
  for (const u of p.unavailabilities) {
    let hit = false;
    if (u.kind === "UNICA" && u.date) {
      hit = svc.date >= u.date && svc.date <= (u.endDate ?? u.date);
    } else if (u.kind === "SEMANAL" && u.weekday === wd) {
      hit = (!u.validFrom || svc.date >= u.validFrom) && (!u.validUntil || svc.date <= u.validUntil);
    }
    if (hit && (u.allDay || !u.startTime || !u.endTime || overlaps(u.startTime, u.endTime, svc.startTime, svc.endTime))) {
      out.push({ code: "NO_DISPONIBLE", message: `Marcó que no puede servir en ese horario${u.reason ? ` (${u.reason})` : ""}.` });
    }
  }

  for (const a of p.assignments) {
    if (ignore.includes(a.id)) continue;
    if (a.service.date.getTime() === svc.date.getTime() && overlaps(a.service.startTime, a.service.endTime, svc.startTime, svc.endTime)) {
      out.push({
        code: "CONFLICTO",
        message: `Ya tiene asignado "${a.service.title}" de ${a.service.startTime} a ${a.service.endTime}.`,
      });
    }
  }
  return out;
}

export const HARD = ["INACTIVO", "CONFLICTO"];
