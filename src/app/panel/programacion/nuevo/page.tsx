import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { todayBogota, toDateOnly, formatShortDate } from "@/lib/dates";
import { LOCATION_LABEL } from "@/lib/constants";
import Flash from "@/components/Flash";
import { createService, createServiceFromRequest } from "../../schedule-actions";

export const dynamic = "force-dynamic";

export default async function NuevoServicio({ searchParams }: { searchParams: { error?: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "programacion.gestionar");
  const requests = await prisma.serviceRequest.findMany({
    where: { service: null, status: { in: ["PENDIENTE", "EN_REVISION", "APROBADA"] }, eventDate: { gte: toDateOnly(todayBogota()) } },
    orderBy: { eventDate: "asc" },
    take: 20,
  });

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/panel/programacion" className="text-sm underline">← Volver a la programación</Link>
      <h1 className="text-3xl font-bold">Nuevo servicio</h1>
      <Flash error={searchParams.error} />

      {requests.length > 0 && (
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">Programar desde una solicitud</h2>
          <ul className="divide-y divide-ink/10 text-sm">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <span className="block font-medium">{r.activityName}</span>
                  <span className="text-ink/70">{formatShortDate(r.eventDate)}, {r.startTime} a {r.endTime} · {r.ministry}</span>
                </span>
                <form action={createServiceFromRequest}>
                  <input type="hidden" name="requestId" value={r.id} />
                  <button className="btn-dark">Programar</button>
                </form>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink/60">Al programarla, la solicitud queda aprobada.</p>
        </section>
      )}

      <form action={createService} className="card space-y-4">
        <h2 className="text-lg font-bold">O crear uno desde cero</h2>
        <label className="block"><span className="label">Nombre del servicio</span><input name="title" className="input" placeholder="Servicio dominical" required /></label>
        <label className="block"><span className="label">Fecha</span><input name="date" type="date" className="input" required /></label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Hora de inicio</span><input name="startTime" type="time" className="input" required /></label>
          <label><span className="label">Hora de finalización</span><input name="endTime" type="time" className="input" required /></label>
        </div>
        <label className="block">
          <span className="label">Lugar</span>
          <select name="locationType" className="input">
            {Object.entries(LOCATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">Dirección (solo si es fuera de la iglesia)</span><input name="address" className="input" /></label>
        <label className="block"><span className="label">Notas</span><textarea name="notes" rows={3} className="input" /></label>
        <button className="btn-primary">Crear servicio</button>
      </form>
    </div>
  );
}
