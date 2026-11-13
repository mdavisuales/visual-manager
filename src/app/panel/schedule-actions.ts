"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { LocationType, type ServiceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { todayBogota, toDateOnly, formatDateEs, addDays } from "@/lib/dates";
import { loadPeople, problemsFor, HARD } from "@/lib/scheduling";
import { notifyUsers, notifyStaff, siteUrl } from "@/lib/notify";
import { LOCATION_LABEL } from "@/lib/constants";
import { syncReservations, releaseReserved } from "@/lib/inventory";
import { generateReminders as generateRemindersFor } from "@/lib/reminders";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s: string) => /^\d{2}:\d{2}$/.test(s);
const enc = encodeURIComponent;
const panelLink = () => `${siteUrl()}/panel/mis-asignaciones`;

async function requireSchedule() {
  const s = await requireSession();
  await requirePermission(s.role, "programacion.gestionar");
  return s;
}

/* =================== SERVICIOS (Coordinador / Líder) =================== */

function readService(fd: FormData, onError: string) {
  const title = str(fd, "title");
  const date = str(fd, "date");
  const startTime = str(fd, "startTime");
  const endTime = str(fd, "endTime");
  const locationType = str(fd, "locationType");
  const address = str(fd, "address");
  function fail(m: string): never {
    return redirect(`${onError}${onError.includes("?") ? "&" : "?"}error=${enc(m)}`);
  }
  if (title.length < 3) fail("Escribe el nombre del servicio.");
  if (!isDate(date)) fail("Selecciona la fecha.");
  if (!isTime(startTime) || !isTime(endTime) || endTime <= startTime) fail("Revisa el horario: la hora final debe ser posterior a la inicial.");
  if (!(locationType in LOCATION_LABEL)) fail("Selecciona el lugar.");
  if (locationType === "FUERA_IGLESIA" && address.length < 5) fail("Escribe la dirección del lugar.");
  return {
    title,
    date: toDateOnly(date),
    startTime,
    endTime,
    locationType: locationType as LocationType,
    address: locationType === "FUERA_IGLESIA" ? address : null,
    notes: str(fd, "notes") || null,
  };
}

export async function createService(fd: FormData) {
  await requireSchedule();
  const created = await prisma.service.create({ data: readService(fd, "/panel/programacion/nuevo") });
  redirect(`/panel/programacion/${created.id}?ok=Servicio creado. Ahora asigna a los servidores.`);
}

export async function createServiceFromRequest(fd: FormData) {
  await requireSchedule();
  const r = await prisma.serviceRequest.findUnique({ where: { id: str(fd, "requestId") }, include: { service: true } });
  if (!r) redirect("/panel/programacion/nuevo?error=No se encontró la solicitud.");
  if (r.service) redirect(`/panel/programacion/${r.service.id}`);
  const created = await prisma.service.create({
    data: {
      title: r.activityName,
      date: r.eventDate,
      startTime: r.startTime,
      endTime: r.endTime,
      locationType: r.locationType,
      address: r.address,
      notes: r.observations,
      requestId: r.id,
    },
  });
  if (r.status === "PENDIENTE" || r.status === "EN_REVISION")
    await prisma.serviceRequest.update({ where: { id: r.id }, data: { status: "APROBADA" } });
  redirect(`/panel/programacion/${created.id}?ok=Servicio creado desde la solicitud ${r.code}. La solicitud quedó aprobada.`);
}

