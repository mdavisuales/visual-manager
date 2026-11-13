import { requireSession } from "@/lib/auth";
import { permissionSet } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { ROLE_LABEL } from "@/lib/constants";
import { logout } from "@/app/login/actions";
import NavLink from "@/components/NavLink";
import AppBottomNav from "@/components/AppBottomNav";
import { isAppRequest } from "@/lib/appmode";

export const dynamic = "force-dynamic";

function Badge({ n }: { n: number }) {
  return n > 0 ? <span className="rounded-full bg-lamp px-2 text-xs font-bold text-ink">{n}</span> : null;
}

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  const perms = await permissionSet(s.role);
  const training = (await getSettings()).training_enabled === "on";
  const [pending, unread, incoming] = await Promise.all([
    perms.has("avisos.gestionar") ? prisma.notification.count({ where: { sent: false, link: { not: "" } } }) : 0,
    prisma.notification.count({ where: { userId: s.userId, readAt: null } }),
    prisma.assignmentChange.count({ where: { targetUserId: s.userId, status: "PENDIENTE" } }),
  ]);

  // En la app Android: encabezado delgado + barra de navegación inferior (el resto está en "Más")
  if (isAppRequest()) {
    return (
      <div className="min-h-screen bg-[#f4f6fb]">
        <header className="bg-side px-4 py-3 text-white">
          <p className="font-display text-xl font-extrabold tracking-tight">VISUALES MDA</p>
          <p className="text-xs font-light text-white/75">{s.name} · {ROLE_LABEL[s.role]}</p>
        </header>
        <main className="min-w-0 p-4 pb-28">{children}</main>
        <AppBottomNav incoming={incoming} unread={unread} />
      </div>
    );
  }

  return (
    <div className="bg-[#f4f6fb] md:flex md:min-h-screen">
      <aside className="bg-side p-3 text-white md:w-64 md:shrink-0 md:p-5">
        <div className="mb-3 flex items-center justify-between md:mb-6 md:block">
          <div>
            <p className="font-display text-2xl font-extrabold tracking-tight">VISUALES MDA</p>
            <p className="text-xs font-light text-white/75">
              {s.name} · {ROLE_LABEL[s.role]}
            </p>
          </div>
          <form action={logout} className="md:mt-3">
            <button className="rounded-lg px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">Cerrar sesión</button>
          </form>
        </div>
        <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Panel">
          <NavLink href="/panel">Resumen</NavLink>
          <NavLink href="/panel/mis-asignaciones">
            Mis asignaciones <Badge n={incoming} />
          </NavLink>
          <NavLink href="/panel/disponibilidad">Mi disponibilidad</NavLink>
          <NavLink href="/panel/notificaciones">
            Notificaciones <Badge n={unread} />
          </NavLink>
          <NavLink href="/panel/mi-perfil">Mi perfil y test</NavLink>
          {perms.has("programacion.ver") && <NavLink href="/panel/programacion">Programación</NavLink>}
          {perms.has("solicitudes.ver") && <NavLink href="/panel/solicitudes">Solicitudes</NavLink>}
          {perms.has("avisos.gestionar") && (
            <NavLink href="/panel/avisos">
              Avisos de WhatsApp <Badge n={pending} />
            </NavLink>
          )}
          {perms.has("inventario.ver") && <NavLink href="/panel/inventario">Inventario</NavLink>}
          <NavLink href="/panel/novedades">Novedades técnicas</NavLink>
          {training && <NavLink href="/panel/formacion">Formación</NavLink>}
          {perms.has("usuarios.ver") && <NavLink href="/panel/usuarios">Equipo</NavLink>}
          {perms.has("informes.ver") && <NavLink href="/panel/estadisticas">Estadísticas e informes</NavLink>}
          {s.role === "COORDINADOR" && <NavLink href="/panel/configuracion">Configuración</NavLink>}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
