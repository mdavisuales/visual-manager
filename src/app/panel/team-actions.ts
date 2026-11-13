"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { toDateOnly } from "@/lib/dates";
import { parseBirthday } from "@/lib/birthday-utils";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: string) => /^\d{2}:\d{2}$/.test(s);

async function requireCoordinator() {
  const s = await requireSession();
  if (s.role !== "COORDINADOR") redirect("/panel?sinpermiso=1");
  return s;
}

/* ---------- Perfil ---------- */
export async function updateMyProfile(fd: FormData) {
  const s = await requireSession();
  const b = parseBirthday(fd);
  if (b.error) redirect(`/panel/mi-perfil?error=${encodeURIComponent(b.error)}`);
  await prisma.user.update({
    where: { id: s.userId },
    data: { phone: str(fd, "phone") || null, address: str(fd, "address") || null, experience: str(fd, "experience") || null, birthMonth: b.month, birthDay: b.day },
  });
  redirect("/panel/mi-perfil?ok=Perfil actualizado.");
}

export async function updateProfile(fd: FormData) {
  const s = await requireSession();
  await requirePermission(s.role, "equipo.gestionar");
  const id = str(fd, "id");
  const join = str(fd, "joinDate");
  const b = parseBirthday(fd);
  if (b.error) redirect(`/panel/equipo/${id}?error=${encodeURIComponent(b.error)}`);
  await prisma.user.update({
    where: { id },
    data: {
      birthMonth: b.month,
      birthDay: b.day,
      joinDate: isDate(join) ? toDateOnly(join) : undefined,
      address: str(fd, "address") || null,
      experience: str(fd, "experience") || null,
      internalNotes: str(fd, "internalNotes") || null,
      areas: { set: fd.getAll("areas").map((a) => ({ id: String(a) })) },
      skills: { set: fd.getAll("skills").map((a) => ({ id: String(a) })) },
    },
  });
  redirect(`/panel/equipo/${id}?ok=Perfil actualizado.`);
}

/* ---------- Test de habilidades ---------- */
export async function submitTest(fd: FormData) {
  const s = await requireSession();
  const areas = await prisma.area.findMany({ where: { active: true } });
  const skills = await prisma.skill.findMany({ where: { active: true }, select: { id: true } });
  const skillIds = new Set(skills.map((k) => k.id));
  const score = (k: string) => {
    const n = Number(str(fd, k));
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : 0;
  };

  const data: { areas: Record<string, { interest: number; experience: number; knowledge: number }>; skills: string[]; aptitudes: Record<string, number>; comments: string } = {
    areas: {},
    skills: fd.getAll("skills").map(String).filter((id) => skillIds.has(id)),
    aptitudes: {},
    comments: str(fd, "comments").slice(0, 1000),
  };
  for (const a of areas) {
    const v = { interest: score(`a_${a.id}_interest`), experience: score(`a_${a.id}_experience`), knowledge: score(`a_${a.id}_knowledge`) };
    if (!v.interest || !v.experience || !v.knowledge) redirect("/panel/test?error=Responde todas las preguntas de cada área.");
    data.areas[a.id] = v;
  }
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("apt_")) {
      const n = Number(v);
      if (Number.isInteger(n) && n >= 1 && n <= 5) data.aptitudes[k.slice(4)] = n;
    }
  }
  await prisma.testResult.create({ data: { userId: s.userId, data } });
  redirect("/panel/test?ok=Gracias. El coordinador revisará tus resultados para orientar tu servicio.");
}

