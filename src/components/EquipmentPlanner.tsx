import { prisma } from "@/lib/db";
import { loadPicks, consolidate, availability, issuesText, ownerWhere, type Owner, type Ev } from "@/lib/inventory";
import { RESERVATION_LABEL } from "@/lib/constants";
import { addPick, removePick, reserveList, releaseList, setListStatus } from "@/app/panel/inventory-actions";

// Lista de equipos de un evento: paquetes completos + equipos sueltos, consolidados, validados y reservables.
export default async function EquipmentPlanner({ owner, ev, returnTo, manage }: { owner: Owner; ev: Ev; returnTo: string; manage: boolean }) {
  const [picks, packages, equipment, reservations] = await Promise.all([
    loadPicks(owner),
    manage ? prisma.techPackage.findMany({ where: { active: true }, include: { items: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    manage ? prisma.equipment.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    prisma.equipmentReservation.findMany({ where: { ...ownerWhere(owner), status: { in: ["RESERVADO", "EN_USO", "DEVUELTO"] } } }),
  ]);

  const lines = consolidate(picks);
  const av = await availability(lines.map((l) => l.equipmentId), ev, owner);
  const reservedQty = (id: string) => reservations.filter((r) => r.equipmentId === id && r.status !== "DEVUELTO").reduce((n, r) => n + r.quantity, 0);
  const statusOf = (id: string) => {
    const r = reservations.filter((x) => x.equipmentId === id);
    if (r.some((x) => x.status === "EN_USO")) return "EN_USO";
    if (r.some((x) => x.status === "RESERVADO")) return "RESERVADO";
    if (r.some((x) => x.status === "DEVUELTO")) return "DEVUELTO";
    return null;
  };

  const short = lines.filter((l) => (av.get(l.equipmentId)?.available ?? 0) < l.needed);
  const hasActiveRes = reservations.some((r) => r.status === "RESERVADO" || r.status === "EN_USO");
  const stale = hasActiveRes && lines.some((l) => reservedQty(l.equipmentId) !== l.needed);
  const hasReserved = reservations.some((r) => r.status === "RESERVADO");
  const hasInUse = reservations.some((r) => r.status === "EN_USO");

  const Hid = () => (
    <>
      <input type="hidden" name="ownerType" value={owner.requestId ? "request" : "service"} />
      <input type="hidden" name="ownerId" value={owner.requestId ?? owner.serviceId} />
      <input type="hidden" name="returnTo" value={returnTo} />
    </>
  );

  return (
    <section className="card space-y-5">
      <div>
        <h2 className="text-xl font-bold">Equipos para el evento</h2>
        <p className="text-sm text-ink/70">Elige paquetes completos y, si hace falta, equipos sueltos. El sistema suma las cantidades y revisa el inventario para esa fecha y horario.</p>
      </div>

      {picks.length > 0 && (
        <ul className="divide-y divide-ink/10 text-sm">
          {picks.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="badge mr-2 bg-fog">{p.package ? "Paquete" : "Equipo"}</span>
                <span className="font-medium">{p.package?.name ?? p.equipment?.name}</span> × {p.quantity}
              </span>
              {manage && (
                <form action={removePick}>
                  <Hid />
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-xs font-medium text-red-700 underline">Quitar</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {manage && (
        <div className="grid gap-3 md:grid-cols-2">
          <form action={addPick} className="space-y-2 rounded-lg border border-ink/10 p-3">
            <Hid />
            <input type="hidden" name="kind" value="package" />
            <p className="font-bold">Agregar un paquete</p>
            <select name="refId" className="input" required defaultValue="">
              <option value="" disabled>Elige un paquete</option>
              {packages.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.items.length} equipos)</option>)}
            </select>
            <div className="flex gap-2">
              <input name="quantity" type="number" min={1} defaultValue={1} className="input w-20" aria-label="Cantidad de paquetes" />
              <button className="btn-dark">Agregar</button>
            </div>
          </form>
          <form action={addPick} className="space-y-2 rounded-lg border border-ink/10 p-3">
            <Hid />
            <input type="hidden" name="kind" value="equipment" />
            <p className="font-bold">Agregar un equipo suelto</p>
            <select name="refId" className="input" required defaultValue="">
              <option value="" disabled>Elige un equipo</option>
              {equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <div className="flex gap-2">
              <input name="quantity" type="number" min={1} defaultValue={1} className="input w-20" aria-label="Cantidad de unidades" />
              <button className="btn-dark">Agregar</button>
            </div>
          </form>
        </div>
      )}

      {lines.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold">Lista final de equipos a llevar</h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead>
                <tr className="border-b border-ink/10 text-xs uppercase tracking-wide text-ink/60">
                  <th className="py-2 pr-3">Equipo</th>
                  <th className="px-2 py-2">Llevar</th>
                  <th className="px-2 py-2">Libres</th>
                  <th className="px-2 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => {
                  const a = av.get(l.equipmentId);
                  const ok = !!a && a.available >= l.needed;
                  const st = statusOf(l.equipmentId);
                  return (
                    <tr key={l.equipmentId} className={`border-b border-ink/5 align-top ${ok ? "" : "bg-amber-50"}`}>
                      <td className="py-2 pr-3">
                        <p className="font-medium">{l.name}</p>
                        <p className="text-xs text-ink/60">{l.sources.join(" + ")}</p>
                      </td>
                      <td className="px-2 py-2 font-bold">{l.needed}</td>
                      <td className="px-2 py-2">{a ? a.available : 0}</td>
                      <td className="px-2 py-2">
                        {ok ? <span className="badge bg-emerald-100 text-emerald-900">Disponible</span> : <span className="badge bg-amber-200 text-amber-950">Faltan {l.needed - (a?.available ?? 0)}</span>}
                        {!ok && a && <p className="mt-1 text-xs text-amber-950">{issuesText(a, l.needed).join("; ") || "No hay unidades libres."}</p>}
                        {st && <p className="mt-1 text-xs text-ink/60">{RESERVATION_LABEL[st]}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {short.length > 0 && (
            <p role="alert" className="rounded-lg bg-amber-100 p-3 text-sm font-medium text-amber-950">
              Atención: {short.length} equipo(s) no alcanzan para esta fecha y horario. Puedes conseguir el faltante (préstamo, mantenimiento terminado) o reservar igualmente.
            </p>
          )}
          {stale && <p className="rounded-lg bg-sky-50 p-3 text-sm">La lista cambió desde la última reserva. Vuelve a reservar para actualizarla.</p>}

          {manage && (
            <div className="flex flex-wrap items-center gap-2">
              <form action={reserveList} className="flex flex-wrap items-center gap-3">
                <Hid />
                {short.length > 0 && (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="force" className="h-4 w-4 accent-[#1800ad]" /> Reservar de todos modos
                  </label>
                )}
                <button className="btn-primary">{hasReserved ? "Actualizar la reserva" : "Reservar estos equipos"}</button>
              </form>
              {hasReserved && (
                <>
                  <form action={setListStatus}><Hid /><input type="hidden" name="to" value="EN_USO" /><button className="btn-dark">Marcar todo en uso</button></form>
                  <form action={releaseList}><Hid /><button className="btn-ghost">Liberar reservas</button></form>
                </>
              )}
              {hasInUse && <form action={setListStatus}><Hid /><input type="hidden" name="to" value="DEVUELTO" /><button className="btn-dark">Marcar todo devuelto</button></form>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
