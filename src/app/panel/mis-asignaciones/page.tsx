import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayBogota, toDateOnly, formatDateEs, formatShortDate, formatDateTimeEs } from "@/lib/dates";
import { loadPeople, problemsFor } from "@/lib/scheduling";
import { ASSIGNMENT_LABEL, ASSIGNMENT_STYLE, CHANGE_LABEL, CHANGE_STATUS_LABEL, LOCATION_LABEL } from "@/lib/constants";
import Flash from "@/components/Flash";
import { confirmAssignment, requestReplacement, proposeSwap, respondChange, withdrawChange, reportEmergency } from "../schedule-actions";

export const dynamic = "force-dynamic";

export default async function MisAsignaciones({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  const today = toDateOnly(todayBogota());
  const upcoming = { status: { not: "CANCELADA" as const }, service: { status: "PROGRAMADO" as const, date: { gte: today } } };

  const [mine, incoming, openChanges, others, history, people] = await Promise.all([
    prisma.assignment.findMany({
      where: { userId: s.userId, ...upcoming },
      include: { service: true, area: true, changes: { where: { status: "PENDIENTE" }, include: { targetUser: true } } },
      orderBy: [{ service: { date: "asc" } }, { service: { startTime: "asc" } }],
    }),
    prisma.assignmentChange.findMany({
      where: { targetUserId: s.userId, status: "PENDIENTE", type: { in: ["REEMPLAZO", "INTERCAMBIO"] } },
      include: { requester: true, assignment: { include: { service: true, area: true } }, targetAssignment: { include: { service: true, area: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.assignmentChange.findMany({ where: { status: "PENDIENTE", type: { in: ["REEMPLAZO", "INTERCAMBIO"] } }, select: { assignmentId: true, targetAssignmentId: true } }),
    prisma.assignment.findMany({
      where: { userId: { not: s.userId }, ...upcoming },
      include: { service: true, area: true, user: true },
      orderBy: [{ service: { date: "asc" } }, { service: { startTime: "asc" } }],
    }),
    prisma.assignmentChange.findMany({
      where: { OR: [{ requesterId: s.userId }, { targetUserId: s.userId }] },
      include: { requester: true, targetUser: true, assignment: { include: { service: true, area: true } } },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    loadPeople(),
  ]);

  const busy = new Set<string>();
  for (const c of openChanges) {
    busy.add(c.assignmentId);
    if (c.targetAssignmentId) busy.add(c.targetAssignmentId);
  }
  const me = people.find((p) => p.id === s.userId);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Mis asignaciones</h1>
      <Flash error={searchParams.error} ok={searchParams.ok} />

      {incoming.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Solicitudes de cambio para ti</h2>
          {incoming.map((c) => (
            <div key={c.id} className="card space-y-3 border-lamp text-sm">
              {c.type === "REEMPLAZO" ? (
                <p>
                  <strong>{c.requester.name}</strong> te pide que lo reemplaces en <strong>{c.assignment.area.name}</strong> para “{c.assignment.service.title}”,{" "}
                  {formatDateEs(c.assignment.service.date)}, de {c.assignment.service.startTime} a {c.assignment.service.endTime}.
                </p>
              ) : (
                <p>
                  <strong>{c.requester.name}</strong> propone un intercambio: tú cubrirías <strong>{c.assignment.area.name}</strong> en “{c.assignment.service.title}” (
                  {formatShortDate(c.assignment.service.date)}, {c.assignment.service.startTime}) y {c.requester.name} cubriría tu turno de{" "}
                  <strong>{c.targetAssignment?.area.name}</strong> en “{c.targetAssignment?.service.title}” ({c.targetAssignment ? formatShortDate(c.targetAssignment.service.date) : ""},{" "}
                  {c.targetAssignment?.service.startTime}).
                </p>
              )}
              {c.reason && <p className="text-ink/70">Motivo: {c.reason}</p>}
              <form action={respondChange} className="space-y-2">
                <input type="hidden" name="id" value={c.id} />
                <input name="response" className="input" placeholder="Mensaje (opcional)" />
                <div className="flex flex-wrap gap-2">
                  <button name="decision" value="accept" className="btn-primary">Aceptar</button>
                  <button name="decision" value="reject" className="btn-ghost">Rechazar</button>
                </div>
              </form>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Mis próximos turnos</h2>
        {mine.length === 0 && <p className="card text-sm text-ink/70">No tienes turnos próximos.</p>}
        {mine.map((a) => {
          const open = a.changes.find((c) => c.requesterId === s.userId && c.type !== "EMERGENCIA");
          const isBusy = busy.has(a.id);
          const replacements = people.filter((p) => p.id !== s.userId && problemsFor(p, a.areaId, a.service).length === 0);
          const swaps = me
            ? others.filter(
                (o) =>
                  !busy.has(o.id) &&
                  problemsFor(me, o.areaId, o.service, [a.id]).length === 0 &&
                  (() => {
                    const p = people.find((x) => x.id === o.userId);
                    return !!p && problemsFor(p, a.areaId, a.service, [o.id]).length === 0;
                  })(),
              )
            : [];

          return (
            <div key={a.id} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{a.service.title}</p>
                  <p className="text-sm">{formatDateEs(a.service.date)}, {a.service.startTime} a {a.service.endTime}</p>
                  <p className="text-sm text-ink/70">
                    {a.area.name}{a.functionNote ? ` · ${a.functionNote}` : ""} · {LOCATION_LABEL[a.service.locationType]}{a.service.address ? ` – ${a.service.address}` : ""}
                  </p>
                </div>
                <span className={`badge ${ASSIGNMENT_STYLE[a.status]}`}>{ASSIGNMENT_LABEL[a.status]}</span>
              </div>

              {a.status === "PENDIENTE" && (
                <form action={confirmAssignment}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="btn-primary">Confirmo mi asistencia</button>
                </form>
              )}

              {open ? (
                <div className="rounded-lg bg-fog p-3 text-sm">
                  <p>Esperando respuesta de {open.targetUser?.name ?? "la otra persona"} ({CHANGE_LABEL[open.type].toLowerCase()}). Tu turno sigue a tu nombre hasta que acepte.</p>
                  <form action={withdrawChange} className="mt-2">
                    <input type="hidden" name="id" value={open.id} />
                    <button className="btn-ghost">Retirar la solicitud</button>
                  </form>
                </div>
              ) : isBusy ? (
                <p className="rounded-lg bg-fog p-3 text-sm">Este turno tiene un intercambio esperando respuesta.</p>
              ) : (
                <details className="text-sm">
                  <summary className="cursor-pointer font-medium underline">No puedo asistir</summary>
                  <div className="mt-3 space-y-4">
                    <p className="text-ink/70">No puedes cancelar por tu cuenta: necesitas que otra persona acepte cubrirte. Elige una opción.</p>

                    <form action={requestReplacement} className="space-y-2 rounded-lg border border-ink/10 p-3">
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <p className="font-bold">Buscar un reemplazo</p>
                      {replacements.length === 0 ? (
                        <p className="text-ink/70">Ahora mismo nadie activo cumple el área, la disponibilidad y el horario. Prueba un intercambio o avisa al coordinador.</p>
                      ) : (
                        <>
                          <select name="targetUserId" className="input" required defaultValue="">
                            <option value="" disabled>Elige a quién pedirle el reemplazo</option>
                            {replacements.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <input name="reason" className="input" placeholder="Motivo (opcional)" />
                          <button className="btn-dark">Pedir reemplazo</button>
                        </>
                      )}
                    </form>

                    <form action={proposeSwap} className="space-y-2 rounded-lg border border-ink/10 p-3">
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <p className="font-bold">Proponer un intercambio de turnos</p>
                      {swaps.length === 0 ? (
                        <p className="text-ink/70">No hay turnos compatibles para intercambiar.</p>
                      ) : (
                        <>
                          <select name="targetAssignmentId" className="input" required defaultValue="">
                            <option value="" disabled>Elige el turno que cubrirías tú</option>
                            {swaps.map((o) => (
                              <option key={o.id} value={o.id}>
                                {o.user.name} · {o.area.name} · {o.service.title} ({formatShortDate(o.service.date)} {o.service.startTime})
                              </option>
                            ))}
                          </select>
                          <input name="reason" className="input" placeholder="Motivo (opcional)" />
                          <button className="btn-dark">Proponer intercambio</button>
                        </>
                      )}
                    </form>

                    <form action={reportEmergency} className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <p className="font-bold text-red-900">Emergencia o situación extraordinaria</p>
                      <p className="text-red-900/80">Avisa directamente al coordinador y a los líderes. Ellos decidirán cómo cubrir tu turno.</p>
                      <textarea name="message" rows={2} className="input" placeholder="Cuéntanos qué pasó" required />
                      <button className="btn-danger">Avisar al coordinador</button>
                    </form>
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Historial de cambios</h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink/70">Aún no hay cambios.</p>
        ) : (
          <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-white text-sm">
            {history.map((h) => (
              <li key={h.id} className="p-3">
                <p>
                  <strong>{CHANGE_LABEL[h.type]}</strong> · {h.assignment.area.name} en “{h.assignment.service.title}” ({formatShortDate(h.assignment.service.date)}) ·{" "}
                  {h.requester.name}{h.targetUser ? ` → ${h.targetUser.name}` : ""}
                </p>
                <p className="text-ink/60">{CHANGE_STATUS_LABEL[h.status]} · {formatDateTimeEs(h.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
