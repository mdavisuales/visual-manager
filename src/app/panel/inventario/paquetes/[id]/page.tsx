import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { can, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import Flash from "@/components/Flash";
import { updatePackage, deletePackage, savePackageItem, removePackageItem } from "../../../inventory-actions";

export const dynamic = "force-dynamic";

export default async function PaqueteDetalle({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "inventario.ver");
  const manage = await can(s.role, "paquetes.gestionar");
  const p = await prisma.techPackage.findUnique({ where: { id: params.id }, include: { items: { include: { equipment: true }, orderBy: { equipment: { name: "asc" } } } } });
  if (!p) notFound();
  const equipment = manage ? await prisma.equipment.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : [];

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/panel/inventario/paquetes" className="text-sm underline">← Volver a los paquetes</Link>
      <h1 className="text-3xl font-bold">{p.name}</h1>
      <Flash error={searchParams.error} ok={searchParams.ok} />
      {p.description && <p className="text-sm text-ink/70">{p.description}</p>}

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Equipos del paquete</h2>
        {p.items.length === 0 && <p className="text-sm text-ink/70">Aún no tiene equipos.</p>}
        <ul className="divide-y divide-ink/10 text-sm">
          {p.items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span className="font-medium">{i.equipment.name}{!i.equipment.active && <span className="text-xs font-normal text-ink/50"> (desactivado)</span>}</span>
              {manage ? (
                <span className="flex items-center gap-3">
                  <form action={savePackageItem} className="flex items-center gap-2">
                    <input type="hidden" name="packageId" value={p.id} />
                    <input type="hidden" name="equipmentId" value={i.equipmentId} />
                    <input name="quantity" type="number" min={1} defaultValue={i.quantity} className="input w-20" aria-label="Cantidad" />
                    <button className="btn-ghost">Cambiar</button>
                  </form>
                  <form action={removePackageItem}>
                    <input type="hidden" name="id" value={i.id} />
                    <button className="text-xs font-medium text-red-700 underline">Quitar</button>
                  </form>
                </span>
              ) : (
                <span>× {i.quantity}</span>
              )}
            </li>
          ))}
        </ul>
        {manage && (
          <form action={savePackageItem} className="grid gap-2 border-t border-ink/10 pt-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
            <input type="hidden" name="packageId" value={p.id} />
            <label>
              <span className="label">Agregar equipo</span>
              <select name="equipmentId" className="input" required defaultValue="">
                <option value="" disabled>Elige un equipo</option>
                {equipment.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.quantity} en inventario)</option>)}
              </select>
            </label>
            <label><span className="label">Cantidad</span><input name="quantity" type="number" min={1} defaultValue={1} className="input w-24" /></label>
            <button className="btn-primary">Agregar</button>
          </form>
        )}
        <p className="text-xs text-ink/60">Si agregas un equipo que ya está en el paquete, se actualiza su cantidad.</p>
      </section>

      {manage && (
        <>
          <form action={updatePackage} className="card space-y-3">
            <input type="hidden" name="id" value={p.id} />
            <h2 className="text-lg font-bold">Datos del paquete</h2>
            <label className="block"><span className="label">Nombre</span><input name="name" defaultValue={p.name} className="input" required /></label>
            <label className="block"><span className="label">Descripción</span><input name="description" defaultValue={p.description ?? ""} className="input" /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} className="h-4 w-4 accent-[#1800ad]" /> Activo (si se desactiva, no se ofrece al armar eventos)</label>
            <button className="btn-dark">Guardar</button>
          </form>
          <form action={deletePackage}>
            <input type="hidden" name="id" value={p.id} />
            <button className="btn-danger">Eliminar el paquete</button>
            <p className="mt-1 text-xs text-ink/60">Se quitará también de las listas de eventos que lo usaban. Si solo quieres dejar de usarlo, desactívalo.</p>
          </form>
        </>
      )}
    </div>
  );
}
