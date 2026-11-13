import { prisma } from "./db";
import { dispatchNotifications } from "./dispatch";
import { waLink } from "./whatsapp";
import { formatDateEs } from "./dates";
import { LOCATION_LABEL } from "./constants";

type NewRequest = {
  id: string;
  code: string;
  activityName: string;
  ministry: string;
  eventDate: Date;
  startTime: string;
  endTime: string;
  locationType: string;
  late: boolean;
};

// Fase 1: se crean avisos con un enlace wa.me que el equipo abre y envía desde el WhatsApp del ministerio.
// Fase 4 podrá reemplazar este envío manual por uno automático sin tocar el resto del sistema.
export async function notifyNewRequest(r: NewRequest, minDays: number) {
  const recipients = await prisma.user.findMany({
    where: { active: true, role: { in: ["COORDINADOR", "LIDER"] }, phone: { not: null } },
  });
  if (recipients.length === 0) return;

  const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "";
  const lines = [
    `Nueva solicitud de apoyo técnico ${r.code}`,
    `Actividad: ${r.activityName}`,
    `Ministerio: ${r.ministry}`,
    `Fecha: ${formatDateEs(r.eventDate)}, de ${r.startTime} a ${r.endTime}`,
    `Lugar: ${LOCATION_LABEL[r.locationType] ?? r.locationType}`,
  ];
  if (r.late) lines.push(`Atención: llegó con menos de ${minDays} días de anticipación.`);
  if (site) lines.push(`Revísala aquí: ${site}/panel/solicitudes/${r.id}`);
  const message = lines.join("\n");

  const created = await prisma.notification.createManyAndReturn({
    data: recipients.map((u) => ({
      userId: u.id,
      requestId: r.id,
      message,
      link: waLink(u.phone as string, message),
    })),
    select: { id: true },
  });
  await dispatchSafely(created.map((c) => c.id));
}

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "";
export const siteUrl = SITE;

// Crea un aviso para cada persona. Con teléfono: queda en la cola de WhatsApp (enlace wa.me).
// Sin teléfono: solo se ve dentro del panel.
export async function notifyUsers(userIds: string[], message: string) {
  const ids = Array.from(new Set(userIds));
  if (ids.length === 0) return;
  const users = await prisma.user.findMany({ where: { id: { in: ids }, active: true } });
  if (users.length === 0) return;
  const created = await prisma.notification.createManyAndReturn({
    data: users.map((u) => ({
      userId: u.id,
      message,
      link: u.phone ? waLink(u.phone, message) : "",
      sent: !u.phone,
      sentAt: u.phone ? null : new Date(),
    })),
    select: { id: true },
  });
  await dispatchSafely(created.map((c) => c.id));
}

export async function notifyStaff(message: string, excludeUserId?: string) {
  const staff = await prisma.user.findMany({
    where: { active: true, role: { in: ["COORDINADOR", "LIDER"] }, ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
    select: { id: true },
  });
  await notifyUsers(staff.map((s) => s.id), message);
}

// Un fallo del envío automático nunca debe romper la acción principal: el aviso queda en la cola manual.
async function dispatchSafely(ids: string[]) {
  try {
    await dispatchNotifications(ids);
  } catch (err) {
    console.error("Envío automático de WhatsApp falló:", err);
  }
}
