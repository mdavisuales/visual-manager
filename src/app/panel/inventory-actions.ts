"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { toDateOnly, formatDateEs } from "@/lib/dates";
import { notifyStaff, siteUrl } from "@/lib/notify";
import { consolidate, loadPicks, availability, issuesText, logMove, releaseReserved, currentUsage, stateCounts, type Owner } from "@/lib/inventory";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const int = (fd: FormData, k: string, fallback = 0) => {
  const n = Number(str(fd, k));
  return Number.isInteger(n) ? n : fallback;
};
const enc = encodeURIComponent;

function go(path: string, kind: "ok" | "error", msg: string): never {
  return redirect(`${path}${path.includes("?") ? "&" : "?"}${kind}=${enc(msg)}`);
}

async function gate(key: string) {
  const s = await requireSession();
  await requirePermission(s.role, key);
  return s;
}

/* =================== EQUIPOS =================== */
export async function createEquipment(fd: FormData) {
  const s = await gate("inventario.gestionar");
  const name = str(fd, "name");
  const quantity = int(fd, "quantity", 1);
  if (name.length < 2) go("/panel/inventario/nuevo", "error", "Escribe el nombre del equipo.");
  if (quantity < 1 || quantity > 10000) go("/panel/inventario/nuevo", "error", "La cantidad debe ser de 1 en adelante.");
  const e = await prisma.equipment.create({
    data: {
      name,
      categoryId: str(fd, "categoryId") || null,
      brand: str(fd, "brand") || null,
      model: str(fd, "model") || null,
      quantity,
      location: str(fd, "location") || null,
      notes: str(fd, "notes") || null,
    },
  });
  await logMove(e.id, "REGISTRO", quantity, "Equipo registrado en el inventario", s.userId);
  go(`/panel/inventario/${e.id}`, "ok", "Equipo registrado.");
}

export async function updateEquipment(fd: FormData) {
  const s = await gate("inventario.gestionar");
  const id = str(fd, "id");
  const back = `/panel/inventario/${id}`;
  const e = await prisma.equipment.findUnique({ where: { id } });
  if (!e) return redirect("/panel/inventario");
  const name = str(fd, "name");
  const quantity = int(fd, "quantity", e.quantity);
  if (name.length < 2) go(back, "error", "Escribe el nombre del equipo.");
  if (quantity < 1) go(back, "error", "La cantidad debe ser de 1 en adelante.");
  if (quantity < e.qtyMaintenance + e.qtyDamaged) go(back, "error", "La cantidad no puede ser menor que las unidades dañadas y en mantenimiento.");
  await prisma.equipment.update({
    where: { id },
    data: {
      name,
      categoryId: str(fd, "categoryId") || null,
      brand: str(fd, "brand") || null,
      model: str(fd, "model") || null,
      quantity,
      location: str(fd, "location") || null,
      notes: str(fd, "notes") || null,
      active: fd.get("active") === "on",
    },
  });
  await logMove(id, "EDICION", quantity, quantity !== e.quantity ? `Cantidad: ${e.quantity} → ${quantity}` : "Datos actualizados", s.userId);
  go(back, "ok", "Equipo actualizado.");
}

