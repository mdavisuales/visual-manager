import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { can, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import InventoryTabs from "@/components/InventoryTabs";
import Flash from "@/components/Flash";
import { createPackage } from "../../inventory-actions";

export const dynamic = "force-dynamic";

export default async function Paquetes({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "inventario.ver");
  const manage = await can(s.role, "paquetes.gestionar");
  const list = await prisma.techPackage.findMany({ include: { items: { include: { equipment: true } } }, orderBy: [{ active: "desc" }, { name: "asc" }] });

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold">Paquetes técnicos</h1>
      <InventoryTabs current="paquetes" packages={true} />
      <Flash error={searchParams.error} ok={searchParams.ok} />
      <p className="text-sm text-ink/70">Un paquete es un conjunto de equipos que se llevan juntos (por ejemplo, “Sonido básico”). Al elegirlo para un evento se agregan todos sus equipos de una vez.</p>

      {list.length === 0 && <p className="card text-sm text-ink/70">Aún no hay paquetes.</p>}
      <ul className="space-y-2">
        {list.map((p) => (
          <li key={p.id}>
            <Link href={`/panel/inventario/paquetes/${p.id}`} className={`card block hover:border-ink/40 ${p.active ? "" : "opacity-60"}`}>
              <p className="font-bold">{p.name}{!p.active && <span className="ml-2 text-xs font-normal">(desactivado)</span>}</p>
              {p.description && <p className="text-sm text-ink/70">{p.description}</p>}
              <p className="mt-1 text-sm">{p.items.length === 0 ? "Sin equipos todavía" : p.items.map((i) => `${i.quantity} ${i.equipment.name}`).join(" · ")}</p>
            </Link>
          </li>
        ))}
      </ul>

      {manage && (
        <form action={createPackage} className="card space-y-3">
          <h2 className="text-lg font-bold">Nuevo paquete</h2>
          <label className="block"><span className="label">Nombre</span><input name="name" className="input" required /></label>
          <label className="block"><span className="label">Descripción (opcional)</span><input name="description" className="input" /></label>
          <button className="btn-primary">Crear paquete</button>
        </form>
      )}
    </div>
  );
}
