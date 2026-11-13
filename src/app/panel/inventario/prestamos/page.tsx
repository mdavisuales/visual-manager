import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { can, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { todayBogota, toDateOnly, formatDateEs, formatDateTimeEs } from "@/lib/dates";
import InventoryTabs from "@/components/InventoryTabs";
import Flash from "@/components/Flash";
import { returnLoan } from "../../inventory-actions";

export const dynamic = "force-dynamic";

export default async function Prestamos({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "inventario.ver");
  const manage = await can(s.role, "inventario.gestionar");
  const pkgs = await can(s.role, "paquetes.gestionar");
  const today = toDateOnly(todayBogota());
  const [open, closed] = await Promise.all([
    prisma.equipmentLoan.findMany({ where: { returnedAt: null }, include: { equipment: true, authorizedBy: true }, orderBy: { expectedReturn: "asc" } }),
    prisma.equipmentLoan.findMany({ where: { returnedAt: { not: null } }, include: { equipment: true }, orderBy: { returnedAt: "desc" }, take: 15 }),
  ]);

  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold">Préstamos</h1>
      <InventoryTabs current="prestamos" packages={true} />
      <Flash error={searchParams.error} ok={searchParams.ok} />
      <p className="text-sm text-ink/70">Para prestar un equipo, entra a su ficha en <Link href="/panel/inventario" className="underline">Equipos</Link>.</p>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Pendientes de devolución</h2>
        {open.length === 0 && <p className="card text-sm text-ink/70">No hay préstamos abiertos.</p>}
        {open.map((l) => {
          const overdue = l.expectedReturn < today;
          return (
            <div key={l.id} className={`card space-y-2 text-sm ${overdue ? "border-red-300 bg-red-50" : ""}`}>
              <p>
                <Link href={`/panel/inventario/${l.equipmentId}`} className="font-bold underline">{l.equipment.name}</Link> · {l.quantity} u. · con <strong>{l.receivedBy}</strong>
              </p>
              <p>Entregado {formatDateTimeEs(l.loanedAt)} · autorizó {l.authorizedBy.name}</p>
              <p className={overdue ? "font-bold text-red-800" : ""}>Devolución prevista: {formatDateEs(l.expectedReturn)}{overdue ? " (vencido)" : ""}</p>
              {manage && (
                <form action={returnLoan} className="grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-end">
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="from" value="list" />
                  <label><span className="label">Unidades con daños</span><input name="damaged" type="number" min={0} max={l.quantity} defaultValue={0} className="input w-28" /></label>
                  <label><span className="label">Observaciones</span><input name="returnNote" className="input" /></label>
                  <button className="btn-dark">Registrar devolución</button>
                </form>
              )}
            </div>
          );
        })}
      </section>

      {closed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xl font-bold">Devueltos recientemente</h2>
          <ul className="divide-y divide-ink/10 rounded-xl border border-ink/10 bg-white text-sm">
            {closed.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 p-3">
                <span>{l.equipment.name} · {l.quantity} u. · {l.receivedBy}{l.returnNote ? ` · ${l.returnNote}` : ""}</span>
                <span className="text-ink/60">{l.returnedAt ? formatDateTimeEs(l.returnedAt) : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