// Unidades en mantenimiento o dañadas. Quedan en el historial con la observación.
export async function setEquipmentState(fd: FormData) {
  const s = await gate("inventario.gestionar");
  const id = str(fd, "id");
  const back = `/panel/inventario/${id}`;
  const e = await prisma.equipment.findUnique({ where: { id } });
  if (!e) return redirect("/panel/inventario");
  const maintenance = int(fd, "qtyMaintenance", -1);
  const damaged = int(fd, "qtyDamaged", -1);
  const note = str(fd, "note").slice(0, 500);
  if (maintenance < 0 || damaged < 0) go(back, "error", "Escribe cantidades válidas (0 o más).");
  if (maintenance + damaged > e.quantity) go(back, "error", `Entre dañadas y en mantenimiento no puede haber más de ${e.quantity} unidades.`);
  if (maintenance === e.qtyMaintenance && damaged === e.qtyDamaged) go(back, "error", "No cambiaste ninguna cantidad.");
  await prisma.equipment.update({ where: { id }, data: { qtyMaintenance: maintenance, qtyDamaged: damaged } });
  await logMove(id, "ESTADO", 0, `Mantenimiento: ${e.qtyMaintenance} → ${maintenance}; dañadas: ${e.qtyDamaged} → ${damaged}${note ? `. ${note}` : ""}`, s.userId, {
    damaged: damaged - e.qtyDamaged,
    maintenance: maintenance - e.qtyMaintenance,
  });
  go(back, "ok", "Estado actualizado.");
}

/* =================== CATEGORÍAS =================== */
export async function addCategory(fd: FormData) {
  await gate("inventario.gestionar");
  const name = str(fd, "name");
  if (!name) return;
  const last = await prisma.equipmentCategory.aggregate({ _max: { sortOrder: true } });
  await prisma.equipmentCategory.create({ data: { name, sortOrder: (last._max.sortOrder ?? 0) + 1 } });
  revalidatePath("/panel/inventario");
}
export async function renameCategory(fd: FormData) {
  await gate("inventario.gestionar");
  const name = str(fd, "name");
  if (!name) return;
  await prisma.equipmentCategory.update({ where: { id: str(fd, "id") }, data: { name } });
  revalidatePath("/panel/inventario");
}
export async function deleteCategory(fd: FormData) {
  await gate("inventario.gestionar");
  await prisma.equipmentCategory.delete({ where: { id: str(fd, "id") } }); // los equipos quedan "sin categoría"
  revalidatePath("/panel/inventario");
}

