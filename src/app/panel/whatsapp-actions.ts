"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { apiConfigured, sendTemplate } from "@/lib/whatsapp-api";
import { dispatchNotifications } from "@/lib/dispatch";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const enc = encodeURIComponent;
const BACK = "/panel/configuracion/whatsapp";

async function requireCoordinator() {
  const s = await requireSession();
  if (s.role !== "COORDINADOR") redirect("/panel?sinpermiso=1");
}

export async function saveWhatsappSettings(fd: FormData) {
  await requireCoordinator();
  const mode = str(fd, "whatsapp_mode");
  const auto = str(fd, "auto_reminders");
  const days = Number(str(fd, "reminder_days"));
  const hour = Number(str(fd, "reminder_hour"));
  const bOn = str(fd, "birthday_reminders");
  const bDays = Number(str(fd, "birthday_days"));
  if (!["on", "off"].includes(bOn) || !Number.isInteger(bDays) || bDays < 0 || bDays > 14) redirect(`${BACK}?error=${enc("Los días de anticipación del aviso de cumpleaños deben estar entre 0 y 14.")}`);
  if (!["manual", "api"].includes(mode) || !["on", "off"].includes(auto)) redirect(`${BACK}?error=${enc("Valores no válidos.")}`);
  if (!Number.isInteger(days) || days < 1 || days > 14) redirect(`${BACK}?error=${enc("Los días del recordatorio deben estar entre 1 y 14.")}`);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) redirect(`${BACK}?error=${enc("La hora debe estar entre 0 y 23.")}`);
  if (mode === "api" && !apiConfigured()) redirect(`${BACK}?error=${enc("Para usar la API oficial primero configura las variables de entorno (ver la lista de abajo).")}`);

  const values: Record<string, string> = { whatsapp_mode: mode, auto_reminders: auto, reminder_days: String(days), reminder_hour: String(hour), birthday_reminders: bOn, birthday_days: String(bDays) };
  for (const [key, value] of Object.entries(values)) await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  revalidatePath("/panel", "layout");
  redirect(`${BACK}?ok=${enc("Configuración de WhatsApp guardada.")}`);
}

export async function sendTestMessage(fd: FormData) {
  await requireCoordinator();
  if (!apiConfigured()) redirect(`${BACK}?error=${enc("La API no está configurada: faltan variables de entorno.")}`);
  const phone = str(fd, "phone");
  const r = await sendTemplate(phone, ["equipo", "Esto es un mensaje de prueba de Visual Manager."]);
  if (r.ok) redirect(`${BACK}?ok=${enc("Meta aceptó el mensaje de prueba. Si no te llega en un minuto, revisa que la plantilla esté aprobada y que el número sea correcto.")}`);
  redirect(`${BACK}?error=${enc(`No se pudo enviar: ${r.error}`)}`);
}

// Reintenta los avisos que fallaron o que quedaron sin enviar
export async function retryDispatch() {
  const s = await requireSession();
  await requirePermission(s.role, "avisos.gestionar");
  if (!apiConfigured()) redirect(`/panel/avisos?error=${enc("El envío automático no está configurado.")}`);
  await prisma.notification.updateMany({ where: { sent: false, attempts: { gte: 3 } }, data: { attempts: 0 } });
  const r = await dispatchNotifications();
  redirect(`/panel/avisos?ok=${enc(r.attempted ? `Se intentaron ${r.attempted} avisos: ${r.sent} enviados, ${r.failed} con error.` : "No había avisos pendientes por enviar.")}`);
}
