import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatDateTimeEs } from "@/lib/dates";
import { executiveSummary } from "@/lib/report-text";
import type { Stats } from "@/lib/stats";
import Flash from "@/components/Flash";
import { updateReportNotes, refreshReport, deleteReport } from "../../reports-actions";

export const dynamic = "force-dynamic";

export default async function InformeDetalle({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "informes.ver");
  const r = await prisma.report.findUnique({ where: { id: params.id } });
  if (!r) notFound();
  const st = r.data as unknown as Stats;

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/panel/informes" className="text-sm underline">← Volver a los informes</Link>
      <h1 className="text-3xl font-bold">{r.title}</h1>
      <p className="text-sm text-ink/60">Cifras calculadas el {formatDateTimeEs(new Date(st.generatedAt))}. Las de inventario son una foto de ese momento.</p>
      <Flash error={searchParams.error} ok={searchParams.ok} />

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Descargar</h2>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/informes/${r.id}/pdf`} className="btn-primary">Descargar PDF</a>
          <a href={`/api/informes/${r.id}/excel`} className="btn-dark">Descargar Excel</a>
        </div>
        <p className="text-xs text-ink/60">El PDF incluye portada, período, resumen ejecutivo, estadísticas, tablas, gráficos, logros, necesidades y observaciones. El Excel trae las tablas con fórmulas en hojas separadas.</p>
      </section>

      <section className="card space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-bold">Resumen ejecutivo</h2>
        {executiveSummary(st).map((p, k) => <p key={k}>{p}</p>)}
      </section>

      <form action={updateReportNotes} className="card space-y-4">
        <input type="hidden" name="id" value={r.id} />
        <h2 className="text-lg font-bold">Logros, necesidades y observaciones</h2>
        <label className="block"><span className="label">Logros del período</span><textarea name="achievements" rows={5} defaultValue={r.achievements ?? ""} className="input" /></label>
        <label className="block"><span className="label">Necesidades</span><textarea name="needs" rows={4} defaultValue={r.needs ?? ""} className="input" /></label>
        <label className="block"><span className="label">Observaciones relevantes</span><textarea name="observations" rows={4} defaultValue={r.observations ?? ""} className="input" /></label>
        <button className="btn-dark">Guardar textos</button>
      </form>

      <div className="flex flex-wrap gap-3">
        <form action={refreshReport}>
          <input type="hidden" name="id" value={r.id} />
          <button className="btn-ghost">Recalcular cifras con los datos de hoy</button>
        </form>
        {s.role === "COORDINADOR" && (
          <form action={deleteReport}>
            <input type="hidden" name="id" value={r.id} />
            <button className="btn-danger">Eliminar informe</button>
          </form>
        )}
      </div>
    </div>
  );
}
