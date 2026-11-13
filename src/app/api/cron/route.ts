import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { todayBogota, toDateOnly, formatShortDate } from "@/lib/dates";
import { generateReminders, bogotaHour } from "@/lib/reminders";
import { dispatchNotifications } from "@/lib/dispatch";
import { notifyStaff } from "@/lib/notify";
import { sendBirthdayReminders } from "@/lib/birthdays";

export const dynamic = "force-dynamic";

// Tarea programada (cada hora). Protegida con CRON_SECRET.
// 1) recordatorios automáticos  2) reintento de envíos  3) aviso diario de préstamos vencidos
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const settings = await getSettings();
  const out: Record<string, unknown> = {};
  const hour = bogotaHour();

  if (settings.auto_reminders === "on" && hour >= (Number(settings.reminder_hour) || 8)) {
    const days = Math.min(Math.max(Number(settings.reminder_days) || 2, 1), 14);
    out.reminders = await generateReminders(days);
  }

  const today = todayBogota();
  if (hour >= 8 && settings.overdue_notice_date !== today) {
    const overdue = await prisma.equipmentLoan.findMany({
      where: { returnedAt: null, expectedReturn: { lt: toDateOnly(today) } },
      include: { equipment: true },
    });
    if (overdue.length > 0) {
      await notifyStaff(
        `Préstamos vencidos sin devolver: ${overdue.map((l) => `${l.quantity} ${l.equipment.name} con ${l.receivedBy} (debía volver el ${formatShortDate(l.expectedReturn)})`).join("; ")}.`,
      );
      out.overdueLoans = overdue.length;
    }
    await prisma.setting.upsert({ where: { key: "overdue_notice_date" }, update: { value: today }, create: { key: "overdue_notice_date", value: today } });
  }

  // Cumpleaños: un aviso al día (después de las 8 a. m.) al coordinador y líderes
  if (settings.birthday_reminders === "on" && hour >= 8 && settings.birthday_notice_date !== today) {
    out.birthdays = await sendBirthdayReminders(Math.min(Math.max(Number(settings.birthday_days) || 0, 0), 14));
    await prisma.setting.upsert({ where: { key: "birthday_notice_date" }, update: { value: today }, create: { key: "birthday_notice_date", value: today } });
  }

  out.dispatch = await dispatchNotifications();
  return NextResponse.json({ ok: true, ...out });
}