export async function updateService(fd: FormData) {
  await requireSchedule();
  const id = str(fd, "id");
  const back = `/panel/programacion/${id}`;
  const data = readService(fd, back);
  const before = await prisma.service.findUnique({ where: { id }, include: { assignments: { where: { status: { not: "CANCELADA" } } } } });
  if (!before) redirect("/panel/programacion");
  await prisma.service.update({ where: { id }, data });
  // Las reservas de equipos siguen la nueva fecha y horario del evento
  const evNew = { date: data.date, startTime: data.startTime, endTime: data.endTime };
  await syncReservations({ serviceId: id }, evNew);
  if (before.requestId) await syncReservations({ requestId: before.requestId }, evNew);

  const changed =
    before.date.getTime() !== data.date.getTime() ||
    before.startTime !== data.startTime ||
    before.endTime !== data.endTime ||
    before.locationType !== data.locationType ||
    (before.address ?? "") !== (data.address ?? "");

  let aviso = "";
  if (changed && before.assignments.length > 0) {
    const where = `${LOCATION_LABEL[data.locationType]}${data.address ? ` (${data.address})` : ""}`;
    await notifyUsers(
      before.assignments.map((a) => a.userId),
      `Cambio en el servicio "${data.title}": ahora es el ${formatDateEs(data.date)}, de ${data.startTime} a ${data.endTime}, en ${where}. Revisa tus asignaciones: ${panelLink()}`,
    );
    // Avisa si el cambio genera cruces o indisponibilidades
    const people = await loadPeople(before.assignments.map((a) => a.userId));
    const issues: string[] = [];
    for (const a of before.assignments) {
      const p = people.find((x) => x.id === a.userId);
      if (!p) continue;
      const probs = problemsFor(p, null, data, [a.id]).filter((x) => x.code !== "SIN_AREA");
      if (probs.length) issues.push(`${p.name}: ${probs[0].message}`);
    }
    if (issues.length) aviso = `&aviso=${enc("Atención con el nuevo horario: " + issues.join(" "))}`;
  }
  redirect(`${back}?ok=${enc("Servicio actualizado." + (changed && before.assignments.length ? " Se avisó a los servidores asignados." : ""))}${aviso}`);
}

export async function setServiceStatus(fd: FormData) {
  await requireSchedule();
  const id = str(fd, "id");
  const status = str(fd, "status") as ServiceStatus;
  if (!["PROGRAMADO", "REALIZADO", "CANCELADO"].includes(status)) return;
  const svc = await prisma.service.update({
    where: { id },
    data: { status },
    include: { assignments: { where: { status: { not: "CANCELADA" } } } },
  });
  if (status === "CANCELADO") {
    await releaseReserved({ serviceId: id });
    if (svc.requestId) await releaseReserved({ requestId: svc.requestId });
  }
  if (status === "CANCELADO")
    await notifyUsers(svc.assignments.map((a) => a.userId), `Se canceló el servicio "${svc.title}" del ${formatDateEs(svc.date)}. No tienes que asistir.`);
  if (status === "REALIZADO" && svc.requestId)
    await prisma.serviceRequest.update({ where: { id: svc.requestId }, data: { status: "EJECUTADA" } });
  revalidatePath(`/panel/programacion/${id}`);
  revalidatePath("/panel/programacion");
}

export async function assignServer(fd: FormData) {
  await requireSchedule();
  const serviceId = str(fd, "serviceId");
  const userId = str(fd, "userId");
  const areaId = str(fd, "areaId");
  const override = fd.get("override") === "on";
  const back = `/panel/programacion/${serviceId}`;
  function fail(m: string): never {
    return redirect(`${back}?error=${enc(m)}`);
  }

  const [svc, area] = await Promise.all([prisma.service.findUnique({ where: { id: serviceId } }), prisma.area.findUnique({ where: { id: areaId } })]);
  if (!svc || !area) fail("No se encontró el servicio o el área.");
  if (!userId) fail("Selecciona a la persona.");
  const [person] = await loadPeople([userId]);
  if (!person) fail("Esa persona no está activa.");

  const problems = problemsFor(person, areaId, svc!);
  const hard = problems.filter((p) => HARD.includes(p.code));
  if (hard.length) fail(`${person.name}: ${hard[0].message}`);
  if (problems.length && !override)
    fail(`${person.name}: ${problems[0].message} Si aun así quieres asignarla, marca “Asignar de todos modos”.`);

  await prisma.assignment.create({
    data: { serviceId, userId, areaId, functionNote: str(fd, "functionNote") || null },
  });
  await notifyUsers(
    [userId],
    `Nueva asignación: ${area!.name} en "${svc!.title}", ${formatDateEs(svc!.date)}, de ${svc!.startTime} a ${svc!.endTime}. Confírmala aquí: ${panelLink()}`,
  );
  redirect(`${back}?ok=${enc(`${person.name} fue asignada a ${area!.name} y recibirá un aviso.`)}`);
}

export async function removeAssignment(fd: FormData) {
  await requireSchedule();
  const a = await prisma.assignment.findUnique({ where: { id: str(fd, "id") }, include: { service: true, area: true } });
  if (!a) return;
  await prisma.$transaction([
    prisma.assignment.update({ where: { id: a.id }, data: { status: "CANCELADA" } }),
    prisma.assignmentChange.updateMany({
      where: { status: "PENDIENTE", type: { in: ["REEMPLAZO", "INTERCAMBIO"] }, OR: [{ assignmentId: a.id }, { targetAssignmentId: a.id }] },
      data: { status: "RETIRADO", resolvedAt: new Date(), response: "La asignación fue retirada por el ministerio." },
    }),
  ]);
  await notifyUsers([a.userId], `Se retiró tu asignación de ${a.area.name} en "${a.service.title}" (${formatDateEs(a.service.date)}).`);
  revalidatePath(`/panel/programacion/${a.serviceId}`);
}

