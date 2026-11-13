import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/constants";
import { upcomingBirthdays } from "@/lib/birthdays";
import { formatBirthday } from "@/lib/birthday-utils";
import BirthdayList from "@/components/BirthdayList";
import BirthdayFields from "@/components/BirthdayFields";
import { createUser, updateUser, resetPassword } from "../actions";

export const dynamic = "force-dynamic";

export default async function Usuarios({ searchParams }: { searchParams: { error?: string; ok?: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "usuarios.ver");
  const isCoord = s.role === "COORDINADOR";
  const [users, birthdays] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ role: "asc" }, { name: "asc" }] }),
    upcomingBirthdays(60),
  ]);

  return (
    <div className="max-w-4xl space-y-5">
      <h1 className="text-3xl font-bold">Equipo</h1>
      {searchParams.error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-800">{searchParams.error}</p>}
      {searchParams.ok && <p className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-900">{searchParams.ok}</p>}

      <section className="card space-y-2">
        <h2 className="text-lg font-bold">Próximos cumpleaños (60 días)</h2>
        {birthdays.length === 0 ? (
          <p className="text-sm text-ink/70">No hay cumpleaños próximos. Cada integrante puede registrar el suyo en “Mi perfil”, o puedes hacerlo tú en su ficha.</p>
        ) : (
          <BirthdayList list={birthdays} />
        )}
      </section>

      {isCoord && (
        <form action={createUser} className="card grid gap-3 sm:grid-cols-2">
          <h2 className="text-lg font-bold sm:col-span-2">Agregar integrante</h2>
          <label><span className="label">Nombre completo</span><input name="name" className="input" required /></label>
          <label><span className="label">Correo</span><input name="email" type="email" className="input" required /></label>
          <label><span className="label">WhatsApp</span><input name="phone" type="tel" className="input" placeholder="300 123 4567" /></label>
          <label>
            <span className="label">Rol</span>
            <select name="role" defaultValue="SERVIDOR" className="input">
              {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <div className="sm:col-span-2"><BirthdayFields /></div>
          <label className="sm:col-span-2">
            <span className="label">Contraseña inicial (mínimo 8 caracteres)</span>
            <input name="password" type="text" minLength={8} className="input" required />
            <span className="hint block">Compártesela a la persona por un medio privado.</span>
          </label>
          <div className="sm:col-span-2"><button className="btn-primary">Crear usuario</button></div>
        </form>
      )}

      <ul className="space-y-3">
        {users.map((u) => (
          <li key={u.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={`/panel/equipo/${u.id}`} className="font-bold underline">{u.name}</Link>
                <p className="text-sm text-ink/70">{u.email}{u.phone ? ` · ${u.phone}` : ""}{u.birthMonth && u.birthDay ? ` · Cumple: ${formatBirthday(u.birthMonth, u.birthDay)}` : ""}</p>
              </div>
              <span className="flex gap-2">
                <span className="badge bg-fog">{ROLE_LABEL[u.role]}</span>
                <span className={`badge ${u.active ? "bg-emerald-100 text-emerald-900" : "bg-slate-200 text-slate-700"}`}>
                  {u.active ? "Activo" : "Inactivo"}
                </span>
              </span>
            </div>

            {isCoord && u.id !== s.userId && (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-medium underline">Editar</summary>
                <form action={updateUser} className="mt-3 grid gap-3 sm:grid-cols-3">
                  <input type="hidden" name="id" value={u.id} />
                  <label>
                    <span className="label">Rol</span>
                    <select name="role" defaultValue={u.role} className="input">
                      {Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  <label><span className="label">WhatsApp</span><input name="phone" defaultValue={u.phone ?? ""} className="input" /></label>
                  <label className="flex items-end gap-2 pb-2">
                    <input type="checkbox" name="active" defaultChecked={u.active} className="h-4 w-4 accent-[#1800ad]" />
                    <span>Activo</span>
                  </label>
                  <div className="sm:col-span-3"><button className="btn-dark">Guardar</button></div>
                </form>
                <form action={resetPassword} className="mt-3 flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={u.id} />
                  <label className="flex-1">
                    <span className="label">Nueva contraseña</span>
                    <input name="password" type="text" minLength={8} className="input" required />
                  </label>
                  <button className="btn-ghost">Cambiar contraseña</button>
                </form>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
