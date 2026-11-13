import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { APTITUDES } from "@/lib/test";
import Flash from "@/components/Flash";
import { submitTest } from "../team-actions";

export const dynamic = "force-dynamic";

function Scale({ name }: { name: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n} className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-ink/15 px-3 py-2 text-sm has-[:checked]:border-ink has-[:checked]:bg-navy has-[:checked]:text-white">
          <input type="radio" name={name} value={n} required className="sr-only" />
          {n}
        </label>
      ))}
    </div>
  );
}

export default async function Test({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  await requireSession();
  const [areas, skills] = await Promise.all([
    prisma.area.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.skill.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-3xl font-bold">Test de habilidades</h1>
      <p className="text-sm text-ink/70">
        Responde con sinceridad. No hay respuestas buenas ni malas y el test <strong>no te excluye de ninguna área</strong>: solo ayuda al coordinador a
        orientar dónde puedes aportar. En cada pregunta, 1 es “nada o muy poco” y 5 es “mucho”.
      </p>
      <Flash error={searchParams.error} ok={searchParams.ok} />

      <form action={submitTest} className="space-y-5">
        {areas.map((a) => (
          <section key={a.id} className="card space-y-4">
            <h2 className="text-lg font-bold">{a.name}</h2>
            {[
              ["interest", `¿Cuánto te interesa servir en ${a.name}?`],
              ["experience", `¿Cuánta experiencia tienes en ${a.name}?`],
              ["knowledge", `¿Qué tanto conoces los equipos y procesos de ${a.name}?`],
            ].map(([k, q]) => (
              <fieldset key={k}>
                <legend className="mb-2 text-sm font-medium">{q}</legend>
                <Scale name={`a_${a.id}_${k}`} />
              </fieldset>
            ))}
          </section>
        ))}

        {skills.length > 0 && (
          <section className="card space-y-3">
            <h2 className="text-lg font-bold">¿Qué sabes hacer hoy?</h2>
            <p className="text-sm text-ink/70">Marca todo lo que ya sepas hacer (puedes dejarlo vacío).</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {skills.map((k) => (
                <label key={k.id} className="flex items-center gap-2 rounded-lg border border-ink/10 p-3 text-sm">
                  <input type="checkbox" name="skills" value={k.id} className="h-4 w-4 accent-[#1800ad]" /> {k.name}
                </label>
              ))}
            </div>
          </section>
        )}

        <section className="card space-y-4">
          <h2 className="text-lg font-bold">Sobre ti</h2>
          {APTITUDES.map((q) => (
            <fieldset key={q.key}>
              <legend className="mb-2 text-sm font-medium">{q.q}</legend>
              <Scale name={`apt_${q.key}`} />
            </fieldset>
          ))}
          <label className="block">
            <span className="label">¿Algo más que quieras contarle al coordinador? (opcional)</span>
            <textarea name="comments" rows={3} className="input" />
          </label>
        </section>

        <button className="btn-primary">Enviar mi test</button>
      </form>
    </div>
  );
}
