import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { PERMISSIONS, permissionSet } from "@/lib/permissions";
import { redirect } from "next/navigation";
import {
  saveSettings,
  addRequirement,
  updateRequirement,
  deleteRequirement,
  savePermissions,
} from "../actions";

export const dynamic = "force-dynamic";

export default async function Configuracion({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const s = await requireSession();
  if (s.role !== "COORDINADOR") redirect("/panel?sinpermiso=1");

  const [settings, reqs, lider, servidor] = await Promise.all([
    getSettings(),
    prisma.techRequirement.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    permissionSet("LIDER"),
    permissionSet("SERVIDOR"),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Configuración</h1>
      {searchParams.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">{searchParams.error}</p>}
      {searchParams.ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-900">{searchParams.ok}</p>}

      <Link href="/panel/configuracion/areas" className="card block font-medium hover:border-ink/40">
        Áreas de servicio y habilidades del equipo →
      </Link>
      <Link href="/panel/configuracion/whatsapp" className="card block font-medium hover:border-ink/40">
        WhatsApp: envío automático, recordatorios y estado →
      </Link>

      <form action={saveSettings} className="card space-y-4">
        <h2 className="text-lg font-bold">General</h2>
        <label className="block"><span className="label">Nombre del ministerio</span><input name="org_name" defaultValue={settings.org_name} className="input" /></label>
        <label className="block"><span className="label">Lema (aparece bajo el título de la página principal)</span><input name="tagline" defaultValue={settings.tagline} className="input" /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Días mínimos de anticipación</span>
            <input name="min_days" type="number" min={1} max={365} defaultValue={settings.min_days} className="input" />
          </label>
          <label className="block">
            <span className="label">WhatsApp del ministerio</span>
            <input name="ministry_whatsapp" defaultValue={settings.ministry_whatsapp} className="input" placeholder="300 123 4567" />
          </label>
        </div>
        <label className="block">
          <span className="label">Módulo de formación y capacitación</span>
          <select name="training_enabled" defaultValue={settings.training_enabled} className="input">
            <option value="off">Desactivado (oculto para todos; no se borra nada)</option>
            <option value="on">Activado</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Mensaje de advertencia por poca anticipación</span>
          <textarea name="late_warning" rows={6} defaultValue={settings.late_warning} className="input" />
          <span className="hint block">Se muestra cuando el evento está a menos de los días mínimos. No impide enviar la solicitud.</span>
        </label>
        <button className="btn-primary">Guardar configuración</button>
      </form>

      <section className="card space-y-4">
        <h2 className="text-lg font-bold">Requerimientos técnicos del formulario</h2>
        <p className="text-sm text-ink/70">
          Si un requerimiento ya se usó en solicitudes, es mejor desactivarlo que eliminarlo: eliminarlo lo quita también de esas solicitudes.
        </p>
        <ul className="space-y-3">
          {reqs.map((r) => (
            <li key={r.id} className="rounded-lg border border-ink/10 p-3">
              <form action={updateRequirement} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
                <input type="hidden" name="id" value={r.id} />
                <label><span className="label">Nombre</span><input name="name" defaultValue={r.name} className="input" required /></label>
                <label><span className="label">Descripción</span><input name="description" defaultValue={r.description ?? ""} className="input" /></label>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={r.active} className="h-4 w-4 accent-[#1800ad]" /> Activo
                </label>
                <button className="btn-dark">Guardar</button>
              </form>
              <form action={deleteRequirement} className="mt-2">
                <input type="hidden" name="id" value={r.id} />
                <button className="text-xs font-medium text-red-700 underline">Eliminar</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addRequirement} className="grid gap-3 border-t border-ink/10 pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label><span className="label">Nuevo requerimiento</span><input name="name" className="input" required /></label>
          <label><span className="label">Descripción (opcional)</span><input name="description" className="input" /></label>
          <button className="btn-primary">Agregar</button>
        </form>
      </section>

      <form action={savePermissions} className="card space-y-4">
        <h2 className="text-lg font-bold">Permisos por rol</h2>
        <p className="text-sm text-ink/70">El Coordinador siempre tiene todos los permisos. Aquí defines qué puede hacer cada uno de los otros roles.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ink/10">
                <th className="py-2 pr-4 font-medium">Permiso</th>
                <th className="px-3 py-2 font-medium">Líder</th>
                <th className="px-3 py-2 font-medium">Servidor</th>
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.key} className="border-b border-ink/5">
                  <td className="py-2 pr-4">{p.label}</td>
                  <td className="px-3 py-2"><input type="checkbox" name={`LIDER:${p.key}`} defaultChecked={lider.has(p.key)} className="h-4 w-4 accent-[#1800ad]" aria-label={`Líder: ${p.label}`} /></td>
                  <td className="px-3 py-2"><input type="checkbox" name={`SERVIDOR:${p.key}`} defaultChecked={servidor.has(p.key)} className="h-4 w-4 accent-[#1800ad]" aria-label={`Servidor: ${p.label}`} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn-dark">Guardar permisos</button>
      </form>
    </div>
  );
}
