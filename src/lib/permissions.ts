import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

// Lista de permisos que el Coordinador puede dar o quitar a Líder y Servidor.
// Cuando se agreguen módulos nuevos, se agregan aquí sus permisos.
export const PERMISSIONS = [
  { key: "solicitudes.ver", label: "Ver solicitudes" },
  { key: "solicitudes.gestionar", label: "Cambiar estado y notas de las solicitudes" },
  { key: "avisos.gestionar", label: "Enviar avisos de WhatsApp" },
  { key: "usuarios.ver", label: "Ver la lista de integrantes y sus perfiles" },
  { key: "equipo.gestionar", label: "Validar áreas, habilidades y datos de los perfiles" },
  { key: "programacion.ver", label: "Ver la programación de servicios" },
  { key: "programacion.gestionar", label: "Crear servicios, asignar servidores y atender emergencias" },
  { key: "inventario.ver", label: "Ver el inventario, los préstamos y los paquetes" },
  { key: "inventario.gestionar", label: "Registrar equipos, cambiar su estado, prestar y atender novedades" },
  { key: "paquetes.gestionar", label: "Crear y editar paquetes técnicos" },
  { key: "reservas.gestionar", label: "Elegir paquetes y equipos para un evento y reservarlos" },
  { key: "informes.ver", label: "Ver estadísticas y generar informes ministeriales" },
  { key: "formacion.gestionar", label: "Crear capacitaciones, publicar materiales y registrar participaciones" },
] as const;

export const DEFAULT_ROLE_PERMISSIONS: Record<"LIDER" | "SERVIDOR", string[]> = {
  LIDER: [
    "solicitudes.ver",
    "solicitudes.gestionar",
    "avisos.gestionar",
    "usuarios.ver",
    "equipo.gestionar",
    "programacion.ver",
    "programacion.gestionar",
    "inventario.ver",
    "inventario.gestionar",
    "paquetes.gestionar",
    "reservas.gestionar",
    "informes.ver",
    "formacion.gestionar",
  ],
  SERVIDOR: [],
};

export async function permissionSet(role: Role): Promise<Set<string>> {
  if (role === "COORDINADOR") return new Set(PERMISSIONS.map((p) => p.key));
  const rows = await prisma.rolePermission.findMany({ where: { role } });
  return new Set(rows.map((r) => r.permission));
}

export async function can(role: Role, key: string): Promise<boolean> {
  return (await permissionSet(role)).has(key);
}

export async function requirePermission(role: Role, key: string) {
  if (!(await can(role, key))) redirect("/panel?sinpermiso=1");
}
