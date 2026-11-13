import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { can, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { isoDay, formatDateEs, formatShortDate, DIAS, formatDateTimeEs } from "@/lib/dates";
import { areaScores, APTITUDES, type TestData } from "@/lib/test";
import { ROLE_LABEL, ASSIGNMENT_LABEL, ASSIGNMENT_STYLE } from "@/lib/constants";
import Flash from "@/components/Flash";
import BirthdayFields from "@/components/BirthdayFields";
import { formatBirthday } from "@/lib/birthday-utils";
import { getSettings } from "@/lib/settings";
import { updateProfile } from "../../team-actions";

export const dynamic = "force-dynamic";

export default async function PerfilEquipo({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "usuarios.ver");
  const edit = await can(s.role, "equipo.gestionar");

  const [u, areas, skills] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.id },
      include: {
        areas: true,
        skills: true,
        unavailabilities: true,
        testResults: { orderBy: { createdAt: "desc" }, take: 1 },
        assignments: { include: { service: true, area: true }, orderBy: { service: { date: "desc" } }, take: 30 },
      },
    }),
    prisma.area.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.skill.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!u) notFound();
  const trainingOn = (await getSettings()).training_enabled === "on";
  const trainings = trainingOn ? await prisma.trainingParticipation.findMany({ where: { userId: u.id }, include: { training: true }, orderBy: { updatedAt: "desc" } }) : [];

  const test = u.testResults[0];
  const data = test ? (test.data as unknown as TestData) : null;
  const scores = data ? areaScores(data) : [];
  const areaName = (id: string) => areas.find((a) => a.id === id)?.name ?? "Área eliminada";
  const hasArea = new Set(u.areas.map((a) => a.id));
  const hasSkill = new Set(u.skills.map((k) => k.id));

  const done = u.assignments.filter((a) => a.status !== "CANCELADA");
  const confirmed = done.filter((a) => a.status === "CONFIRMADA").length;

  return (
    <div className="max-w-3xl space-y-5">
      <Link href="/panel/usuarios" className="text-sm underline">← Volver al equipo</Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-bold">{u.name}</h1>
        <span className="flex gap-2">
          <span className="badge bg-fog">{ROLE_LABEL[u.role]}</span>
          <span className={`badge ${u.active ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>{u.active ? "Activo" : "Inactivo"}</span>
        </span>
      </div>
      <Flash error={searchParams.error} ok={searchParams.ok} />

      <section className="card grid gap-3 text-sm sm:grid-cols-2">
        <p><span className="text-ink/60">Correo:</span> {u.email}</p>
        <p><span className="text-ink/60">WhatsApp:</span> {u.phone ?? "—"}</p>
        <p><span className="text-ink/60">Dirección:</span> {u.address ?? "—"}</p>
        <p><span className="text-ink/60">Ingreso:</span> {formatDateEs(u.joinDate)}</p>
        <p><span className="text-ink/60">Cumpleaños:</span> {u.birthMonth && u.birthDay ? formatBirthday(u.birthMonth, u.birthDay) : "—"}</p>
        <p className="sm:col-span-2"><span className="text-ink/60">Experiencia:</span> {u.experience ?? "—"}</p>
        {u.internalNotes && <p className="sm:col-span-2"><span className="text-ink/60">Notas internas:</span> {u.internalNotes}</p>}
      </section>

      <section className="card space-y-3 text-sm">
        <h2 className="text-lg font-bold">Resultado del test (orientación, no excluyente)</h2>
        {!data ? (
          <p className="text-ink/70">Todavía no ha hecho el test.</p>
        ) : (
          <>
            <p className="text-ink/60">Hecho el {formatDateTimeEs(test!.createdAt)}. Promedio por área (1 a 5):</p>
            <ul className="space-y-1.5">
              {scores.map((r) => (
                <li key={r.areaId} className="flex items-center gap-3">
                  <span className="w-36 shrink-0">{areaName(r.areaId)}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded bg-fog"><span className="block h-full bg-royal" style={{ width: `${(r.score / 5) * 100}%` }} /></span>
                  <span className="w-8 text-right font-medium">{r.score}</span>
                </li>
              ))}
            </ul>
            <p><span className="text-ink/60">Dice saber hacer:</span> {data.skills.map((id) => skills.find((k) => k.id === id)?.name).filter(Boolean).join(", ") || "—"}</p>
            <p className="text-ink/60">
              Aptitudes: {APTITUDES.map((q) => `${q.q.split(" ").slice(0, 3).join(" ")}… ${data.aptitudes?.[q.key] ?? "-"}`).join(" · ")}
            </p>
            {data.comments && <p><span className="text-ink/60">Comentario:</span> {data.comments}</p>}
          </>
        )}
      </section>

      {edit ? (
        <form action={updateProfile} className="card space-y-4">
          <input type="hidden" name="id" value={u.id} />
          <h2 className="text-lg font-bold">Validar y actualizar el perfil</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label><span className="label">Fecha de ingreso</span><input name="joinDate" type="date" defaultValue={isoDay(u.joinDate)} className="input" /></label>
            <label><span className="label">Dirección</span><input name="address" defaultValue={u.address ?? ""} className="input" /></label>
          </div>
          <BirthdayFields month={u.birthMonth} day={u.birthDay} />
          <label className="block"><span className="label">Experiencia</span><textarea name="experience" rows={2} defaultValue={u.experience ?? ""} className="input" /></label>
          <label className="block"><span className="label">Notas internas (solo coordinación y líderes)</span><textarea name="internalNotes" rows={2} defaultValue={u.internalNotes ?? ""} className="input" /></label>
          <fieldset>
            <legend className="label">Áreas de servicio</legend>
            <div className="flex flex-wrap gap-2">
              {areas.filter((a) => a.active || hasArea.has(a.id)).map((a) => (
                <label key={a.id} className="flex items-center gap-2 rounded-lg border border-ink/15 px-3 py-2 text-sm">
                  <input type="checkbox" name="areas" value={a.id} defaultChecked={hasArea.has(a.id)} className="h-4 w-4 accent-[#1800ad]" /> {a.name}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">Habilidades</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {skills.map((k) => (
                <label key={k.id} className="flex items-center gap-2 rounded-lg border border-ink/10 p-2.5 text-sm">
                  <input type="checkbox" name="skills" value={k.id} defaultChecked={hasSkill.has(k.id)} className="h-4 w-4 accent-[#1800ad]" />
                  <span>{k.name}{k.areaId && <span className="text-ink/50"> · {areaName(k.areaId)}</span>}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button className="btn-primary">Guardar perfil</button>
        </form>
      ) : (
        <section className="card space-y-2 text-sm">
          <h2 className="text-lg font-bold">Áreas y habilidades</h2>
          <p>{u.areas.map((a) => a.name).join(", ") || "Sin áreas asignadas."}</p>
          <p className="text-ink/70">{u.skills.map((k) => k.name).join(", ")}</p>
        </section>
      )}

      <section className="card space-y-2 text-sm">
        <h2 className="text-lg font-bold">Disponibilidad (cuándo NO puede servir)</h2>
        {u.unavailabilities.length === 0 ? (
          <p className="text-ink/70">Sin restricciones registradas.</p>
        ) : (
          <ul className="space-y-1">
            {u.unavailabilities.map((x) => (
              <li key={x.id}>
                {x.kind === "UNICA" && x.date
                  ? `${formatShortDate(x.date)}${x.endDate ? ` al ${formatShortDate(x.endDate)}` : ""}`
                  : `Todos los ${DIAS[x.weekday ?? 0].toLowerCase()}s`}
                {" · "}{x.allDay ? "todo el día" : `${x.startTime} a ${x.endTime}`}{x.reason ? ` · ${x.reason}` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="text-lg font-bold">Historial de participación</h2>
        <p className="text-ink/70">{done.length} servicios asignados (últimos 30), {confirmed} confirmados.</p>
        <ul className="divide-y divide-ink/10">
          {u.assignments.map((a) => (
            <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span>{formatShortDate(a.service.date)} · {a.service.title} · {a.area.name}</span>
              <span className={`badge ${ASSIGNMENT_STYLE[a.status]}`}>{ASSIGNMENT_LABEL[a.status]}</span>
            </li>
          ))}
        </ul>
        {trainingOn ? (
          <>
            <h3 className="pt-2 font-bold">Capacitaciones</h3>
            {trainings.length === 0 ? (
              <p className="text-ink/70">Sin capacitaciones registradas.</p>
            ) : (
              <ul className="divide-y divide-ink/10">
                {trainings.map((x) => (
                  <li key={x.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>{x.training.title}</span>
                    <span className="text-ink/70">{{ INSCRITO: "Inscrito", ASISTIO: "Asistió", AUSENTE: "Ausente", COMPLETADO: "Completó" }[x.status]} · {x.progress}%</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-xs text-ink/50">El módulo de formación está desactivado.</p>
        )}
      </section>
    </div>
  );
}
