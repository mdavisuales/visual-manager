import Link from "next/link";
import { RequestStatus } from "@prisma/client";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatDateEs } from "@/lib/dates";
import { LOCATION_LABEL, STATUS_LABEL, STATUS_STYLE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Solicitudes({ searchParams }: { searchParams: { estado?: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "solicitudes.ver");
  const estado = searchParams.estado && searchParams.estado in RequestStatus ? (searchParams.estado as RequestStatus) : undefined;

  const list = await prisma.serviceRequest.findMany({
    where: estado ? { status: estado } : {},
    orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-sm font-medium ${active ? "bg-navy text-white" : "bg-white text-ink hover:bg-fog border border-ink/10"}`;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Solicitudes</h1>
      <div className="flex flex-wrap gap-2">
        <Link href="/panel/solicitudes" className={chip(!estado)}>Todas</Link>
        {Object.entries(STATUS_LABEL).map(([k, v]) => (
          <Link key={k} href={`/panel/solicitudes?estado=${k}`} className={chip(estado === k)}>{v}</Link>
        ))}
      </div>

      {list.length === 0 ? (
        <p className="card text-sm text-ink/70">No hay solicitudes con este filtro.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((r) => (
            <li key={r.id}>
              <Link href={`/panel/solicitudes/${r.id}`} className="card flex flex-wrap items-start justify-between gap-3 hover:border-ink/40">
                <span className="min-w-0">
                  <span className="block font-bold">{r.activityName}</span>
                  <span className="block text-sm text-ink/70">{r.ministry} · {r.organizerName}</span>
                  <span className="block text-sm">
                    {formatDateEs(r.eventDate)}, {r.startTime} a {r.endTime} · {LOCATION_LABEL[r.locationType]}
                  </span>
                  <span className="text-xs text-ink/50">{r.code}</span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className={`badge ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  {r.late && <span className="badge bg-amber-100 text-amber-900">Poca anticipación</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
