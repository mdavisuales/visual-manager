import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatShortDate } from "@/lib/dates";
import Flash from "@/components/Flash";
import { createTraining, addMaterial, deleteMaterial } from "../training-actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { MANUAL: "Manual", TUTORIAL: "Tutorial", MATERIAL: "Material" };
const TRAINING_STATUS: Record<string, string> = { PROGRAMADA: "Programada", REALIZADA: "Realizada", CANCELADA: "Cancelada" };
const PART_LABEL: Record<string, string> = { INSCRITO: "Inscrito", ASISTIO: "Asistió", AUSENTE: "Ausente", COMPLETADO: "Completó" };

export default async function Formacion({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  const settings = await getSettings();
  if (settings.training_enabled !== "on") redirect("/panel");
  const manage = await can(s.role, "formacion.gestionar");

  const [trainings, library, mine] = await Promise.all([
    prisma.training.findMany({ include: { _count: { select: { participants: true } } }, orderBy: [{ date: "desc" }, { createdAt: "desc" }] }),
    prisma.trainingMaterial.findMany({ where: { trainingId: null }, orderBy: { createdAt: "desc" } }),
    prisma.trainingParticipation.findMany({ where: { userId: s.userId }, include: { training: true }, orderBy: { updatedAt: "desc" } }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Formación y capacitación</h1>
      <Flash error={searchParams.error} ok={searchParams.ok} />

      {mine.length > 0 && (
        <section className="card space-y-2">
          <h2 className="text-lg font-bold">Mi aprendizaje</h2>
          <ul className="divide-y divide-ink/10 text-sm">
            {mine.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={`/panel/formacion/${p.trainingId}`} className="font-medium underline">{p.training.title}</Link>
                <span className="flex items-center gap-2">
                  <span className="text-ink/60">{p.progress}%</span>
                  <span className="badge bg-fog">{PART_LABEL[p.status]}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Capacitaciones</h2>
        {trainings.length === 0 && <p className="card text-sm text-ink/70">Aún no hay capacitaciones.</p>}
        {trainings.map((t) => (
          <Link key={t.id} href={`/panel/formacion/${t.id}`} className={`card block hover:border-ink/40 ${t.status === "CANCELADA" ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold">{t.title}</p>
                <p className="text-sm text-ink/70">{t.date ? formatShortDate(t.date) : "Sin fecha"}{t.location ? ` · ${t.location}` : ""} · {t._count.participants} participante(s)</p>
              </div>
              <span className="badge bg-fog">{TRAINING_STATUS[t.status]}</span>
            </div>
          </Link>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-bold">Biblioteca: manuales y tutoriales</h2>
        {library.length === 0 && <p className="card text-sm text-ink/70">Aún no hay materiales en la biblioteca.</p>}
        <ul className="space-y-2">
          {library.map((m) => (
            <li key={m.id} className="card flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span className="badge mr-2 bg-fog">{KIND_LABEL[m.kind]}</span>
                <a href={m.url} target="_blank" rel="noopener noreferrer" className="font-bold underline">{m.title}</a>
                {m.description && <span className="block text-ink/60">{m.description}</span>}
              </span>
              {manage && (
                <form action={deleteMaterial}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="text-xs font-medium text-red-700 underline">Retirar</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      {manage && (
        <>
          <form action={createTraining} className="card space-y-3">
            <h2 className="text-lg font-bold">Nueva capacitación</h2>
            <label className="block"><span className="label">Nombre</span><input name="title" className="input" required /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="label">Fecha (opcional)</span><input name="date" type="date" className="input" /></label>
              <label><span className="label">Lugar (opcional)</span><input name="location" className="input" /></label>
            </div>
            <label className="block"><span className="label">Descripción</span><textarea name="description" rows={3} className="input" /></label>
            <button className="btn-primary">Crear capacitación</button>
          </form>

          <form action={addMaterial} className="card space-y-3">
            <h2 className="text-lg font-bold">Publicar material en la biblioteca</h2>
            <p className="text-sm text-ink/70">Se publican como enlaces (Google Drive, YouTube, etc.): así no ocupan espacio en el sistema.</p>
            <label className="block"><span className="label">Título</span><input name="title" className="input" required /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="label">Tipo</span>
                <select name="kind" className="input" defaultValue="MANUAL">
                  {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label><span className="label">Enlace</span><input name="url" type="url" className="input" placeholder="https://…" required /></label>
            </div>
            <label className="block"><span className="label">Descripción (opcional)</span><input name="description" className="input" /></label>
            <button className="btn-dark">Publicar</button>
          </form>
        </>
      )}
    </div>
  );
}
