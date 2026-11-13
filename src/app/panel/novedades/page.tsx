import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatDateTimeEs } from "@/lib/dates";
import Flash from "@/components/Flash";
import { reportIssue, resolveIssue } from "../inventory-actions";

export const dynamic = "force-dynamic";

export default async function Novedades({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  const manage = await can(s.role, "inventario.gestionar");
  const [equipment, issues] = await Promise.all([
    prisma.equipment.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.techIssue.findMany({
      where: manage ? {} : { reporterId: s.userId },
      include: { reporter: true, equipment: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
  ]);

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold">Novedades técnicas</h1>
      <Flash error={searchParams.error} ok={searchParams.ok} />
      <form action={reportIssue} className="card space-y-3">
        <h2 className="text-lg font-bold">Reportar una novedad</h2>
        <p className="text-sm text-ink/70">Un equipo que falló, algo que falta o cualquier situación técnica que el ministerio deba saber. Se avisa al coordinador y a los líderes.</p>
        <label className="block">
          <span className="label">Equipo relacionado (opcional)</span>
          <select name="equipmentId" className="input" defaultValue="">
            <option value="">Ninguno en particular</option>
            {equipment.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">¿Qué pasó?</span><textarea name="description" rows={3} className="input" required /></label>
        <button className="btn-primary">Enviar reporte</button>
      </form>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">{manage ? "Todas las novedades" : "Mis reportes"}</h2>
        {issues.length === 0 && <p className="card text-sm text-ink/70">No hay novedades.</p>}
        {issues.map((i) => (
          <div key={i.id} className={`card space-y-2 text-sm ${i.status === "ABIERTA" ? "border-amber-400" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">{i.equipment?.name ?? "Sin equipo específico"} · {i.reporter.name}</p>
              <span className={`badge ${i.status === "ABIERTA" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>{i.status === "ABIERTA" ? "Abierta" : "Atendida"}</span>
            </div>
            <p className="whitespace-pre-wrap">{i.description}</p>
            <p className="text-xs text-ink/50">{formatDateTimeEs(i.createdAt)}</p>
            {i.response && <p className="rounded-lg bg-fog p-2">Respuesta: {i.response}</p>}
            {manage && i.status === "ABIERTA" && (
              <form action={resolveIssue} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={i.id} />
                <input name="response" className="input max-w-sm" placeholder="Qué se hizo (opcional)" />
                <button className="btn-dark">Marcar como atendida</button>
              </form>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}
