import { prisma } from "./db";
import { getSettings } from "./settings";
import { apiConfigured, sendTemplate } from "./whatsapp-api";

// Envía por la API oficial los avisos pendientes. Si el modo es "manual" o la API no está configurada, no hace nada
// (los avisos siguen en la cola para enviarlos con el enlace de WhatsApp). Si un envío falla, el aviso queda en la
// cola manual y se reintenta hasta 3 veces.
export async function dispatchNotifications(ids?: string[]) {
  const settings = await getSettings();
  if (settings.whatsapp_mode !== "api" || !apiConfigured()) return { attempted: 0, sent: 0, failed: 0 };

  const rows = await prisma.notification.findMany({
    where: { sent: false, link: { not: "" }, attempts: { lt: 3 }, ...(ids ? { id: { in: ids } } : {}) },
    include: { user: true },
    orderBy: { createdAt: "asc" },
    take: 25,
  });

  let sent = 0;
  let failed = 0;
  await Promise.all(
    rows.map(async (n) => {
      if (!n.user.phone) return;
      const r = await sendTemplate(n.user.phone, [n.user.name.split(" ")[0], n.message]);
      const now = new Date();
      if (r.ok) {
        sent++;
        await prisma.notification.update({
          where: { id: n.id },
          data: { sent: true, sentAt: now, channel: "api", waMessageId: r.id, apiStatus: "ACCEPTED", apiError: null, attempts: { increment: 1 }, lastAttemptAt: now },
        });
      } else {
        failed++;
        await prisma.notification.update({
          where: { id: n.id },
          data: { apiStatus: "FAILED", apiError: r.error.slice(0, 300), attempts: { increment: 1 }, lastAttemptAt: now },
        });
      }
    }),
  );
  return { attempted: rows.length, sent, failed };
}
