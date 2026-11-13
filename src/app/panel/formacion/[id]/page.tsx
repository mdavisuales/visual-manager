import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateEs, isoDay } from "@/lib/dates";
import Flash from "@/components/Flash";
import { updateTraining, addMaterial, deleteMaterial, addParticipants, updateParticipation, removeParticipation, enrollSelf } from "../../training-actions";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = { MANUAL: "Manual", TUTORIAL: "Tutorial", MATERIAL: "Material" };
const TRAINING_STATUS: Record<string, string> = { PROGRAMADA: "Programada", REALIZADA: "Realizada", CANCELADA: "Cancelada" };
const PART_LABEL: Record<string, string> = { INSCRITO: "Inscrito", ASISTIO: "Asistió", AUSENTE: "Ausente", COMPLETADO: "Completó" };

export default async function CapacitacionDetalle({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  if ((await getSettings()).training_enabled !== "on") redirect("/panel");
  const manage = await can(s.role, "formacion.gestionar");

  const t = await prisma.training.findUnique({
    where: { id: params.id },
    include: { materials: { orderBy: { createdAt: "asc" } }, participants: { include: { user: true }, orderBy: { user: { name: "asc" } } } },
  });
  if (!t) notFound();
  const enrolled = new Set(t.participants.map((p) => p.userId));
  const candidates = manage ? (await prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" } })).filter((u) => !enrolled.has(u.id)) : [];
  const me = t.participants.find((p) => p.userId === s.userId);

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/panel/formacion" className="text-sm underline">← Volver a formación</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">{t.title}</h1>
        <span className="badge bg-fog">{TRAINING_STATUS[t.status]}</span>
      </div>
      <Flash error={searchParams.error} ok={searchParams.ok} />
      <p className="text-sm text-ink/70">{t.date ? formatDateEs(t.date) : "Sin fecha"}{t.location ? ` · ${t.location}` : ""}</p>
      {t.description && <p className="card whitespace-pre-wrap text-sm">{t.description}</p>}

      {!me && t.status === "PROGRAMADA" && (
        <form action={enrollSelf}>
          <input type="hidden" name="trainingId" value={t.id} />
          <button className="btn-primary">Inscribirme</button>
        </form>
      )}
      {me && (
        <p className="card text-sm">
          Tu avance: <strong>{PART_LABEL[me.status]}</strong> · {me.progress}%{me.note ? ` · ${me.note}` : ""}
        </p>
      )}

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Materiales</h2>
        {t.materials.length === 0 && <p className="text-sm text-ink/70">Sin materiales todavía.</p>}
        <ul className="space-y-2 text-sm">
          {t.materials.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2">
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
        {manage && (
          <form action={addMaterial} className="grid gap-2 border-t border-ink/10 pt-3 sm:grid-cols-2">
            <input type="hidden" name="trainingId" value={t.id} />
            <label><span className="label">Título</span><input name="title" className="input" required /></label>
            <label>
              <span className="label">Tipo</span>
              <select name="kind" className="input" defaultValue="MATERIAL">
                {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2"><span className="label">Enlace</span><input name="url" type="url" className="input" placeholder="https://…" required /></label>
            <label className="sm:col-span-2"><span className="label">Descripción (opcional)</span><input name="description" className="input" /></label>
            <div className="sm:col-span-2"><button className="btn-dark">Publicar material</button></div>
          </form>
        )}
      </section>

      {manage && (
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">Participantes y seguimiento</h2>
          {t.participants.length === 0 && <p className="text-sm text-ink/70">Aún no hay participantes.</p>}
          <ul className="space-y-3">
            {t.participants.map((p) => (
              <li key={p.id} className="rounded-lg border border-ink/10 p-3 text-sm">
                <form action={updateParticipation} className="grid gap-2 sm:grid-cols-[1fr_auto_5rem_1fr_auto] sm:items-end">
                  <input type="hidden" name="id" value={p.id} />
                  <span className="font-medium">{p.user.name}</span>
                  <select name="status" defaultValue={p.status} className="input" aria-label="Estado">
                    {Object.entries(PART_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                  <input name="progress" type="number" min={0} max={100} defaultValue={p.progress} className="input" aria-label="Avance (%)" />
                  <input name="note" defaultValue={p.note ?? ""} className="input" placeholder="Observación" aria-label="Observación" />
                  <button className="btn-dark">Guardar</button>
                </form>
                <form action={removeParticipation} className="mt-1">
                  <input type="hidden" name="id" value={p.id} />
                  <button className="text-xs font-medium text-red-700 underline">Retirar</button>
                </form>
              </li>
            ))}
          </ul>
          {candidates.length > 0 && (
            <form action={addParticipants} className="space-y-2 border-t border-ink/10 pt-3">
              <input type="hidden" name="trainingId" value={t.id} />
              <p className="font-bold">Inscribir personas</p>
              <div className="grid max-h-56 gap-1 overflow-y-auto sm:grid-cols-2">
                {candidates.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 rounded border border-ink/10 px-2 py-1.5 text-sm">
                    <input type="checkbox" name="userIds" value={u.id} className="h-4 w-4 accent-[#1800ad]" /> {u.name}
                  </label>
                ))}
              </div>
              <button className="btn-dark">Inscribir seleccionados</button>
            </form>
          )}
        </section>
      )}

      {manage && (
        <form action={updateTraining} className="card space-y-3">
          <input type="hidden" name="id" value={t.id} />
          <h2 className="text-lg font-bold">Datos de la capacitación</h2>
          <label className="block"><span className="label">Nombre</span><input name="title" defaultValue={t.title} className="input" required /></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label><span className="label">Fecha</span><input name="date" type="date" defaultValue={t.date ? isoDay(t.date) : ""} className="input" /></label>
            <label><span className="label">Lugar</span><input name="location" defaultValue={t.location ?? ""} className="input" /></label>
            <label>
              <span className="label">Estado</span>
              <select name="status" defaultValue={t.status} className="input">
                {Object.entries(TRAINING_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          </div>
          <label className="block"><span className="label">Descripción</span><textarea name="description" rows={3} defaultValue={t.description ?? ""} className="input" /></label>
          <button className="btn-primary">Guardar</button>
        </form>
      )}
    </div>
  );
}
