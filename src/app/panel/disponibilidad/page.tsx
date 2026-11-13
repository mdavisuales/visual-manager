import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DIAS, formatShortDate, formatDateEs } from "@/lib/dates";
import Flash from "@/components/Flash";
import { addUnavailability, deleteUnavailability } from "../team-actions";

export const dynamic = "force-dynamic";

function TimeFields() {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="allDay" defaultChecked className="h-4 w-4 accent-[#1800ad]" /> Todo el día
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label><span className="label">Desde (si no es todo el día)</span><input name="startTime" type="time" className="input" /></label>
        <label><span className="label">Hasta</span><input name="endTime" type="time" className="input" /></label>
      </div>
    </div>
  );
}

export default async function Disponibilidad({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  const list = await prisma.unavailability.findMany({ where: { userId: s.userId }, orderBy: [{ kind: "asc" }, { date: "asc" }, { weekday: "asc" }] });

  const when = (u: (typeof list)[number]) => (u.allDay ? "todo el día" : `de ${u.startTime} a ${u.endTime}`);

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-3xl font-bold">Mi disponibilidad</h1>
      <p className="text-sm text-ink/70">
        Marca los días y horarios en los que <strong>no puedes servir</strong>. El coordinador y los líderes lo tendrán en cuenta al programar y el sistema
        evitará asignarte en esos momentos.
      </p>
      <Flash error={searchParams.error} ok={searchParams.ok} />

      <form action={addUnavailability} className="card space-y-4">
        <input type="hidden" name="kind" value="UNICA" />
        <h2 className="text-lg font-bold">Un día o varios días seguidos</h2>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Fecha</span><input name="date" type="date" className="input" required /></label>
          <label><span className="label">Hasta (opcional)</span><input name="endDate" type="date" className="input" /></label>
        </div>
        <TimeFields />
        <label className="block"><span className="label">Motivo (opcional)</span><input name="reason" className="input" placeholder="Viaje, estudio, trabajo…" /></label>
        <button className="btn-dark">Agregar</button>
      </form>

      <form action={addUnavailability} className="card space-y-4">
        <input type="hidden" name="kind" value="SEMANAL" />
        <h2 className="text-lg font-bold">Se repite cada semana</h2>
        <label className="block">
          <span className="label">Día de la semana</span>
          <select name="weekday" className="input" defaultValue="1">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{DIAS[d]}</option>)}
          </select>
        </label>
        <TimeFields />
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Desde la fecha (opcional)</span><input name="validFrom" type="date" className="input" /></label>
          <label><span className="label">Hasta la fecha (opcional)</span><input name="validUntil" type="date" className="input" /></label>
        </div>
        <label className="block"><span className="label">Motivo (opcional)</span><input name="reason" className="input" placeholder="Clases, turno de trabajo…" /></label>
        <button className="btn-dark">Agregar</button>
      </form>

      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Lo que ya marcaste</h2>
        {list.length === 0 ? (
          <p className="text-sm text-ink/70">Aún no has marcado ninguna restricción: se asume que estás disponible.</p>
        ) : (
          <ul className="divide-y divide-ink/10 text-sm">
            {list.map((u) => (
              <li key={u.id} className="flex items-center justify-between gap-3 py-2.5">
                <span>
                  {u.kind === "UNICA" && u.date ? (
                    <>
                      <span className="font-medium">
                        {u.endDate ? `${formatShortDate(u.date)} al ${formatShortDate(u.endDate)}` : formatDateEs(u.date)}
                      </span>{" "}
                      · {when(u)}
                    </>
                  ) : (
                    <>
                      <span className="font-medium">Todos los {DIAS[u.weekday ?? 0].toLowerCase()}s</span> · {when(u)}
                      {(u.validFrom || u.validUntil) && (
                        <span className="text-ink/60">
                          {" "}({u.validFrom ? `desde ${formatShortDate(u.validFrom)}` : ""} {u.validUntil ? `hasta ${formatShortDate(u.validUntil)}` : ""})
                        </span>
                      )}
                    </>
                  )}
                  {u.reason && <span className="block text-ink/60">{u.reason}</span>}
                </span>
                <form action={deleteUnavailability}>
                  <input type="hidden" name="id" value={u.id} />
                  <button className="text-xs font-medium text-red-700 underline">Quitar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
