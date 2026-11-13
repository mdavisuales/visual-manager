import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { can, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { currentUsage, stateCounts } from "@/lib/inventory";
import { todayBogota, toDateOnly, formatDateEs, formatDateTimeEs, formatShortDate, isoDay } from "@/lib/dates";
import { MOVEMENT_LABEL, RESERVATION_LABEL } from "@/lib/constants";
import StateChips from "@/components/StateChips";
import Flash from "@/components/Flash";
import { updateEquipment, setEquipmentState, createLoan, returnLoan } from "../../inventory-actions";

export const dynamic = "force-dynamic";

export default async function EquipoDetalle({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "inventario.ver");
  const manage = await can(s.role, "inventario.gestionar");
  const today = toDateOnly(todayBogota());

  const e = await prisma.equipment.findUnique({
    where: { id: params.id },
    include: {
      category: true,
      loans: { include: { authorizedBy: true }, orderBy: { loanedAt: "desc" }, take: 20 },
      movements: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 40 },
      reservations: {
        where: { status: { in: ["RESERVADO", "EN_USO"] }, date: { gte: today } },
        include: { request: true, service: true },
        orderBy: { date: "asc" },
      },
    },
  });
  if (!e) notFound();
  const [categories, staff, usage] = await Promise.all([
    prisma.equipmentCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    manage ? prisma.user.findMany({ where: { active: true, role: { in: ["COORDINADOR", "LIDER"] } }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    currentUsage([params.id]),
  ]);
  const counts = stateCounts(e, usage.get(e.id));
  const open = e.loans.filter((l) => !l.returnedAt);
  const inUseNow = e.reservations.filter((r) => r.status === "EN_USO");

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/panel/inventario" className="text-sm underline">← Volver al inventario</Link>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold">{e.name}</h1>
          <p className="text-sm text-ink/70">{e.category?.name ?? "Sin categoría"} · {[e.brand, e.model].filter(Boolean).join(" ") || "sin marca ni modelo"} · {e.location ?? "sin ubicación"}</p>
        </div>
        <StateChips counts={counts} total={e.quantity} />
      </div>
      <Flash error={searchParams.error} ok={searchParams.ok} />
      {!e.active && <p className="rounded-lg bg-slate-100 p-3 text-sm">Este equipo está desactivado: no aparece al armar listas ni se puede prestar.</p>}
      {e.notes && <p className="card whitespace-pre-wrap text-sm">{e.notes}</p>}

      {inUseNow.length > 0 && (
        <section className="card space-y-1 text-sm">
          <h2 className="text-lg font-bold">En uso ahora</h2>
          {inUseNow.map((r) => (
            <p key={r.id}>
              {r.quantity} unidad(es) en{" "}
              {r.requestId ? <Link className="underline" href={`/panel/solicitudes/${r.requestId}`}>{r.request?.activityName}</Link> : <Link className="underline" href={`/panel/programacion/${r.serviceId}`}>{r.service?.title}</Link>}
              {" "}({formatShortDate(r.date)})
            </p>
          ))}
        </section>
      )}

      {e.reservations.some((r) => r.status === "RESERVADO") && (
        <section className="card space-y-1 text-sm">
          <h2 className="text-lg font-bold">Próximas reservas</h2>
          {e.reservations.filter((r) => r.status === "RESERVADO").map((r) => (
            <p key={r.id}>
              {formatShortDate(r.date)}, {r.startTime} a {r.endTime}: {r.quantity} unidad(es) para{" "}
              {r.requestId ? <Link className="underline" href={`/panel/solicitudes/${r.requestId}`}>{r.request?.activityName}</Link> : <Link className="underline" href={`/panel/programacion/${r.serviceId}`}>{r.service?.title}</Link>}
              {" "}· {RESERVATION_LABEL[r.status]}
            </p>
          ))}
        </section>
      )}

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Préstamos</h2>
        {open.length === 0 && <p className="text-sm text-ink/70">No hay préstamos pendientes de devolución.</p>}
        {open.map((l) => {
          const overdue = l.expectedReturn < today;
          return (
            <div key={l.id} className={`rounded-lg border p-3 text-sm ${overdue ? "border-red-300 bg-red-50" : "border-ink/10"}`}>
              <p>
                <strong>{l.quantity}</strong> unidad(es) con <strong>{l.receivedBy}</strong> · entregado {formatDateTimeEs(l.loanedAt)} · autorizó {l.authorizedBy.name}
              </p>
              <p className={overdue ? "font-bold text-red-800" : ""}>Devolución prevista: {formatDateEs(l.expectedReturn)}{overdue ? " (vencido)" : ""}</p>
              {l.notes && <p className="text-ink/70">{l.notes}</p>}
              {manage && (
                <form action={returnLoan} className="mt-3 grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-end">
                  <input type="hidden" name="id" value={l.id} />
                  <label><span className="label">Unidades con daños</span><input name="damaged" type="number" min={0} max={l.quantity} defaultValue={0} className="input w-28" /></label>
                  <label><span className="label">Observaciones del estado</span><input name="returnNote" className="input" placeholder="Todo en orden" /></label>
                  <button className="btn-dark">Registrar devolución</button>
                </form>
              )}
            </div>
          );
        })}
        {manage && e.active && (
          <form action={createLoan} className="grid gap-3 border-t border-ink/10 pt-4 sm:grid-cols-2">
            <input type="hidden" name="equipmentId" value={e.id} />
            <h3 className="font-bold sm:col-span-2">Registrar un préstamo</h3>
            <label><span className="label">Quién lo recibe</span><input name="receivedBy" className="input" required /></label>
            <label>
              <span className="label">Quién autoriza</span>
              <select name="authorizedById" defaultValue={s.userId} className="input">
                {staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label><span className="label">Unidades</span><input name="quantity" type="number" min={1} max={e.quantity} defaultValue={1} className="input" required /></label>
            <label><span className="label">Devolución prevista</span><input name="expectedReturn" type="date" min={isoDay(today)} className="input" required /></label>
            <label className="sm:col-span-2"><span className="label">Fecha y hora de entrega (si se deja vacío, es ahora)</span><input name="loanedAt" type="datetime-local" className="input" /></label>
            <label className="sm:col-span-2"><span className="label">Observaciones</span><input name="notes" className="input" /></label>
            <div className="sm:col-span-2"><button className="btn-primary">Registrar préstamo</button></div>
          </form>
        )}
      </section>

      {manage && (
        <>
          <form action={setEquipmentState} className="card space-y-3">
            <input type="hidden" name="id" value={e.id} />
            <h2 className="text-lg font-bold">Mantenimiento y daños</h2>
            <p className="text-sm text-ink/70">Cuántas de las {e.quantity} unidades están hoy fuera de servicio. Los préstamos y el uso en eventos se calculan solos.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="label">En mantenimiento</span><input name="qtyMaintenance" type="number" min={0} max={e.quantity} defaultValue={e.qtyMaintenance} className="input" /></label>
              <label><span className="label">Dañadas</span><input name="qtyDamaged" type="number" min={0} max={e.quantity} defaultValue={e.qtyDamaged} className="input" /></label>
            </div>
            <label className="block"><span className="label">Observaciones</span><input name="note" className="input" placeholder="Qué pasó o qué se hizo" /></label>
            <button className="btn-dark">Actualizar estado</button>
          </form>

          <form action={updateEquipment} className="card space-y-4">
            <input type="hidden" name="id" value={e.id} />
            <h2 className="text-lg font-bold">Datos del equipo</h2>
            <label className="block"><span className="label">Nombre</span><input name="name" defaultValue={e.name} className="input" required /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="label">Categoría</span>
                <select name="categoryId" defaultValue={e.categoryId ?? ""} className="input">
                  <option value="">Sin categoría</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label><span className="label">Cantidad de unidades</span><input name="quantity" type="number" min={1} defaultValue={e.quantity} className="input" required /></label>
              <label><span className="label">Marca</span><input name="brand" defaultValue={e.brand ?? ""} className="input" /></label>
              <label><span className="label">Modelo</span><input name="model" defaultValue={e.model ?? ""} className="input" /></label>
            </div>
            <label className="block"><span className="label">Ubicación</span><input name="location" defaultValue={e.location ?? ""} className="input" /></label>
            <label className="block"><span className="label">Observaciones</span><textarea name="notes" rows={3} defaultValue={e.notes ?? ""} className="input" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={e.active} className="h-4 w-4 accent-[#1800ad]" /> Activo (si se desactiva, no se puede usar en listas ni prestar)</label>
            <button className="btn-primary">Guardar</button>
          </form>
        </>
      )}

      <section className="card space-y-2">
        <h2 className="text-lg font-bold">Historial de movimientos</h2>
        <ul className="divide-y divide-ink/10 text-sm">
          {e.movements.map((m) => (
            <li key={m.id} className="py-2">
              <p><strong>{MOVEMENT_LABEL[m.type]}</strong>{m.quantity ? ` · ${m.quantity} u.` : ""} — {m.note}</p>
              <p className="text-xs text-ink/50">{formatDateTimeEs(m.createdAt)}{m.user ? ` · ${m.user.name}` : ""}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