/* ---------- Disponibilidad ---------- */
export async function addUnavailability(fd: FormData) {
  const s = await requireSession();
  const kind = str(fd, "kind");
  const allDay = fd.get("allDay") === "on";
  const startTime = str(fd, "startTime");
  const endTime = str(fd, "endTime");
  function back(m: string): never {
    return redirect(`/panel/disponibilidad?error=${encodeURIComponent(m)}`);
  }

  if (!allDay && (!isTime(startTime) || !isTime(endTime) || endTime <= startTime))
    back("Indica un horario válido (la hora final debe ser posterior a la inicial) o marca “Todo el día”.");

  const base = {
    userId: s.userId,
    allDay,
    startTime: allDay ? null : startTime,
    endTime: allDay ? null : endTime,
    reason: str(fd, "reason").slice(0, 200) || null,
  };

  if (kind === "UNICA") {
    const d = str(fd, "date");
    const e = str(fd, "endDate");
    if (!isDate(d)) back("Selecciona la fecha.");
    if (e && (!isDate(e) || e < d)) back("La fecha final no puede ser anterior a la inicial.");
    await prisma.unavailability.create({ data: { ...base, kind: "UNICA", date: toDateOnly(d), endDate: e ? toDateOnly(e) : null } });
  } else if (kind === "SEMANAL") {
    const wd = Number(str(fd, "weekday"));
    const from = str(fd, "validFrom");
    const until = str(fd, "validUntil");
    if (!Number.isInteger(wd) || wd < 0 || wd > 6) back("Selecciona el día de la semana.");
    if ((from && !isDate(from)) || (until && !isDate(until)) || (from && until && until < from)) back("Revisa las fechas de vigencia.");
    await prisma.unavailability.create({
      data: { ...base, kind: "SEMANAL", weekday: wd, validFrom: from ? toDateOnly(from) : null, validUntil: until ? toDateOnly(until) : null },
    });
  } else back("Tipo de indisponibilidad no válido.");
  redirect("/panel/disponibilidad?ok=Disponibilidad guardada.");
}

export async function deleteUnavailability(fd: FormData) {
  const s = await requireSession();
  await prisma.unavailability.deleteMany({ where: { id: str(fd, "id"), userId: s.userId } });
  revalidatePath("/panel/disponibilidad");
}

/* ---------- Notificaciones ---------- */
export async function markAllRead() {
  const s = await requireSession();
  await prisma.notification.updateMany({ where: { userId: s.userId, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/panel", "layout");
}

/* ---------- Áreas y habilidades (solo Coordinador) ---------- */
export async function addArea(fd: FormData) {
  await requireCoordinator();
  const name = str(fd, "name");
  if (!name) return;
  const last = await prisma.area.aggregate({ _max: { sortOrder: true } });
  await prisma.area.create({ data: { name, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  revalidatePath("/panel/configuracion/areas");
}

export async function updateArea(fd: FormData) {
  await requireCoordinator();
  const name = str(fd, "name");
  if (!name) return;
  await prisma.area.update({ where: { id: str(fd, "id") }, data: { name, active: fd.get("active") === "on" } });
  revalidatePath("/panel/configuracion/areas");
}

export async function deleteArea(fd: FormData) {
  await requireCoordinator();
  const id = str(fd, "id");
  if ((await prisma.assignment.count({ where: { areaId: id } })) > 0)
    redirect("/panel/configuracion/areas?error=Esta área ya tiene asignaciones. Desactívala en lugar de eliminarla.");
  await prisma.area.delete({ where: { id } });
  revalidatePath("/panel/configuracion/areas");
}

export async function addSkill(fd: FormData) {
  await requireCoordinator();
  const name = str(fd, "name");
  if (!name) return;
  await prisma.skill.create({ data: { name, areaId: str(fd, "areaId") || null } });
  revalidatePath("/panel/configuracion/areas");
}

export async function updateSkill(fd: FormData) {
  await requireCoordinator();
  const name = str(fd, "name");
  if (!name) return;
  await prisma.skill.update({
    where: { id: str(fd, "id") },
    data: { name, areaId: str(fd, "areaId") || null, active: fd.get("active") === "on" },
  });
  revalidatePath("/panel/configuracion/areas");
}

export async function deleteSkill(fd: FormData) {
  await requireCoordinator();
  await prisma.skill.delete({ where: { id: str(fd, "id") } });
  revalidatePath("/panel/configuracion/areas");
}