/* =================== PRÉSTAMOS =================== */
export async function createLoan(fd: FormData) {
  const s = await gate("inventario.gestionar");
  const equipmentId = str(fd, "equipmentId");
  const back = `/panel/inventario/${equipmentId}`;
  const quantity = int(fd, "quantity", 0);
  const receivedBy = str(fd, "receivedBy");
  const authorizedById = str(fd, "authorizedById") || s.userId;
  const expected = str(fd, "expectedReturn");
  const loanedRaw = str(fd, "loanedAt");

  const e = await prisma.equipment.findUnique({ where: { id: equipmentId } });
  if (!e || !e.active) go(back, "error", "El equipo no está disponible para préstamo.");
  if (receivedBy.length < 3) go(back, "error", "Escribe el nombre de quien recibe el equipo.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expected)) go(back, "error", "Indica la fecha prevista de devolución.");
  if (quantity < 1) go(back, "error", "Indica cuántas unidades se prestan.");
  const authorizer = await prisma.user.findFirst({ where: { id: authorizedById, active: true } });
  if (!authorizer) go(back, "error", "Selecciona quién autoriza el préstamo.");

  // Colombia no tiene horario de verano: siempre UTC-5
  const loanedAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(loanedRaw) ? new Date(`${loanedRaw}:00-05:00`) : new Date();
  if (toDateOnly(expected) < toDateOnly(loanedAt.toISOString().slice(0, 10))) go(back, "error", "La devolución prevista no puede ser anterior a la entrega.");

  const free = stateCounts(e!, (await currentUsage([equipmentId])).get(equipmentId)).disponible;
  if (quantity > free) go(back, "error", `Solo hay ${free} unidad(es) libre(s) ahora mismo (el resto está prestado, en uso, dañado o en mantenimiento).`);

  const loan = await prisma.equipmentLoan.create({
    data: { equipmentId, quantity, receivedBy, authorizedById, loanedAt, expectedReturn: toDateOnly(expected), notes: str(fd, "notes") || null },
  });
  await logMove(equipmentId, "PRESTAMO", quantity, `Prestado a ${receivedBy}, autorizó ${authorizer!.name}; devolución prevista ${formatDateEs(loan.expectedReturn)}`, s.userId);
  go(back, "ok", "Préstamo registrado.");
}

export async function returnLoan(fd: FormData) {
  const s = await gate("inventario.gestionar");
  const loan = await prisma.equipmentLoan.findUnique({ where: { id: str(fd, "id") } });
  if (!loan || loan.returnedAt) return redirect("/panel/inventario/prestamos");
  const back = str(fd, "from") === "list" ? "/panel/inventario/prestamos" : `/panel/inventario/${loan.equipmentId}`;
  const damaged = Math.min(Math.max(int(fd, "damaged", 0), 0), loan.quantity);
  const note = str(fd, "returnNote").slice(0, 500);
  await prisma.equipmentLoan.update({ where: { id: loan.id }, data: { returnedAt: new Date(), returnNote: note || null } });
  if (damaged > 0) {
    const e = await prisma.equipment.findUniqueOrThrow({ where: { id: loan.equipmentId } });
    const newDamaged = Math.min(e.qtyDamaged + damaged, e.quantity - e.qtyMaintenance);
    await prisma.equipment.update({ where: { id: e.id }, data: { qtyDamaged: newDamaged } });
  }
  await logMove(loan.equipmentId, "DEVOLUCION", loan.quantity, `Devuelto por ${loan.receivedBy}${damaged ? `; ${damaged} con daños` : "; en buen estado"}${note ? `. ${note}` : ""}`, s.userId, { damaged });
  go(back, "ok", damaged ? "Devolución registrada. Las unidades con daños quedaron como dañadas." : "Devolución registrada.");
}

/* =================== PAQUETES TÉCNICOS =================== */
export async function createPackage(fd: FormData) {
  await gate("paquetes.gestionar");
  const name = str(fd, "name");
  if (name.length < 2) go("/panel/inventario/paquetes", "error", "Escribe el nombre del paquete.");
  const p = await prisma.techPackage.create({ data: { name, description: str(fd, "description") || null } });
  go(`/panel/inventario/paquetes/${p.id}`, "ok", "Paquete creado. Agrega los equipos que lo componen.");
}

export async function updatePackage(fd: FormData) {
  await gate("paquetes.gestionar");
  const id = str(fd, "id");
  const name = str(fd, "name");
  if (name.length < 2) go(`/panel/inventario/paquetes/${id}`, "error", "Escribe el nombre del paquete.");
  await prisma.techPackage.update({ where: { id }, data: { name, description: str(fd, "description") || null, active: fd.get("active") === "on" } });
  go(`/panel/inventario/paquetes/${id}`, "ok", "Paquete actualizado.");
}

export async function deletePackage(fd: FormData) {
  await gate("paquetes.gestionar");
  await prisma.techPackage.delete({ where: { id: str(fd, "id") } });
  go("/panel/inventario/paquetes", "ok", "Paquete eliminado.");
}

export async function savePackageItem(fd: FormData) {
  await gate("paquetes.gestionar");
  const packageId = str(fd, "packageId");
  const equipmentId = str(fd, "equipmentId");
  const quantity = int(fd, "quantity", 0);
  const back = `/panel/inventario/paquetes/${packageId}`;
  if (!equipmentId) go(back, "error", "Selecciona un equipo.");
  if (quantity < 1 || quantity > 10000) go(back, "error", "La cantidad debe ser de 1 en adelante.");
  await prisma.packageItem.upsert({
    where: { packageId_equipmentId: { packageId, equipmentId } },
    update: { quantity },
    create: { packageId, equipmentId, quantity },
  });
  go(back, "ok", "Paquete actualizado.");
}

export async function removePackageItem(fd: FormData) {
  await gate("paquetes.gestionar");
  const item = await prisma.packageItem.delete({ where: { id: str(fd, "id") } });
  go(`/panel/inventario/paquetes/${item.packageId}`, "ok", "Equipo quitado del paquete.");
}

/* =================== LISTA DE EQUIPOS DE UN EVENTO =================== */
function readOwner(fd: FormData): { owner: Owner; back: string } {
  const type = str(fd, "ownerType");
  const id = str(fd, "ownerId");
  const back = str(fd, "returnTo");
  // Solo se vuelve a páginas internas conocidas
  if (!/^\/panel\/(solicitudes|programacion)\/[\w-]+$/.test(back) || !id) return redirect("/panel");
  return { owner: type === "request" ? { requestId: id } : { serviceId: id }, back };
}

async function eventOf(owner: Owner) {
  if (owner.requestId) {
    const r = await prisma.serviceRequest.findUnique({ where: { id: owner.requestId }, include: { service: true } });
    if (!r) return null;
    // Si la solicitud ya se programó como servicio, manda la fecha y el horario del servicio
    const src = r.service ?? { date: r.eventDate, startTime: r.startTime, endTime: r.endTime };
    return { date: src.date, startTime: src.startTime, endTime: src.endTime, label: r.activityName };
  }
  const v = await prisma.service.findUnique({ where: { id: owner.serviceId } });
  return v ? { date: v.date, startTime: v.startTime, endTime: v.endTime, label: v.title } : null;
}

export async function addPick(fd: FormData) {
  await gate("reservas.gestionar");
  const { owner, back } = readOwner(fd);
  const kind = str(fd, "kind");
  const refId = str(fd, "refId");
  const quantity = Math.max(1, Math.min(int(fd, "quantity", 1), 1000));
  if (!refId) go(back, "error", "Selecciona qué quieres agregar.");
  const where = { ...(owner.requestId ? { requestId: owner.requestId } : { serviceId: owner.serviceId }), ...(kind === "package" ? { packageId: refId } : { equipmentId: refId }) };
  const existing = await prisma.equipmentPick.findFirst({ where });
  if (existing) await prisma.equipmentPick.update({ where: { id: existing.id }, data: { quantity: existing.quantity + quantity } });
  else await prisma.equipmentPick.create({ data: { ...where, quantity } });
  go(back, "ok", "Agregado a la lista del evento.");
}

export async function removePick(fd: FormData) {
  await gate("reservas.gestionar");
  const { back } = readOwner(fd);
  await prisma.equipmentPick.delete({ where: { id: str(fd, "id") } });
  go(back, "ok", "Quitado de la lista.");
}

// Reserva toda la lista consolidada. Si algo no alcanza se advierte y hay que confirmar para reservar igual.
export async function reserveList(fd: FormData) {
  const s = await gate("reservas.gestionar");
  const { owner, back } = readOwner(fd);
  const ev = await eventOf(owner);
  if (!ev) go(back, "error", "No se encontró el evento.");

  const lines = consolidate(await loadPicks(owner));
  if (lines.length === 0) go(back, "error", "La lista está vacía: agrega paquetes o equipos primero.");
  const av = await availability(lines.map((l) => l.equipmentId), ev!, owner);
  const short = lines.filter((l) => (av.get(l.equipmentId)?.available ?? 0) < l.needed);
  if (short.length > 0 && fd.get("force") !== "on")
    go(back, "error", `Hay equipos que no alcanzan: ${short.map((l) => l.name).join(", ")}. Revisa la tabla o marca “Reservar de todos modos”.`);

  const busyUse = await prisma.equipmentReservation.count({ where: { ...(owner.requestId ? { requestId: owner.requestId } : { serviceId: owner.serviceId }), status: "EN_USO" } });
  if (busyUse > 0) go(back, "error", "Hay equipos de este evento marcados en uso. Devuélvelos antes de rehacer la reserva.");

  await releaseReserved(owner);
  await prisma.equipmentReservation.createMany({
    data: lines.map((l) => ({
      equipmentId: l.equipmentId,
      quantity: l.needed,
      ...(owner.requestId ? { requestId: owner.requestId } : { serviceId: owner.serviceId }),
      date: ev!.date,
      startTime: ev!.startTime,
      endTime: ev!.endTime,
    })),
  });
  for (const l of lines) await logMove(l.equipmentId, "RESERVA", l.needed, `Reservado para “${ev!.label}” (${formatDateEs(ev!.date)})`, s.userId);
  go(back, "ok", short.length ? "Reservado, con equipos que no alcanzan: gestiona el faltante." : "Equipos reservados para el evento.");
}

export async function releaseList(fd: FormData) {
  const s = await gate("reservas.gestionar");
  const { owner, back } = readOwner(fd);
  const ev = await eventOf(owner);
  const rows = await prisma.equipmentReservation.findMany({ where: { ...(owner.requestId ? { requestId: owner.requestId } : { serviceId: owner.serviceId }), status: "RESERVADO" } });
  await releaseReserved(owner);
  for (const r of rows) await logMove(r.equipmentId, "LIBERACION", r.quantity, `Reserva liberada de “${ev?.label ?? "evento"}”`, s.userId);
  go(back, "ok", "Reservas liberadas.");
}

// Pasar todo el evento a "en uso" y luego a "devuelto"
export async function setListStatus(fd: FormData) {
  const s = await gate("reservas.gestionar");
  const { owner, back } = readOwner(fd);
  const to = str(fd, "to");
  const from = to === "EN_USO" ? "RESERVADO" : "EN_USO";
  if (!["EN_USO", "DEVUELTO"].includes(to)) return redirect(back);
  const ev = await eventOf(owner);
  const where = { ...(owner.requestId ? { requestId: owner.requestId } : { serviceId: owner.serviceId }), status: from as "RESERVADO" | "EN_USO" };
  const rows = await prisma.equipmentReservation.findMany({ where });
  if (rows.length === 0) go(back, "error", to === "EN_USO" ? "No hay equipos reservados para pasar a uso." : "No hay equipos en uso para devolver.");
  await prisma.equipmentReservation.updateMany({ where, data: { status: to as "EN_USO" | "DEVUELTO" } });
  for (const r of rows)
    await logMove(r.equipmentId, to === "EN_USO" ? "EN_USO" : "FIN_USO", r.quantity, `${to === "EN_USO" ? "En uso en" : "Devuelto de"} “${ev?.label ?? "evento"}”`, s.userId);
  go(back, "ok", to === "EN_USO" ? "Equipos marcados en uso." : "Equipos devueltos al inventario. Si alguno volvió con daños, regístralo en su ficha.");
}

/* =================== NOVEDADES TÉCNICAS =================== */
export async function reportIssue(fd: FormData) {
  const s = await requireSession();
  const description = str(fd, "description").slice(0, 1000);
  if (description.length < 5) go("/panel/novedades", "error", "Cuéntanos brevemente qué pasó.");
  const equipmentId = str(fd, "equipmentId") || null;
  const eq = equipmentId ? await prisma.equipment.findUnique({ where: { id: equipmentId } }) : null;
  await prisma.techIssue.create({ data: { description, equipmentId: eq?.id ?? null, reporterId: s.userId } });
  await notifyStaff(
    `Novedad técnica de ${s.name}${eq ? ` sobre ${eq.name}` : ""}: ${description}. Revísala aquí: ${siteUrl()}/panel/novedades`,
    s.userId,
  );
  go("/panel/novedades", "ok", "Reporte enviado. El ministerio lo revisará.");
}

export async function resolveIssue(fd: FormData) {
  await gate("inventario.gestionar");
  await prisma.techIssue.update({
    where: { id: str(fd, "id") },
    data: { status: "RESUELTA", resolvedAt: new Date(), response: str(fd, "response").slice(0, 500) || null },
  });
  revalidatePath("/panel/novedades");
  revalidatePath("/panel");
}
