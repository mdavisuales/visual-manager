import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import Flash from "@/components/Flash";
import { createEquipment } from "../../inventory-actions";

export const dynamic = "force-dynamic";

export default async function NuevoEquipo({ searchParams }: { searchParams: { error?: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "inventario.gestionar");
  const categories = await prisma.equipmentCategory.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return (
    <div className="max-w-2xl space-y-5">
      <Link href="/panel/inventario" className="text-sm underline">← Volver al inventario</Link>
      <h1 className="text-3xl font-bold">Registrar equipo</h1>
      <Flash error={searchParams.error} />
      <form action={createEquipment} className="card space-y-4">
        <label className="block"><span className="label">Nombre</span><input name="name" className="input" placeholder="Micrófono inalámbrico de mano" required /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Categoría</span>
            <select name="categoryId" className="input" defaultValue="">
              <option value="">Sin categoría</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label><span className="label">Cantidad de unidades</span><input name="quantity" type="number" min={1} defaultValue={1} className="input" required /></label>
          <label><span className="label">Marca</span><input name="brand" className="input" /></label>
          <label><span className="label">Modelo</span><input name="model" className="input" /></label>
        </div>
        <label className="block"><span className="label">Ubicación</span><input name="location" className="input" placeholder="Cuarto técnico, armario 2…" /></label>
        <label className="block"><span className="label">Observaciones</span><textarea name="notes" rows={3} className="input" /></label>
        <button className="btn-primary">Registrar</button>
      </form>
    </div>
  );
}
