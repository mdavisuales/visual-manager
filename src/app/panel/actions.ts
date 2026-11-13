"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { Prisma, RequestStatus, type Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requirePermission, PERMISSIONS } from "@/lib/permissions";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { releaseReserved } from "@/lib/inventory";
import { parseBirthday } from "@/lib/birthday-utils";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const ROLES: Role[] = ["COORDINADOR", "LIDER", "SERVIDOR"];

async function requireCoordinator() {
  const s = await requireSession();
  if (s.role !== "COORDINADOR") redirect("/panel?sinpermiso=1");
  return s;
}

/* ---------- Solicitudes ---------- */
export async function updateRequest(fd: FormData) {
  const s = await requireSession();
  await requirePermission(s.role, "solicitudes.gestionar");
  const id = str(fd, "id");
  const status = str(fd, "status");
  if (!(status in RequestStatus)) return;
  await prisma.serviceRequest.update({
    where: { id },
    data: { status: status as RequestStatus, internalNote: str(fd, "internalNote") || null },
  });
  // Una solicitud rechazada o cancelada libera los equipos que tenía reservados
  if (status === "RECHAZADA" || status === "CANCELADA") await releaseReserved({ requestId: id });
  revalidatePath(`/panel/solicitudes/${id}`);
  revalidatePath("/panel/solicitudes");
  revalidatePath("/panel");
}

/* ---------- Avisos ---------- */
export async function markNotificationSent(fd: FormData) {
  const s = await requireSession();
  await requirePermission(s.role, "avisos.gestionar");
  await prisma.notification.update({ where: { id: str(fd, "id") }, data: { sent: true, sentAt: new Date() } });
  revalidatePath("/panel/avisos");
  revalidatePath("/panel");
}

/* ---------- Usuarios (solo Coordinador) ---------- */
export async function createUser(fd: FormData) {
  await requireCoordinator();
  const name = str(fd, "name");
  const email = str(fd, "email").toLowerCase();
  const phone = str(fd, "phone");
  const role = str(fd, "role") as Role;
  const password = String(fd.get("password") ?? "");
  const bday = parseBirthday(fd);
  if (bday.error) redirect(`/panel/usuarios?error=${encodeURIComponent(bday.error)}`);
  if (name.length < 3 || !email.includes("@") || password.length < 8 || !ROLES.includes(role))
    redirect("/panel/usuarios?error=Revisa los datos: nombre, correo válido y contraseña de mínimo 8 caracteres.");
  let error = "";
  try {
    await prisma.user.create({
      data: { name, email, phone: phone || null, role, birthMonth: bday.month, birthDay: bday.day, passwordHash: await bcrypt.hash(password, 10) },
    });
  } catch (e) {
    error =
      e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002"
        ? "Ya existe un usuario con ese correo."
        : "No se pudo crear el usuario.";
  }
  if (error) redirect(`/panel/usuarios?error=${encodeURIComponent(error)}`);
  revalidatePath("/panel/usuarios");
}

export async function updateUser(fd: FormData) {
  const me = await requireCoordinator();
  const id = str(fd, "id");
  const role = str(fd, "role") as Role;
  if (id === me.userId || !ROLES.includes(role)) return; // el coordinador no puede quitarse su propio acceso
  await prisma.user.update({
    where: { id },
    data: { role, phone: str(fd, "phone") || null, active: fd.get("active") === "on" },
  });
  revalidatePath("/panel/usuarios");
}

export async function resetPassword(fd: FormData) {
  await requireCoordinator();
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) redirect("/panel/usuarios?error=La nueva contraseña debe tener mínimo 8 caracteres.");
  await prisma.user.update({ where: { id: str(fd, "id") }, data: { passwordHash: await bcrypt.hash(password, 10) } });
  redirect("/panel/usuarios?ok=Contraseña actualizada.");
}

/* ---------- Configuración (solo Coordinador) ---------- */
export async function saveSettings(fd: FormData) {
  await requireCoordinator();
  const minDays = Number(str(fd, "min_days"));
  if (!Number.isInteger(minDays) || minDays < 1 || minDays > 365)
    redirect("/panel/configuracion?error=Los días de anticipación deben estar entre 1 y 365.");
  if (fd.has("training_enabled") && !["on", "off"].includes(str(fd, "training_enabled"))) return;
  for (const key of ["org_name", "tagline", "min_days", "ministry_whatsapp", "late_warning", "training_enabled"]) {
    if (!fd.has(key)) continue;
    const value = str(fd, key);
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  revalidatePath("/", "layout");
  redirect("/panel/configuracion?ok=Configuración guardada.");
}

export async function addRequirement(fd: FormData) {
  await requireCoordinator();
  const name = str(fd, "name");
  if (!name) return;
  const last = await prisma.techRequirement.aggregate({ _max: { sortOrder: true } });
  await prisma.techRequirement.create({
    data: { name, description: str(fd, "description") || null, sortOrder: (last._max.sortOrder ?? 0) + 1 },
  });
  revalidatePath("/panel/configuracion");
}

export async function updateRequirement(fd: FormData) {
  await requireCoordinator();
  const name = str(fd, "name");
  if (!name) return;
  await prisma.techRequirement.update({
    where: { id: str(fd, "id") },
    data: { name, description: str(fd, "description") || null, active: fd.get("active") === "on" },
  });
  revalidatePath("/panel/configuracion");
}

export async function deleteRequirement(fd: FormData) {
  await requireCoordinator();
  await prisma.techRequirement.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/panel/configuracion");
}

export async function savePermissions(fd: FormData) {
  await requireCoordinator();
  const rows: { role: Role; permission: string }[] = [];
  for (const role of ["LIDER", "SERVIDOR"] as Role[])
    for (const p of PERMISSIONS) if (fd.get(`${role}:${p.key}`) === "on") rows.push({ role, permission: p.key });
  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { role: { in: ["LIDER", "SERVIDOR"] } } }),
    prisma.rolePermission.createMany({ data: rows }),
  ]);
  revalidatePath("/panel", "layout");
  redirect("/panel/configuracion?ok=Permisos guardados.");
}
