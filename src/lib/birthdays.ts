import { prisma } from "./db";
import { todayBogota, diffDays, toDateOnly, formatShortDate } from "./dates";
import { nextOccurrence } from "./birthday-utils";
import { notifyUsers } from "./notify";

export type Birthday = { id: string; name: string; role: string; month: number; day: number; date: string; daysUntil: number };

// Cumpleaños de los integrantes activos que caen en los próximos `withinDays` días (incluye hoy).
export async function upcomingBirthdays(withinDays: number): Promise<Birthday[]> {
  const today = todayBogota();
  const users = await prisma.user.findMany({
    where: { active: true, birthMonth: { not: null }, birthDay: { not: null } },
    select: { id: true, name: true, role: true, birthMonth: true, birthDay: true },
  });
  return users
    .map((u) => {
      const date = nextOccurrence(u.birthMonth as number, u.birthDay as number, today);
      return { id: u.id, name: u.name, role: u.role, month: u.birthMonth as number, day: u.birthDay as number, date, daysUntil: diffDays(today, date) };
    })
    .filter((b) => b.daysUntil <= withinDays)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name));
}

// Un aviso por coordinador/líder: quién cumple años hoy y quién cumple dentro de `daysBefore` días.
// Cada persona recibe la lista sin su propio nombre. Devuelve cuántos avisos se crearon.
export async function sendBirthdayReminders(daysBefore: number): Promise<number> {
  const list = await upcomingBirthdays(Math.max(daysBefore, 0));
  const today = list.filter((b) => b.daysUntil === 0);
  const soon = daysBefore > 0 ? list.filter((b) => b.daysUntil === daysBefore) : [];
  if (today.length === 0 && soon.length === 0) return 0;

  const staff = await prisma.user.findMany({ where: { active: true, role: { in: ["COORDINADOR", "LIDER"] } }, select: { id: true } });
  let created = 0;
  for (const s of staff) {
    const t = today.filter((b) => b.id !== s.id);
    const o = soon.filter((b) => b.id !== s.id);
    if (t.length === 0 && o.length === 0) continue;
    const lines = ["Cumpleaños del ministerio:"];
    if (t.length) lines.push(`Hoy cumple años: ${t.map((b) => b.name).join(", ")}.`);
    if (o.length) lines.push(`${daysBefore === 1 ? "Mañana" : `En ${daysBefore} días`} (${formatShortDate(toDateOnly(o[0].date))}) cumple años: ${o.map((b) => b.name).join(", ")}.`);
    await notifyUsers([s.id], lines.join("\n"));
    created++;
  }
  return created;
}