// Registro de asistencia de un servidor a un servicio (lo alimenta el informe de asistencia y ausencias)
export async function setAttendance(fd: FormData) {
  await requireSchedule();
  const a = await prisma.assignment.findUnique({ where: { id: str(fd, "id") } });
  if (!a) return;
  const v = str(fd, "attendance");
  await prisma.assignment.update({ where: { id: a.id }, data: { attendance: v === "PRESENTE" || v === "AUSENTE" ? v : null } });
  revalidatePath(`/panel/programacion/${a.serviceId}`);
}

export async function resolveEmergency(fd: FormData) {
  await requireSchedule();
  const ch = await prisma.assignmentChange.update({
    where: { id: str(fd, "id") },
    data: { status: "RESUELTO", resolvedAt: new Date(), response: str(fd, "response") || null },
  });
  await notifyUsers([ch.requesterId], "El ministerio recibió tu reporte de emergencia y lo atendió.");
  revalidatePath("/panel/programacion");
  revalidatePath("/panel");
}

// Genera avisos de recordatorio para los servicios de los próximos días.
export async function generateReminders(fd: FormData) {
  await requireSchedule();
  const days = Math.min(Math.max(Number(str(fd, "days")) || 3, 1), 14);
  const count = await generateRemindersFor(days);
  redirect(`/panel/programacion?ok=${enc(count ? `Se generaron ${count} recordatorios. Si el envío automático está activo ya salieron; si no, envíalos desde “Avisos de WhatsApp”.` : "No hay recordatorios nuevos por generar.")}`);
}

/* =================== SERVIDOR: confirmar, reemplazos, intercambios =================== */

const BACK = "/panel/mis-asignaciones";
function failTo(m: string): never {
  return redirect(`${BACK}?error=${enc(m)}`);
}

export async function confirmAssignment(fd: FormData) {
  const s = await requireSession();
  await prisma.assignment.updateMany({
    where: { id: str(fd, "id"), userId: s.userId, status: "PENDIENTE" },
    data: { status: "CONFIRMADA", confirmedAt: new Date() },
  });
  revalidatePath(BACK);
  revalidatePath("/panel");
}

async function hasOpenChange(assignmentId: string) {
  return (
    (await prisma.assignmentChange.count({
      where: { status: "PENDIENTE", type: { in: ["REEMPLAZO", "INTERCAMBIO"] }, OR: [{ assignmentId }, { targetAssignmentId: assignmentId }] },
    })) > 0
  );
}

async function ownUpcoming(assignmentId: string, userId: string) {
  const a = await prisma.assignment.findUnique({ where: { id: assignmentId }, include: { service: true, area: true } });
  if (!a || a.userId !== userId || a.status === "CANCELADA") return failTo("No encontramos esa asignación.");
  if (a.service.status !== "PROGRAMADO" || a.service.date < toDateOnly(todayBogota())) return failTo("Ese servicio ya no admite cambios.");
  return a;
}

export async function requestReplacement(fd: FormData) {
  const s = await requireSession();
  const a = await ownUpcoming(str(fd, "assignmentId"), s.userId);
  const targetId = str(fd, "targetUserId");
  if (!targetId || targetId === s.userId) failTo("Selecciona a quién le pedirás el reemplazo.");
  if (await hasOpenChange(a.id)) failTo("Esta asignación ya tiene un cambio esperando respuesta.");

  const [target] = await loadPeople([targetId]);
  if (!target) return failTo("Esa persona no está activa.");
  const probs = problemsFor(target, a.areaId, a.service);
  if (probs.length) failTo(`${target.name} no puede cubrir este turno: ${probs[0].message}`);

  const reason = str(fd, "reason").slice(0, 500);
  await prisma.assignmentChange.create({
    data: { type: "REEMPLAZO", assignmentId: a.id, requesterId: s.userId, targetUserId: targetId, reason: reason || null },
  });
  await notifyUsers(
    [targetId],
    `${s.name} te pide que lo reemplaces en ${a.area.name} para "${a.service.title}", ${formatDateEs(a.service.date)}, de ${a.service.startTime} a ${a.service.endTime}.${reason ? ` Motivo: ${reason}.` : ""} Acepta o rechaza aquí: ${panelLink()}`,
  );
  redirect(`${BACK}?ok=${enc(`Le enviamos la solicitud a ${target.name}. Tu asignación sigue vigente hasta que acepte.`)}`);
}

