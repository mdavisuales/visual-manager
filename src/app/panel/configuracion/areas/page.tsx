import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Flash from "@/components/Flash";
import { addArea, updateArea, deleteArea, addSkill, updateSkill, deleteSkill } from "../../team-actions";

export const dynamic = "force-dynamic";

export default async function AreasYHabilidades({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const s = await requireSession();
  if (s.role !== "COORDINADOR") redirect("/panel?sinpermiso=1");
  const [areas, skills] = await Promise.all([
    prisma.area.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.skill.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/panel/configuracion" className="text-sm underline">← Volver a configuración</Link>
      <h1 className="text-3xl font-bold">Áreas y habilidades</h1>
      <Flash error={searchParams.error} ok={searchParams.ok} />

      <section className="card space-y-4">
        <h2 className="text-lg font-bold">Áreas de servicio</h2>
        <p className="text-sm text-ink/70">Las áreas oficiales son transmisión, sonido, iluminación y proyección. Si una ya tiene asignaciones, desactívala en lugar de eliminarla.</p>
        <ul className="space-y-3">
          {areas.map((a) => (
            <li key={a.id} className="rounded-lg border border-ink/10 p-3">
              <form action={updateArea} className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                <input type="hidden" name="id" value={a.id} />
                <label><span className="label">Nombre</span><input name="name" defaultValue={a.name} className="input" required /></label>
                <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={a.active} className="h-4 w-4 accent-[#1800ad]" /> Activa</label>
                <button className="btn-dark">Guardar</button>
              </form>
              <form action={deleteArea} className="mt-2">
                <input type="hidden" name="id" value={a.id} />
                <button className="text-xs font-medium text-red-700 underline">Eliminar</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addArea} className="flex flex-wrap items-end gap-3 border-t border-ink/10 pt-4">
          <label className="flex-1"><span className="label">Nueva área</span><input name="name" className="input" required /></label>
          <button className="btn-primary">Agregar</button>
        </form>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-bold">Habilidades</h2>
        <ul className="space-y-3">
          {skills.map((k) => (
            <li key={k.id} className="rounded-lg border border-ink/10 p-3">
              <form action={updateSkill} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                <input type="hidden" name="id" value={k.id} />
                <label><span className="label">Nombre</span><input name="name" defaultValue={k.name} className="input" required /></label>
                <label>
                  <span className="label">Área</span>
                  <select name="areaId" defaultValue={k.areaId ?? ""} className="input">
                    <option value="">General</option>
                    {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={k.active} className="h-4 w-4 accent-[#1800ad]" /> Activa</label>
                <button className="btn-dark">Guardar</button>
              </form>
              <form action={deleteSkill} className="mt-2">
                <input type="hidden" name="id" value={k.id} />
                <button className="text-xs font-medium text-red-700 underline">Eliminar</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addSkill} className="grid gap-3 border-t border-ink/10 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label><span className="label">Nueva habilidad</span><input name="name" className="input" required /></label>
          <label>
            <span className="label">Área</span>
            <select name="areaId" className="input" defaultValue="">
              <option value="">General</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <button className="btn-primary">Agregar</button>
        </form>
      </section>
    </div>
  );
}
