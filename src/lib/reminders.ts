import { prisma } from "./db";
import { todayBogota, toDateOnly, addDays, formatDateEs } from "./dates";
import { notifyUsers, siteUrl } from "./notify";

// Crea un recordatorio por cada asignación de los próximos `days` días que aún no lo tiene.
export async function generateReminders(days: number): Promise<number> {
  const today = todayBogota();
  const list = await prisma.assignment.findMany({
    where: {
      status: { not: "CANCELADA" },
      reminderAt: null,
      service: { status: "PROGRAMADO", date: { gte: toDateOnly(today), lte: toDateOnly(addDays(today, days)) } },
    },
    include: { service: true, area: true },
  });
  for (const a of list) {
    await notifyUsers(
      [a.userId],
      `Recordatorio: ${a.area.name} en "${a.service.title}", ${formatDateEs(a.service.date)}, de ${a.service.startTime} a ${a.service.endTime}. ${a.status === "PENDIENTE" ? `Aún no la has confirmado: ${siteUrl()}/panel/mis-asignaciones` : ""}`.trim(),
    );
  }
  await prisma.assignment.updateMany({ where: { id: { in: list.map((a) => a.id) } }, data: { reminderAt: new Date() } });
  return list.length;
}

export function bogotaHour(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Bogota", hour: "2-digit", hour12: false }).format(new Date())) % 24;
}
