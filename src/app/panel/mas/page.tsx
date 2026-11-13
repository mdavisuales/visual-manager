import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { permissionSet } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { logout } from "@/app/login/actions";

export const dynamic = "force-dynamic";

// Menú completo (sobre todo para la app: la barra inferior solo trae lo más usado)
export default async function Mas() {
  const s = await requireSession();
  const perms = await permissionSet(s.role);
  const training = (await getSettings()).training_enabled === "on";

  const items: { href: string; label: string; desc: string; show: boolean }[] = [
    { href: "/panel/mi-perfil", label: "Mi perfil y test", desc: "Mis datos, cumpleaños, áreas y test de habilidades", show: true },
    { href: "/panel/novedades", label: "Novedades técnicas", desc: "Reportar un problema con un equipo", show: true },
    { href: "/panel/formacion", label: "Formación", desc: "Capacitaciones, manuales y tutoriales", show: training },
    { href: "/panel/programacion", label: "Programación", desc: "Servicios y asignaciones", show: perms.has("programacion.ver") },
    { href: "/panel/solicitudes", label: "Solicitudes", desc: "Solicitudes de apoyo técnico", show: perms.has("solicitudes.ver") },
    { href: "/panel/avisos", label: "Avisos de WhatsApp", desc: "Cola de mensajes por enviar", show: perms.has("avisos.gestionar") },
    { href: "/panel/inventario", label: "Inventario", desc: "Equipos, préstamos y paquetes", show: perms.has("inventario.ver") },
    { href: "/panel/usuarios", label: "Equipo", desc: "Integrantes y cumpleaños", show: perms.has("usuarios.ver") },
    { href: "/panel/estadisticas", label: "Estadísticas e informes", desc: "Cifras e informe ministerial", show: perms.has("informes.ver") },
    { href: "/panel/configuracion", label: "Configuración", desc: "Ajustes del sistema", show: s.role === "COORDINADOR" },
  ];

  return (
    <div className="max-w-xl space-y-3">
      <h1 className="text-3xl font-bold">Más</h1>
      <ul className="space-y-2">
        {items.filter((i) => i.show).map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="card block hover:border-ink/40">
              <span className="block font-bold">{i.label}</span>
              <span className="text-sm font-light text-ink/70">{i.desc}</span>
            </Link>
          </li>
        ))}
      </ul>
      <form action={logout} className="pt-3">
        <button className="btn-ghost w-full">Cerrar sesión</button>
      </form>
    </div>
  );
}
