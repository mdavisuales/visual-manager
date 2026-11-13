import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/constants";
import { formatDateEs } from "@/lib/dates";
import Flash from "@/components/Flash";
import BirthdayFields from "@/components/BirthdayFields";
import { updateMyProfile } from "../team-actions";

export const dynamic = "force-dynamic";

export default async function MiPerfil({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  const [u, test] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: s.userId }, include: { areas: true, skills: true } }),
    prisma.testResult.findFirst({ where: { userId: s.userId }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="max-w-2xl space-y-5">
      <h1 className="text-3xl font-bold">Mi perfil</h1>
      <Flash error={searchParams.error} ok={searchParams.ok} />

      <section className="card space-y-1 text-sm">
        <p className="text-lg font-bold">{u.name}</p>
        <p>{u.email} · {ROLE_LABEL[u.role]}</p>
        <p className="text-ink/70">En el ministerio desde {formatDateEs(u.joinDate)}</p>
      </section>

      <form action={updateMyProfile} className="card space-y-4">
        <h2 className="text-lg font-bold">Mis datos de contacto</h2>
        <label className="block"><span className="label">WhatsApp</span><input name="phone" defaultValue={u.phone ?? ""} className="input" placeholder="300 123 4567" /></label>
        <label className="block"><span className="label">Dirección</span><input name="address" defaultValue={u.address ?? ""} className="input" /></label>
        <BirthdayFields month={u.birthMonth} day={u.birthDay} />
        <label className="block"><span className="label">Mi experiencia</span><textarea name="experience" rows={3} defaultValue={u.experience ?? ""} className="input" /></label>
        <button className="btn-dark">Guardar</button>
      </form>

      <section className="card space-y-3 text-sm">
        <h2 className="text-lg font-bold">Áreas y habilidades validadas</h2>
        <p className="text-ink/70">Las valida el coordinador a partir de tu test y de tu experiencia.</p>
        <div className="flex flex-wrap gap-2">
          {u.areas.length ? u.areas.map((a) => <span key={a.id} className="badge bg-navy text-white">{a.name}</span>) : <span className="text-ink/60">Aún sin áreas asignadas.</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {u.skills.map((k) => <span key={k.id} className="badge bg-fog">{k.name}</span>)}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-1 text-lg font-bold">Test de habilidades</h2>
        <p className="mb-3 text-sm text-ink/70">
          {test ? `Lo hiciste el ${formatDateEs(test.createdAt)}. Puedes repetirlo cuando quieras.` : "Aún no lo has hecho. Toma unos 5 minutos."}
        </p>
        <Link href="/panel/test" className="btn-primary">{test ? "Repetir el test" : "Hacer el test"}</Link>
      </section>
    </div>
  );
}
