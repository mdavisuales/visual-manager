"use server";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { periodFromParams } from "@/lib/periods";
import { computeStats } from "@/lib/stats";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const text = (fd: FormData, k: string) => str(fd, k).slice(0, 4000) || null;

export async function createReport(fd: FormData) {
  const s = await requireSession();
  await requirePermission(s.role, "informes.ver");
  const period = periodFromParams({
    tipo: str(fd, "tipo"),
    anio: str(fd, "anio"),
    mes: str(fd, "mes"),
    trimestre: str(fd, "trimestre"),
    semestre: str(fd, "semestre"),
    desde: str(fd, "desde"),
    hasta: str(fd, "hasta"),
  });
  const stats = await computeStats(period);
  const r = await prisma.report.create({
    data: {
      title: `Informe ministerial – ${period.label}`,
      periodType: period.type,
      startDate: new Date(`${period.start}T00:00:00.000Z`),
      endDate: new Date(`${period.end}T00:00:00.000Z`),
      achievements: text(fd, "achievements"),
      needs: text(fd, "needs"),
      observations: text(fd, "observations"),
      data: stats as unknown as Prisma.InputJsonValue,
      createdById: s.userId,
    },
  });
  redirect(`/panel/informes/${r.id}?ok=${encodeURIComponent("Informe generado. Ya puedes descargarlo en PDF o Excel.")}`);
}

export async function updateReportNotes(fd: FormData) {
  const s = await requireSession();
  await requirePermission(s.role, "informes.ver");
  const id = str(fd, "id");
  await prisma.report.update({ where: { id }, data: { achievements: text(fd, "achievements"), needs: text(fd, "needs"), observations: text(fd, "observations") } });
  redirect(`/panel/informes/${id}?ok=${encodeURIComponent("Textos actualizados. Los archivos que descargues desde ahora los incluyen.")}`);
}

export async function refreshReport(fd: FormData) {
  const s = await requireSession();
  await requirePermission(s.role, "informes.ver");
  const id = str(fd, "id");
  const r = await prisma.report.findUniqueOrThrow({ where: { id } });
  const old = r.data as unknown as { period: ReturnType<typeof periodFromParams> };
  const stats = await computeStats(old.period);
  await prisma.report.update({ where: { id }, data: { data: stats as unknown as Prisma.InputJsonValue } });
  redirect(`/panel/informes/${id}?ok=${encodeURIComponent("Cifras recalculadas con los datos de hoy.")}`);
}

export async function deleteReport(fd: FormData) {
  const s = await requireSession();
  if (s.role !== "COORDINADOR") redirect("/panel?sinpermiso=1");
  await prisma.report.delete({ where: { id: str(fd, "id") } });
  redirect(`/panel/informes?ok=${encodeURIComponent("Informe eliminado.")}`);
}
