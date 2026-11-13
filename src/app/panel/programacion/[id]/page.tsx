import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { can, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { isoDay, formatDateEs, formatDateTimeEs } from "@/lib/dates";
import { loadPeople, problemsFor, HARD } from "@/lib/scheduling";
import { ASSIGNMENT_LABEL, ASSIGNMENT_STYLE, CHANGE_LABEL, CHANGE_STATUS_LABEL, LOCATION_LABEL, SERVICE_LABEL } from "@/lib/constants";
import Flash from "@/components/Flash";
import EquipmentPlanner from "@/components/EquipmentPlanner";
import { updateService, setServiceStatus, assignServer, removeAssignment, setAttendance } from "../../schedule-actions";

export const dynamic = "force-dynamic";

const SHORT: Record<string, string> = { INACTIVO: "inactivo", SIN_AREA: "sin esa área", NO_DISPONIBLE: "no disponible", CONFLICTO: "cruce de horario" };

export default async function ServicioDetalle({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { ok?: string; error?: string; aviso?: string };
}) {
  const s = await requireSession();
  await requirePermission(s.role, "programacion.ver");
  const manage = await can(s.role, "programacion.gestionar");
  const seeEquip = await can(s.role, "inventario.ver");
  const manageEquip = await can(s.role, "reservas.gestionar");

  const sv = await prisma.service.findUnique({
    where: { id: params.id },
    include: {
      request: { include: { requirements: true } },
      assignments: { include: { user: true, area: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!sv) notFound();

  const [areas, people, changes] = await Promise.all([
    prisma.area.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    manage ? loadPeople() : Promise.resolve([]),
    prisma.assignmentChange.findMany({
      where: { assignment: { serviceId: sv.id } },
      include: { requester: true, targetUser: true, assignment: { include: { area: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const active = sv.assignments.filter((a) => a.status !== "CANCELADA");
  const areaList = [...areas];
  for (const a of active) if (!areaList.some((x) => x.id === a.areaId)) areaList.push({ ...a.area });

  return (
    <div className="max-w-3xl space-y-5">
      <Link href={`/panel/programacion?vista=semana&fecha=${isoDay(sv.date)}`} className="text-sm underline">← Volver a la programación</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">{sv.title}</h1>
        <span className="badge bg-fog">{SERVICE_LABEL[sv.status]}</span>
      </div>
      <Flash error={searchParams.error} ok={searchParams.ok} />
      {searchParams.aviso && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-950">{searchParams.aviso}</p>}

      <p className="text-sm">
        {formatDateEs(sv.date)}, {sv.startTime} a {sv.endTime} · {LOCATION_LABEL[sv.locationType]}{sv.address ? ` – ${sv.address}` : ""}
      </p>

      {sv.request && (
        <section className="card space-y-2 text-sm">
          <p>
            Viene de la solicitud{" "}
            <Link className="font-bold underline" href={`/panel/solicitudes/${sv.request.id}`}>{sv.request.code}</Link> · {sv.request.ministry} · {sv.request.organizerName}
          </p>
          {sv.request.requirements.length > 0 && (
            <p>Pidieron: {sv.request.requirements.map((r) => r.name).join(", ")}.</p>
          )}
          {sv.request.late && <p className="font-medium text-amber-900">Llegó con poca anticipación: sujeta a disponibilidad.</p>}
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-bold">Servidores asignados</h2>
        {areaList.map((area) => {
          const here = active.filter((a) => a.areaId === area.id);
          const options = manage
            ? people
                .map((p) => ({ p, problems: problemsFor(p, area.id, sv) }))
                .sort((x, y) => x.problems.length - y.problems.length || x.p.name.localeCompare(y.p.name))
            : [];
          return (
            <div key={area.id} className="card space-y-3">
              <h3 className="font-display text-lg font-bold">{area.name}</h3>
              {here.length === 0 ? (
                <p className="text-sm text-ink/60">Nadie asignado.</p>
              ) : (
                <ul className="divide-y divide-ink/10 text-sm">
                  {here.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        <span className="font-medium">{a.user.name}</span>
                        {a.functionNote && <span className="text-ink/60"> · {a.functionNote}</span>}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className={`badge ${ASSIGNMENT_STYLE[a.status]}`}>{ASSIGNMENT_LABEL[a.status]}</span>
                        {manage ? (
                          <form action={setAttendance} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={a.id} />
                            <select name="attendance" defaultValue={a.attendance ?? ""} className="rounded border border-ink/20 bg-white px-1.5 py-1 text-xs" aria-label="Asistencia">
                              <option value="">Asistencia: sin registrar</option>
                              <option value="PRESENTE">Presente</option>
                              <option value="AUSENTE">Ausente</option>
                            </select>
                            <button className="text-xs font-medium underline">Guardar</button>
                          </form>
                        ) : (
                          a.attendance && <span className="badge bg-fog">{a.attendance === "PRESENTE" ? "Presente" : "Ausente"}</span>
                        )}
                        {manage && (
                          <form action={removeAssignment}>
                            <input type="hidden" name="id" value={a.id} />
                            <button className="text-xs font-medium text-red-700 underline">Quitar</button>
                          </form>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {manage && sv.status === "PROGRAMADO" && (
                <form action={assignServer} className="space-y-2 border-t border-ink/10 pt-3">
                  <input type="hidden" name="serviceId" value={sv.id} />
                  <input type="hidden" name="areaId" value={area.id} />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <select name="userId" className="input" required defaultValue="">
                      <option value="" disabled>Agregar a {area.name}…</option>
                      {options.map(({ p, problems }) => (
                        <option key={p.id} value={p.id} disabled={problems.some((x) => HARD.includes(x.code)) || here.some((h) => h.userId === p.id)}>
                          {p.name}{problems.length ? ` — ${Array.from(new Set(problems.map((x) => SHORT[x.code]))).join(", ")}` : ""}
                        </option>
                      ))}
                    </select>
                    <input name="functionNote" className="input" placeholder="Función (opcional)" />
                  </div>
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" name="override" className="h-4 w-4 accent-[#1800ad]" /> Asignar de todos modos (si no tiene esta área o marcó que no está disponible)
                  </label>
                  <button className="btn-dark">Asignar</button>
                </form>
              )}
            </div>
          );
        })}
      </section>

      {seeEquip && (
        <div className="space-y-2">
          {sv.requestId && (
            <p className="text-sm text-ink/70">
              Los equipos de este servicio se gestionan junto con su solicitud de origen (así no se duplican las reservas).
            </p>
          )}
          <EquipmentPlanner
            owner={sv.requestId ? { requestId: sv.requestId } : { serviceId: sv.id }}
            ev={{ date: sv.date, startTime: sv.startTime, endTime: sv.endTime }}
            returnTo={`/panel/programacion/${sv.id}`}
            manage={manageEquip}
          />
        </div>
      )}

      {manage && (
        <>
          <form action={updateService} className="card space-y-4">
            <input type="hidden" name="id" value={sv.id} />
            <h2 className="text-lg font-bold">Datos del servicio</h2>
            <p className="text-xs text-ink/60">Si cambias fecha, horario o lugar, se avisa a los servidores asignados.</p>
            <label className="block"><span className="label">Nombre</span><input name="title" defaultValue={sv.title} className="input" required /></label>
            <label className="block"><span className="label">Fecha</span><input name="date" type="date" defaultValue={isoDay(sv.date)} className="input" required /></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className="label">Inicio</span><input name="startTime" type="time" defaultValue={sv.startTime} className="input" required /></label>
              <label><span className="label">Fin</span><input name="endTime" type="time" defaultValue={sv.endTime} className="input" required /></label>
            </div>
            <label className="block">
              <span className="label">Lugar</span>
              <select name="locationType" defaultValue={sv.locationType} className="input">
                {Object.entries(LOCATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Dirección (fuera de la iglesia)</span><input name="address" defaultValue={sv.address ?? ""} className="input" /></label>
            <label className="block"><span className="label">Notas</span><textarea name="notes" rows={3} defaultValue={sv.notes ?? ""} className="input" /></label>
            <button className="btn-primary">Guardar cambios</button>
          </form>

          <form action={setServiceStatus} className="card flex flex-wrap items-end gap-3">
            <input type="hidden" name="id" value={sv.id} />
            <label>
              <span className="label">Estado del servicio</span>
              <select name="status" defaultValue={sv.status} className="input">
                {Object.entries(SERVICE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <button className="btn-dark">Cambiar estado</button>
            <p className="basis-full text-xs text-ink/60">Cancelar avisa a todos los asignados. Marcar como realizado deja ejecutada la solicitud de origen.</p>
          </form>
        </>
      )}

      {sv.notes && !manage && <p className="card whitespace-pre-wrap text-sm">{sv.notes}</p>}

      {changes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-bold">Historial de cambios</h2>
          <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-white text-sm">
            {changes.map((c) => (
              <li key={c.id} className="p-3">
                <p>
                  <strong>{CHANGE_LABEL[c.type]}</strong> · {c.assignment.area.name} · {c.requester.name}{c.targetUser ? ` → ${c.targetUser.name}` : ""}
                </p>
                {c.reason && <p className="text-ink/70">Motivo: {c.reason}</p>}
                <p className="text-ink/60">{CHANGE_STATUS_LABEL[c.status]} · {formatDateTimeEs(c.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
