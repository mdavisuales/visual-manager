import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { apiConfigured } from "@/lib/whatsapp-api";
import { formatDateTimeEs } from "@/lib/dates";
import Flash from "@/components/Flash";
import { markNotificationSent } from "../actions";
import { retryDispatch } from "../whatsapp-actions";

export const dynamic = "force-dynamic";

const API_LABEL: Record<string, string> = {
  ACCEPTED: "Enviado a WhatsApp",
  SENT: "Enviado",
  DELIVERED: "Entregado",
  READ: "Leído",
  FAILED: "Falló",
};

export default async function Avisos({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "avisos.gestionar");
  const [pending, recent, settings] = await Promise.all([
    prisma.notification.findMany({ where: { sent: false, link: { not: "" } }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    prisma.notification.findMany({ where: { sent: true, link: { not: "" } }, include: { user: true }, orderBy: { sentAt: "desc" }, take: 15 }),
    getSettings(),
  ]);
  const auto = settings.whatsapp_mode === "api" && apiConfigured();

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold">Avisos de WhatsApp</h1>
      <Flash error={searchParams.error} ok={searchParams.ok} />
      <p className="text-sm text-ink/70">
        {auto
          ? "El envío automático está activo: los avisos salen solos. Aquí solo quedan los que no se pudieron enviar; puedes reintentarlos o enviarlos tú con el botón de WhatsApp."
          : `Toca “Abrir WhatsApp” en el celular o computador donde tengas el WhatsApp del ministerio${settings.ministry_whatsapp ? ` (${settings.ministry_whatsapp})` : ""}: el chat se abre con el mensaje listo. Envíalo y luego marca el aviso como enviado.`}
      </p>
      {auto && pending.length > 0 && (
        <form action={retryDispatch}><button className="btn-dark">Reintentar el envío automático</button></form>
      )}

      {pending.length === 0 ? (
        <p className="card text-sm text-ink/70">No hay avisos pendientes.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((n) => (
            <li key={n.id} className="card space-y-3">
              <p className="font-bold">Para {n.user.name}</p>
              <p className="whitespace-pre-wrap rounded-lg bg-fog p-3 text-sm">{n.message}</p>
              {n.apiError && <p className="rounded-lg bg-red-50 p-2 text-xs text-red-800">No se pudo enviar automáticamente ({n.attempts} intento(s)): {n.apiError}</p>}
              <div className="flex flex-wrap gap-2">
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="btn-primary">Abrir WhatsApp</a>
                <form action={markNotificationSent}>
                  <input type="hidden" name="id" value={n.id} />
                  <button className="btn-ghost">Marcar como enviado</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      {recent.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-bold">Enviados recientemente</h2>
          <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-white text-sm">
            {recent.map((n) => (
              <li key={n.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>
                  {n.user.name}
                  <span className="ml-2 text-xs text-ink/60">{n.channel === "api" ? API_LABEL[n.apiStatus ?? "ACCEPTED"] : "Enviado a mano"}</span>
                </span>
                <span className="text-ink/60">{n.sentAt ? formatDateTimeEs(n.sentAt) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
