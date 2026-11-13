"use server";
import { Prisma, type LocationType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { todayBogota, diffDays, toDateOnly } from "@/lib/dates";
import { generateCode } from "@/lib/codes";
import { notifyNewRequest } from "@/lib/notify";
import { LOCATION_LABEL } from "@/lib/constants";
import type { FormState } from "@/lib/types";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function createRequest(_prev: FormState, fd: FormData): Promise<FormState> {
  // Campo trampa: si un bot lo llena, se descarta en silencio.
  if (str(fd, "website")) return { ok: false, message: "No se pudo enviar la solicitud." };

  const activityName = str(fd, "activityName");
  const ministry = str(fd, "ministry");
  const organizerName = str(fd, "organizerName");
  const whatsapp = str(fd, "whatsapp");
  const eventDate = str(fd, "eventDate");
  const startTime = str(fd, "startTime");
  const endTime = str(fd, "endTime");
  const locationType = str(fd, "locationType");
  const address = str(fd, "address");
  const attendeesRaw = str(fd, "attendees");
  const observations = str(fd, "observations");

  const today = todayBogota();
  const errors: Record<string, string> = {};

  if (activityName.length < 3) errors.activityName = "Escribe el nombre de la actividad.";
  if (ministry.length < 2) errors.ministry = "Indica el ministerio responsable.";
  if (organizerName.length < 3) errors.organizerName = "Escribe el nombre del organizador.";
  if (whatsapp.replace(/\D/g, "").length < 10) errors.whatsapp = "Escribe un número de WhatsApp válido (mínimo 10 dígitos).";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) errors.eventDate = "Selecciona la fecha del evento.";
  else if (eventDate < today) errors.eventDate = "La fecha del evento no puede ser anterior a hoy.";

  const timeRe = /^\d{2}:\d{2}$/;
  if (!timeRe.test(startTime)) errors.startTime = "Indica la hora de inicio.";
  if (!timeRe.test(endTime)) errors.endTime = "Indica la hora de finalización.";
  if (!errors.startTime && !errors.endTime && endTime <= startTime)
    errors.endTime = "La hora de finalización debe ser posterior a la de inicio.";

  if (!(locationType in LOCATION_LABEL)) errors.locationType = "Selecciona una ubicación.";
  else if (locationType === "FUERA_IGLESIA" && address.length < 5) errors.address = "Escribe la dirección del lugar.";

  let attendees: number | null = null;
  if (attendeesRaw) {
    const n = Number(attendeesRaw);
    if (!Number.isInteger(n) || n < 0 || n > 100000) errors.attendees = "Escribe un número válido.";
    else attendees = n;
  }
  if (observations.length > 3000) errors.observations = "Máximo 3000 caracteres.";

  if (Object.keys(errors).length > 0) return { ok: false, errors, message: "Revisa los campos marcados." };

  const settings = await getSettings();
  const minDays = Number(settings.min_days) || 15;
  const daysAhead = diffDays(today, eventDate);
  const late = daysAhead < minDays;

  const ids = fd.getAll("requirements").map(String);
  const validReqs = ids.length
    ? await prisma.techRequirement.findMany({ where: { id: { in: ids }, active: true }, select: { id: true } })
    : [];

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode();
    try {
      const created = await prisma.serviceRequest.create({
        data: {
          code,
          activityName,
          ministry,
          organizerName,
          whatsapp,
          eventDate: toDateOnly(eventDate),
          startTime,
          endTime,
          locationType: locationType as LocationType,
          address: locationType === "FUERA_IGLESIA" ? address : null,
          attendees,
          observations: observations || null,
          daysAhead,
          late,
          requirements: { connect: validReqs.map((r) => ({ id: r.id })) },
        },
      });
      try {
        await notifyNewRequest(created, minDays);
      } catch (err) {
        console.error("No se pudieron crear los avisos:", err);
      }
      return { ok: true, code, late, daysAhead };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue; // código repetido
      console.error(err);
      return { ok: false, message: "No pudimos guardar tu solicitud. Inténtalo de nuevo en unos minutos." };
    }
  }
  return { ok: false, message: "No pudimos generar el código de seguimiento. Inténtalo de nuevo." };
}
