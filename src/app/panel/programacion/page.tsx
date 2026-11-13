import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { can, requirePermission } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { todayBogota, toDateOnly, addDays, startOfWeek, monthBounds, isoDay, formatDateEs, formatShortDate, DIAS } from "@/lib/dates";
import { LOCATION_LABEL, SERVICE_LABEL } from "@/lib/constants";
import Flash from "@/components/Flash";
import { generateReminders, resolveEmergency } from "../schedule-actions";

export const dynamic = "force-dynamic";

export default async function Programacion({ searchParams }: { searchParams: { vista?: string; fecha?: string; ok?: string; error?: string } }) {
  const s = await requireSession();
  await requirePermission(s.role, "programacion.ver");
  const manage = await can(s.role, "programacion.gestionar");

  const today = todayBogota();
  const vista = ["dia", "semana", "mes"].includes(searchParams.vista ?? "") ? (searchParams.vista as string) : "semana";
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.fecha ?? "") ? (searchParams.fecha as string) : today;

  let start = fecha;
  let end = fecha;
  let prev = addDays(fecha, -1);
  let next = addDays(fecha, 1);
  if (vista === "semana") {
    start = startOfWeek(fecha);
    end = addDays(start, 6);
    prev = addDays(start, -7);
    next = addDays(start, 7);
  } else if (vista === "mes") {
    const b = monthBounds(fecha);
    start = b.first;
    end = b.last;
    prev = addDays(b.first, -1);
    next = addDays(b.last, 1);
  }

  const [services, emergencies] = await Promise.all([
    prisma.service.findMany({
      where: { date: { gte: toDateOnly(start), lte: toDateOnly(end) } },
      include: { assignments: { where: { status: { not: "CANCELADA" } }, include: { user: true, area: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.assignmentChange.findMany({
      where: { type: "EMERGENCIA", status: "PENDIENTE" },
      include: { requester: true, assignment: { include: { service: true, area: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const byDay = new Map<string, typeof services>();
  for (const sv of services) {
    const k = isoDay(sv.date);
    byDay.set(k, [...(byDay.get(k) ?? []), sv]);
  }

  const link = (v: string, f: string) => `/panel/programacion?vista=${v}&fecha=${f}`;
  const chip = (a: boolean) => `rounded-full px-3 py-1 text-sm font-medium ${a ? "bg-navy text-white" : "border border-ink/10 bg-white hover:bg-fog"}`;

  const title =
    vista === "mes"
      ? toDateOnly(start).toLocaleDateString("es-CO", { timeZone: "UTC", month: "long", year: "numeric" })
      : vista === "semana"
        ? `${formatShortDate(toDateOnly(start))} – ${formatShortDate(toDateOnly(end))}`
        : formatDateEs(toDateOnly(fecha));

  const Card = ({ sv }: { sv: (typeof services)[number] }) => {
    const pending = sv.assignments.filter((a) => a.status === "PENDIENTE").length;
    return (
      <Link href={`/panel/programacion/${sv.id}`} className={`card block hover:border-ink/40 ${sv.status === "CANCELADO" ? "opacity-60" : ""}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-bold">{sv.title}</p>
            <p className="text-sm">{sv.startTime} a {sv.endTime} · {LOCATION_LABEL[sv.locationType]}</p>
          </div>
          {sv.status !== "PROGRAMADO" && <span className="badge bg-slate-200 text-slate-800">{SERVICE_LABEL[sv.status]}</span>}
        </div>
        <p className="mt-2 text-sm text-ink/70">
          {sv.assignments.length === 0 ? "Sin servidores asignados" : sv.assignments.map((a) => `${a.user.name.split(" ")[0]} (${a.area.name})`).join(", ")}
        </p>
        {pending > 0 && <p className="mt-1 text-xs font-medium text-amber-800">{pending} por confirmar</p>}
      </Link>
    );
  };

  // Cuadrícula del mes (lunes a domingo)
  const gridStart = startOfWeek(start);
  const cells: string[] = [];
  for (let d = gridStart; d <= end || cells.length % 7 !== 0; d = addDays(d, 1)) cells.push(d);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Programación</h1>
        {manage && <Link href="/panel/programacion/nuevo" className="btn-primary">Nuevo servicio</Link>}
      </div>
      <Flash error={searchParams.error} ok={searchParams.ok} />

      {emergencies.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-red-900">Emergencias por atender</h2>
          {emergencies.map((e) => (
            <div key={e.id} className="card space-y-2 border-red-300 bg-red-50 text-sm">
              <p>
                <strong>{e.requester.name}</strong> no podrá cumplir <strong>{e.assignment.area.name}</strong> en{" "}
                <Link className="underline" href={`/panel/programacion/${e.assignment.serviceId}`}>{e.assignment.service.title}</Link> ({formatShortDate(e.assignment.service.date)}, {e.assignment.service.startTime}).
              </p>
              <p>Motivo: {e.reason}</p>
              {manage && (
                <form action={resolveEmergency} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={e.id} />
                  <input name="response" className="input max-w-sm" placeholder="Nota (opcional)" />
                  <button className="btn-dark">Marcar como atendida</button>
                </form>
              )}
            </div>
          ))}
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {["dia", "semana", "mes"].map((v) => (
          <Link key={v} href={link(v, fecha)} className={chip(vista === v)}>{v === "dia" ? "Día" : v === "semana" ? "Semana" : "Mes"}</Link>
        ))}
        <span className="mx-2 hidden h-5 w-px bg-navy/20 sm:block" />
        <Link href={link(vista, prev)} className="btn-ghost" aria-label="Anterior">←</Link>
        <Link href={link(vista, today)} className="btn-ghost">Hoy</Link>
        <Link href={link(vista, next)} className="btn-ghost" aria-label="Siguiente">→</Link>
        <span className="ml-1 font-display text-lg font-bold capitalize">{title}</span>
      </div>

      {vista === "mes" && (
        <div className="hidden overflow-hidden rounded-xl border border-ink/10 bg-white md:block">
          <div className="grid grid-cols-7 border-b border-ink/10 bg-fog text-center text-xs font-bold">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => <div key={d} className="py-2">{DIAS[d]}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((c) => {
              const inMonth = c >= start && c <= end;
              const list = byDay.get(c) ?? [];
              return (
                <div key={c} className={`min-h-28 border-b border-r border-ink/5 p-1.5 ${inMonth ? "" : "bg-fog/50 text-ink/40"}`}>
                  <Link href={link("dia", c)} className={`text-xs font-bold ${c === today ? "rounded bg-lamp px-1.5" : ""}`}>{Number(c.slice(8))}</Link>
                  <div className="mt-1 space-y-1">
                    {list.map((sv) => (
                      <Link key={sv.id} href={`/panel/programacion/${sv.id}`} className={`block truncate rounded bg-navy px-1.5 py-0.5 text-xs text-white ${sv.status === "CANCELADO" ? "line-through opacity-50" : ""}`}>
                        {sv.startTime} {sv.title}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className={vista === "mes" ? "space-y-4 md:hidden" : "space-y-4"}>
        {services.length === 0 && <p className="card text-sm text-ink/70">No hay servicios en este período.</p>}
        {Array.from(byDay.entries()).map(([day, list]) => (
          <section key={day} className="space-y-2">
            <h2 className="font-display text-lg font-bold capitalize">{formatDateEs(toDateOnly(day))}</h2>
            {list.map((sv) => <Card key={sv.id} sv={sv} />)}
          </section>
        ))}
      </div>

      {manage && (
        <form action={generateReminders} className="card flex flex-wrap items-end gap-3">
          <label>
            <span className="label">Generar recordatorios para los próximos</span>
            <select name="days" defaultValue="3" className="input">
              {[1, 2, 3, 5, 7].map((d) => <option key={d} value={d}>{d} día{d > 1 ? "s" : ""}</option>)}
            </select>
          </label>
          <button className="btn-dark">Generar recordatorios</button>
          <p className="basis-full text-xs text-ink/60">Crea un aviso por cada servidor con servicio en ese período. Se envían desde “Avisos de WhatsApp”.</p>
        </form>
      )}
    </div>
  );
}
