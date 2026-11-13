import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { formatDateTimeEs } from "@/lib/dates";
import Flash from "@/components/Flash";

export const dynamic = "force-dynamic";

export default async function Informes({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "informes.ver");
  const list = await prisma.report.findMany({ orderBy: { createdAt: "desc" }, include: { createdBy: true }, take: 100 });

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Informes ministeriales</h1>
        <Link href="/panel/estadisticas" className="btn-primary">Generar un informe</Link>
      </div>
      <Flash error={searchParams.error} ok={searchParams.ok} />
      {list.length === 0 ? (
        <p className="card text-sm text-ink/70">Aún no has generado informes. Elige un período en Estadísticas y pulsa “Generar informe”.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((r) => (
            <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
              <Link href={`/panel/informes/${r.id}`} className="min-w-0">
                <span className="block font-bold underline">{r.title}</span>
                <span className="text-sm text-ink/60">Generado {formatDateTimeEs(r.createdAt)} por {r.createdBy.name}</span>
              </Link>
              <span className="flex gap-2">
                <a href={`/api/informes/${r.id}/pdf`} className="btn-dark">PDF</a>
                <a href={`/api/informes/${r.id}/excel`} className="btn-ghost">Excel</a>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