export async function proposeSwap(fd: FormData) {
  const s = await requireSession();
  const mine = await ownUpcoming(str(fd, "assignmentId"), s.userId);
  const theirs = await prisma.assignment.findUnique({ where: { id: str(fd, "targetAssignmentId") }, include: { service: true, area: true, user: true } });
  if (!theirs || theirs.userId === s.userId || theirs.status === "CANCELADA") return failTo("Selecciona el turno con el que quieres intercambiar.");
  if (theirs.service.status !== "PROGRAMADO" || theirs.service.date < toDateOnly(todayBogota())) return failTo("Ese turno ya no admite cambios.");
  if ((await hasOpenChange(mine.id)) || (await hasOpenChange(theirs.id))) failTo("Alguno de los dos turnos ya tiene un cambio esperando respuesta.");

  const people = await loadPeople([s.userId, theirs.userId]);
  const me = people.find((p) => p.id === s.userId);
  const other = people.find((p) => p.id === theirs.userId);
  if (!me || !other) return failTo("Una de las personas no está activa.");
  const p1 = problemsFor(other, mine.areaId, mine.service, [theirs.id]);
  if (p1.length) failTo(`${other.name} no puede cubrir tu turno: ${p1[0].message}`);
  const p2 = problemsFor(me, theirs.areaId, theirs.service, [mine.id]);
  if (p2.length) failTo(`Tú no puedes cubrir ese turno: ${p2[0].message}`);

  const reason = str(fd, "reason").slice(0, 500);
  await prisma.assignmentChange.create({
    data: { type: "INTERCAMBIO", assignmentId: mine.id, targetAssignmentId: theirs.id, requesterId: s.userId, targetUserId: theirs.userId, reason: reason || null },
  });
  await notifyUsers(
    [theirs.userId],
    `${s.name} te propone un intercambio: tú cubrirías ${mine.area.name} en "${mine.service.title}" (${formatDateEs(mine.service.date)}, ${mine.service.startTime}) y ${s.name} cubriría tu turno de ${theirs.area.name} en "${theirs.service.title}" (${formatDateEs(theirs.service.date)}, ${theirs.service.startTime}).${reason ? ` Motivo: ${reason}.` : ""} Respóndele aquí: ${panelLink()}`,
  );
  redirect(`${BACK}?ok=${enc(`Le enviamos la propuesta a ${theirs.user.name}. Nada cambia hasta que la acepte.`)}`);
}

