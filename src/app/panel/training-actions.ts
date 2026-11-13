"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { MaterialKind, ParticipationStatus, TrainingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { toDateOnly } from "@/lib/dates";
import { notifyUsers, siteUrl } from "@/lib/notify";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const enc = encodeURIComponent;

function go(path: string, kind: "ok" | "error", msg: string): never {
  return redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${enc(msg)}`);
}

// El módulo se puede apagar: con él apagado ninguna acción funciona, pero los datos se conservan.
async function gate(manage: boolean) {
  const s = await requireSession();
  if ((await getSettings()).training_enabled !== "on") redirect("/panel");
  if (manage) await requirePermission(s.role, "formacion.gestionar");
  return s;
}

const isUrl = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === "https:" || x.protocol === "http:";
  } catch {
    return false;
  }
};

export async function createTraining(fd: FormData) {
  await gate(true);
  const title = str(fd, "title");
  const date = str(fd, "date");
  if (title.length < 3) go("/panel/formacion", "error", "Escribe el nombre de la capacitación.");
  const t = await prisma.training.create({
    data: {
      title,
      description: str(fd, "description") || null,
      location: str(fd, "location") || null,
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? toDateOnly(date) : null,
    },
  });
  go(`/panel/formacion/${t.id}`, "ok", "Capacitación creada. Agrega materiales y participantes.");
}

export async function updateTraining(fd: FormData) {
  await gate(true);
  const id = str(fd, "id");
  const title = str(fd, "title");
  const status = str(fd, "status") as TrainingStatus;
  const date = str(fd, "date");
  if (title.length < 3) go(`/panel/formacion/${id}`, "error", "Escribe el nombre de la capacitación.");
  if (!["PROGRAMADA", "REALIZADA", "CANCELADA"].includes(status)) go(`/panel/formacion/${id}`, "error", "Estado no válido.");
  await prisma.training.update({
    where: { id },
    data: {
      title,
      status,
      description: str(fd, "description") || null,
      location: str(fd, "location") || null,
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? toDateOnly(date) : null,
    },
  });
  go(`/panel/formacion/${id}`, "ok", "Capacitación actualizada.");
}

export async function addMaterial(fd: FormData) {
  await gate(true);
  const trainingId = str(fd, "trainingId") || null;
  const back = trainingId ? `/panel/formacion/${trainingId}` : "/panel/formacion";
  const title = str(fd, "title");
  const url = str(fd, "url");
  const kind = str(fd, "kind") as MaterialKind;
  if (title.length < 3) go(back, "error", "Escribe el título del material.");
  if (!isUrl(url)) go(back, "error", "El enlace debe empezar por http:// o https:// (por ejemplo, un enlace de Google Drive o YouTube).");
  if (!["MANUAL", "TUTORIAL", "MATERIAL"].includes(kind)) go(back, "error", "Tipo de material no válido.");
  await prisma.trainingMaterial.create({ data: { trainingId, title, url, kind, description: str(fd, "description") || null } });
  go(back, "ok", "Material publicado.");
}

export async function deleteMaterial(fd: FormData) {
  await gate(true);
  const m = await prisma.trainingMaterial.delete({ where: { id: str(fd, "id") } });
  go(m.trainingId ? `/panel/formacion/${m.trainingId}` : "/panel/formacion", "ok", "Material retirado.");
}

export async function addParticipants(fd: FormData) {
  await gate(true);
  const trainingId = str(fd, "trainingId");
  const back = `/panel/formacion/${trainingId}`;
  const ids = fd.getAll("userIds").map(String);
  if (ids.length === 0) go(back, "error", "Selecciona al menos una persona.");
  const t = await prisma.training.findUnique({ where: { id: trainingId } });
  if (!t) return redirect("/panel/formacion");
  const res = await prisma.trainingParticipation.createMany({ data: ids.map((userId) => ({ trainingId, userId })), skipDuplicates: true });
  await notifyUsers(ids, `Te inscribieron en la capacitación "${t.title}". Más información: ${siteUrl()}/panel/formacion/${t.id}`);
  go(back, "ok", `Se inscribieron ${res.count} persona(s).`);
}

export async function updateParticipation(fd: FormData) {
  await gate(true);
  const id = str(fd, "id");
  const status = str(fd, "status") as ParticipationStatus;
  const progress = Math.min(Math.max(Number(str(fd, "progress")) || 0, 0), 100);
  if (!["INSCRITO", "ASISTIO", "AUSENTE", "COMPLETADO"].includes(status)) return;
  const p = await prisma.trainingParticipation.update({
    where: { id },
    data: { status, progress: status === "COMPLETADO" ? 100 : progress, note: str(fd, "note").slice(0, 500) || null },
  });
  revalidatePath(`/panel/formacion/${p.trainingId}`);
}

export async function removeParticipation(fd: FormData) {
  await gate(true);
  const p = await prisma.trainingParticipation.delete({ where: { id: str(fd, "id") } });
  go(`/panel/formacion/${p.trainingId}`, "ok", "Participante retirado.");
}

export async function enrollSelf(fd: FormData) {
  const s = await gate(false);
  const trainingId = str(fd, "trainingId");
  const t = await prisma.training.findUnique({ where: { id: trainingId } });
  if (!t || t.status !== "PROGRAMADA") go("/panel/formacion", "error", "Esa capacitación ya no admite inscripciones.");
  await prisma.trainingParticipation.createMany({ data: [{ trainingId, userId: s.userId }], skipDuplicates: true });
  go(`/panel/formacion/${trainingId}`, "ok", "Quedaste inscrito.");
}
