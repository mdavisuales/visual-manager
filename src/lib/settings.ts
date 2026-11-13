import { prisma } from "./db";

export const DEFAULT_SETTINGS: Record<string, string> = {
  org_name: "Ministerio de Visuales MDA",
  tagline: "Santidad y excelencia",
  min_days: "15",
  ministry_whatsapp: "",
  birthday_reminders: "on", // aviso de cumpleaños al coordinador y líderes
  birthday_days: "3", // además del día del cumpleaños, avisar con tantos días de anticipación
  training_enabled: "off", // módulo de formación (el coordinador lo activa o desactiva)
  whatsapp_mode: "manual", // "manual" (enlaces wa.me) o "api" (API oficial de WhatsApp)
  auto_reminders: "off",
  reminder_days: "2",
  reminder_hour: "8",
  late_warning:
    "Cómo ministerio MDA buscamos el servir con excelencia por lo que nada es improvisado sino organizado y planeado con tiempo para contar con la disponibilidad y disposición del equipo. Por lo tanto, está solicitud debe ser enviada al menos 15 días de anticipación y así asegurar la participación del ministerio. De lo contrario las solicitudes después de este tiempo estarán sujetas a disponibilidad de personal y equipos sin garantizar la cobertura del equipo en el espacio o actividad requerida.",
};

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}