export async function respondChange(fd: FormData) {
  const s = await requireSession();
  const ch = await prisma.assignmentChange.findUnique({
    where: { id: str(fd, "id") },
    include: { assignment: { include: { service: true, area: true } }, targetAssignment: { include: { service: true, area: true } }, requester: true },
  });
  if (!ch || ch.status !== "PENDIENTE" || ch.targetUserId !== s.userId || ch.type === "EMERGENCIA") return failTo("Esa solicitud ya no está disponible.");
  const decision = str(fd, "decision");
  const response = str(fd, "response").slice(0, 300) || null;
  const now = new Date();

  if (decision !== "accept") {
    await prisma.assignmentChange.update({ where: { id: ch.id }, data: { status: "RECHAZADO", resolvedAt: now, response } });
    await notifyUsers([ch.requesterId], `${s.name} no pudo aceptar tu ${ch.type === "REEMPLAZO" ? "solicitud de reemplazo" : "propuesta de intercambio"}${response ? `: ${response}` : "."} Tu asignación sigue vigente; puedes buscar otra opción.`);
    redirect(`${BACK}?ok=Rechazaste la solicitud.`);
  }

  // Aceptar: se vuelve a validar todo, porque pudo cambiar algo desde que se propuso
  const stale = ch.assignment.userId !== ch.requesterId || ch.assignment.status === "CANCELADA";
  if (stale) {
    await prisma.assignmentChange.update({ where: { id: ch.id }, data: { status: "RETIRADO", resolvedAt: now, response: "La asignación cambió antes de responder." } });
    return failTo("Esa asignación cambió y la solicitud ya no es válida.");
  }
  const mine = ch.assignment;

  if (ch.type === "REEMPLAZO") {
    const [me] = await loadPeople([s.userId]);
    const probs = me ? problemsFor(me, mine.areaId, mine.service) : [{ code: "INACTIVO" as const, message: "No estás activo." }];
    if (probs.length) failTo(`No puedes aceptar: ${probs[0].message}`);
    await prisma.$transaction([
      prisma.assignment.update({ where: { id: mine.id }, data: { userId: s.userId, status: "CONFIRMADA", confirmedAt: now, reminderAt: null } }),
      prisma.assignmentChange.update({ where: { id: ch.id }, data: { status: "ACEPTADO", resolvedAt: now, response } }),
    ]);
    const msg = `${s.name} reemplaza a ${ch.requester.name} en ${mine.area.name} para "${mine.service.title}" (${formatDateEs(mine.service.date)}).`;
    await notifyUsers([ch.requesterId], `${s.name} aceptó reemplazarte en "${mine.service.title}". Ya no tienes ese turno.`);
    await notifyStaff(msg, s.userId);
    redirect(`${BACK}?ok=Aceptaste el reemplazo. El turno quedó confirmado a tu nombre.`);
  }

  // INTERCAMBIO
  const theirs = ch.targetAssignment;
  if (!theirs || theirs.userId !== s.userId || theirs.status === "CANCELADA") {
    await prisma.assignmentChange.update({ where: { id: ch.id }, data: { status: "RETIRADO", resolvedAt: now, response: "El turno cambió antes de responder." } });
    return failTo("Tu turno cambió y el intercambio ya no es válido.");
  }
  const people = await loadPeople([s.userId, ch.requesterId]);
  const me = people.find((p) => p.id === s.userId);
  const req = people.find((p) => p.id === ch.requesterId);
  if (!me || !req) return failTo("Una de las personas ya no está activa.");
  const p1 = problemsFor(me, mine.areaId, mine.service, [theirs.id]);
  if (p1.length) failTo(`No puedes aceptar: ${p1[0].message}`);
  const p2 = problemsFor(req, theirs.areaId, theirs.service, [mine.id]);
  if (p2.length) failTo(`${req.name} ya no puede cubrir tu turno: ${p2[0].message}`);

  await prisma.$transaction([
    prisma.assignment.update({ where: { id: mine.id }, data: { userId: s.userId, status: "CONFIRMADA", confirmedAt: now, reminderAt: null } }),
    prisma.assignment.update({ where: { id: theirs.id }, data: { userId: ch.requesterId, status: "CONFIRMADA", confirmedAt: now, reminderAt: null } }),
    prisma.assignmentChange.update({ where: { id: ch.id }, data: { status: "ACEPTADO", resolvedAt: now, response } }),
  ]);
  await notifyUsers([ch.requesterId], `${s.name} aceptó el intercambio. Ahora cubres ${theirs.area.name} en "${theirs.service.title}" (${formatDateEs(theirs.service.date)}).`);
  await notifyStaff(`Intercambio entre ${ch.requester.name} y ${s.name}: ${mine.area.name} en "${mine.service.title}" ↔ ${theirs.area.name} en "${theirs.service.title}".`, s.userId);
  redirect(`${BACK}?ok=Aceptaste el intercambio. Ambos turnos se actualizaron.`);
}

export async function withdrawChange(fd: FormData) {
  const s = await requireSession();
  await prisma.assignmentChange.updateMany({
    where: { id: str(fd, "id"), requesterId: s.userId, status: "PENDIENTE", type: { in: ["REEMPLAZO", "INTERCAMBIO"] } },
    data: { status: "RETIRADO", resolvedAt: new Date() },
  });
  revalidatePath(BACK);
}

// Excepción: el servidor no puede cancelar solo, pero sí avisar de una emergencia al coordinador y líderes.
export async function reportEmergency(fd: FormData) {
  const s = await requireSession();
  const a = await ownUpcoming(str(fd, "assignmentId"), s.userId);
  const message = str(fd, "message").slice(0, 600);
  if (message.length < 5) failTo("Cuéntanos brevemente qué pasó.");
  await prisma.assignmentChange.create({ data: { type: "EMERGENCIA", assignmentId: a.id, requesterId: s.userId, reason: message } });
  await notifyStaff(
    `EMERGENCIA: ${s.name} no podrá cumplir ${a.area.name} en "${a.service.title}" (${formatDateEs(a.service.date)}, ${a.service.startTime}). Motivo: ${message}. Ábrelo aquí: ${siteUrl()}/panel/programacion/${a.serviceId}`,
  );
  redirect(`${BACK}?ok=Avisamos al coordinador y a los líderes. Ellos se comunicarán contigo.`);
}
