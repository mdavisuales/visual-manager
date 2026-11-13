import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { can, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { currentUsage, stateCounts } from "@/lib/inventory";
import InventoryTabs from "@/components/InventoryTabs";
import StateChips from "@/components/StateChips";
import Flash from "@/components/Flash";
import { addCategory, renameCategory, deleteCategory } from "../inventory-actions";

export const dynamic = "force-dynamic";

export default async function Inventario({ searchParams }: { searchParams: { q?: string; cat?: string; estado?: string; ok?: string; error?: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "inventario.ver");
  const manage = await can(s.role, "inventario.gestionar");
  const pkgs = await can(s.role, "paquetes.gestionar");
  const q = (searchParams.q ?? "").trim();

  const [categories, items] = await Promise.all([
    prisma.equipmentCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.equipment.findMany({
      where: {
        ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { brand: { contains: q, mode: "insensitive" } }, { model: { contains: q, mode: "insensitive" } }] } : {}),
        ...(searchParams.cat === "none" ? { categoryId: null } : searchParams.cat ? { categoryId: searchParams.cat } : {}),
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
  ]);
  const usage = await currentUsage();
  const rows = items
    .map((e) => ({ e, c: stateCounts(e, usage.get(e.id)) }))
    .filter(({ c }) => {
      const f = searchParams.estado;
      return !f || (f === "disponible" && c.disponible > 0) || (f === "enUso" && c.enUso > 0) || (f === "prestado" && c.prestado > 0) || (f === "mantenimiento" && c.mantenimiento > 0) || (f === "danado" && c.danado > 0);
    });

  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = categories.find((c) => c.id === r.e.categoryId)?.name ?? "Sin categoría";
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Inventario</h1>
        {manage && <Link href="/panel/inventario/nuevo" className="btn-primary">Registrar equipo</Link>}
      </div>
      <InventoryTabs current="equipos" packages={true} />
      <Flash error={searchParams.error} ok={searchParams.ok} />

      <form className="card flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1"><span className="label">Buscar</span><input name="q" defaultValue={q} className="input" placeholder="Nombre, marca o modelo" /></label>
        <label>
          <span className="label">Categoría</span>
          <select name="cat" defaultValue={searchParams.cat ?? ""} className="input">
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="none">Sin categoría</option>
          </select>
        </label>
        <label>
          <span className="label">Estado</span>
          <select name="estado" defaultValue={searchParams.estado ?? ""} className="input">
            <option value="">Todos</option>
            <option value="disponible">Disponible</option>
            <option value="enUso">En uso</option>
            <option value="prestado">Prestado</option>
            <option value="mantenimiento">En mantenimiento</option>
            <option value="danado">Dañado</option>
          </select>
        </label>
        <button className="btn-dark">Filtrar</button>
      </form>

      {rows.length === 0 && <p className="card text-sm text-ink/70">No hay equipos con este filtro.</p>}
      {Array.from(groups.entries()).map(([cat, list]) => (
        <section key={cat} className="space-y-2">
          <h2 className="font-display text-lg font-bold">{cat}</h2>
          <ul className="space-y-2">
            {list.map(({ e, c }) => (
              <li key={e.id}>
                <Link href={`/panel/inventario/${e.id}`} className={`card block hover:border-ink/40 ${e.active ? "" : "opacity-60"}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{e.name}{!e.active && <span className="ml-2 text-xs font-normal">(desactivado)</span>}</p>
                      <p className="text-sm text-ink/70">{[e.brand, e.model].filter(Boolean).join(" ") || "—"} · {e.location ?? "Sin ubicación"} · {e.quantity} unidad(es)</p>
                    </div>
                    <StateChips counts={c} total={e.quantity} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {manage && (
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">Categorías</h2>
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.id} className="flex flex-wrap items-end gap-2">
                <form action={renameCategory} className="flex flex-1 items-end gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="name" defaultValue={c.name} className="input" aria-label="Nombre de la categoría" required />
                  <button className="btn-ghost">Renombrar</button>
                </form>
                <form action={deleteCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <button className="text-xs font-medium text-red-700 underline">Eliminar</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addCategory} className="flex items-end gap-2 border-t border-ink/10 pt-3">
            <label className="flex-1"><span className="label">Nueva categoría</span><input name="name" className="input" required /></label>
            <button className="btn-primary">Agregar</button>
          </form>
          <p className="text-xs text-ink/60">Al eliminar una categoría, sus equipos quedan “sin categoría”.</p>
        </section>
      )}
    </div>
  );
}
