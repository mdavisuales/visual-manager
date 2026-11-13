import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { isoDay } from "@/lib/dates";
import { buildPdf } from "@/lib/report-pdf";
import { buildXlsx } from "@/lib/report-xlsx";
import type { Stats } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Descarga del informe en PDF o Excel. Exige sesión y permiso (el middleware solo cubre /panel).
export async function GET(_req: NextRequest, { params }: { params: { id: string; format: string } }) {
  const s = await getSession();
  if (!s) return new NextResponse("No autorizado", { status: 401 });
  if (!(await can(s.role, "informes.ver"))) return new NextResponse("Sin permiso", { status: 403 });
  if (!["pdf", "excel"].includes(params.format)) return new NextResponse("Formato no válido", { status: 404 });

  const r = await prisma.report.findUnique({ where: { id: params.id } });
  if (!r) return new NextResponse("No encontrado", { status: 404 });
  const settings = await getSettings();
  const input = {
    orgName: settings.org_name,
    title: r.title,
    createdAt: r.createdAt,
    achievements: r.achievements,
    needs: r.needs,
    observations: r.observations,
    stats: r.data as unknown as Stats,
  };
  const base = `informe-ministerial_${isoDay(r.startDate)}_a_${isoDay(r.endDate)}`;

  try {
    const isPdf = params.format === "pdf";
    const bytes = isPdf ? await buildPdf(input) : await buildXlsx(input);
    return new NextResponse(bytes as unknown as BodyInit, {
      headers: {
        "Content-Type": isPdf ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.${isPdf ? "pdf" : "xlsx"}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Error generando el informe:", err);
    return new NextResponse("No se pudo generar el archivo", { status: 500 });
  }
}
