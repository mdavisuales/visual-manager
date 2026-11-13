import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { can, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatDateEs, formatDateTimeEs } from "@/lib/dates";
import { waLink } from "@/lib/whatsapp";
import { LOCATION_LABEL, STATUS_LABEL, STATUS_STYLE, STATUS_MESSAGE } from "@/lib/constants";
import { updateRequest } from "../../actions";
import { createServiceFromRequest } from "../../schedule-actions";
import EquipmentPlanner from "@/components/EquipmentPlanner";

export const dynamic = "force-dynamic";

export default async function Detalle({ params }: { params: { id: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "solicitudes.ver");
  const r = await prisma.serviceRequest.findUnique({
    where: { id: params.id },
    include: { requirements: { orderBy: { name: "asc" } }, service: true },
  });
  if (!r) notFound();
  const canEdit = await can(s.role, "solicitudes.gestionar");
  const canSchedule = await can(s.role, "programacion.gestionar");
  const seeEquip = await can(s.role, "inventario.ver");
  const manageEquip = await can(s.role, "reservas.gestionar");

  const msg = `Hola ${r.organizerName}, te escribimos del Ministerio de Visuales sobre tu solicitud ${r.code} (${r.activityName}). Estado: ${STATUS_LABEL[r.status]}. ${STATUS_MESSAGE[r.status]}`;

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/panel/solicitudes" className="text-sm underline">← Volver a solicitudes</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">{r.activityName}</h1>
        <span className={`badge ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
      </div>

      {r.late && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          Llegó con {Math.max(r.daysAhead, 0)} días de anticipación. Su atención está sujeta a disponibilidad de personal y equipos.
        </p>
      )}

      <section className="card">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Item k="Código" v={r.code} />
          <Item k="Solicitada" v={formatDateTimeEs(r.requestDate)} />
          <Item k="Ministerio" v={r.ministry} />
          <Item k="Organizador" v={r.organizerName} />
          <Item k="WhatsApp" v={r.whatsapp} />
          <Item k="Asistentes" v={r.attendees?.toString() ?? "No indicado"} />
          <Item k="Fecha del evento" v={formatDateEs(r.eventDate)} />
          <Item k="Horario" v={`${r.startTime} a ${r.endTime}`} />
          <Item k="Lugar" v={LOCATION_LABEL[r.locationType] + (r.address ? ` – ${r.address}` : "")} />
        </dl>
        <h2 className="mb-2 mt-5 font-bold">Requerimientos técnicos</h2>
        {r.requirements.length === 0 ? (
          <p className="text-sm text-ink/70">No marcó ninguno.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {r.requirements.map((q) => (
              <li key={q.id} className="rounded-full bg-fog px-3 py-1 text-sm">{q.name}</li>
            ))}
          </ul>
        )}
        {r.observations && (
          <>
            <h2 className="mb-1 mt-5 font-bold">Observaciones</h2>
            <p className="whitespace-pre-wrap text-sm">{r.observations}</p>
          </>
        )}
      </section>

      <a href={waLink(r.whatsapp, msg)} target="_blank" rel="noopener noreferrer" className="btn-dark">
        Escribir al organizador por WhatsApp
      </a>

      {r.service ? (
        <Link href={`/panel/programacion/${r.service.id}`} className="btn-ghost">Ver el servicio programado</Link>
      ) : (
        canSchedule && (
          <form action={createServiceFromRequest}>
            <input type="hidden" name="requestId" value={r.id} />
            <button className="btn-primary">Programar este servicio y asignar servidores</button>
          </form>
        )
      )}

      {seeEquip && (
        <EquipmentPlanner
          owner={{ requestId: r.id }}
          ev={r.service ? { date: r.service.date, startTime: r.service.startTime, endTime: r.service.endTime } : { date: r.eventDate, startTime: r.startTime, endTime: r.endTime }}
          returnTo={`/panel/solicitudes/${r.id}`}
          manage={manageEquip}
        />
      )}

      {canEdit ? (
        <form action={updateRequest} className="card space-y-4">
          <input type="hidden" name="id" value={r.id} />
          <h2 className="text-lg font-bold">Gestión interna</h2>
          <label className="block">
            <span className="label">Estado</span>
            <select name="status" defaultValue={r.status} className="input">
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">Nota interna (solo la ve el equipo)</span>
            <textarea name="internalNote" rows={3} defaultValue={r.internalNote ?? ""} className="input" />
          </label>
          <button className="btn-primary">Guardar cambios</button>
        </form>
      ) : (
        r.internalNote && <p className="card text-sm">Nota interna: {r.internalNote}</p>
      )}
    </div>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-ink/60">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
