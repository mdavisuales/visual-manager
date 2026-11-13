import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { permissionSet } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { todayBogota, toDateOnly, addDays, formatShortDate, formatDateEs } from "@/lib/dates";
import { STATUS_LABEL, STATUS_STYLE, ASSIGNMENT_LABEL, ASSIGNMENT_STYLE } from "@/lib/constants";
import Flash from "@/components/Flash";
import BirthdayList from "@/components/BirthdayList";
import { upcomingBirthdays } from "@/lib/birthdays";

export const dynamic = "force-dynamic";

function Stat({ label, value, href, alert }: { label: string; value: number; href?: string; alert?: boolean }) {
  const body = (
    <div className={`card h-full ${alert && value > 0 ? "border-amber-400 bg-amber-50" : ""}`}>
      <p className="font-display text-4xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-ink/70">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function Resumen({ searchParams }: { searchParams: { sinpermiso?: string } }) {
  const s = await requireSession();
  const perms = await permissionSet(s.role);
  const today = toDateOnly(todayBogota());
  const in7 = toDateOnly(addDays(todayBogota(), 7));

  // Los servidores nuevos deben hacer primero el test de habilidades
  if (s.role === "SERVIDOR" && (await prisma.testResult.count({ where: { userId: s.userId } })) === 0) redirect("/panel/test");

  const seeRequests = perms.has("solicitudes.ver");
  const seeSchedule = perms.has("programacion.ver");
  const seeInv = perms.has("inventario.ver");
  const upcomingFilter = { status: { not: "CANCELADA" as const }, service: { status: "PROGRAMADO" as const, date: { gte: today } } };

  const [pendientes, tardias, proximas, servidores, avisos, mine, incoming, servicios7, porConfirmar, emergencias, sinAsignar, fuera, vencidos, novedades, faltantes] = await Promise.all([
    seeRequests ? prisma.serviceRequest.count({ where: { status: "PENDIENTE" } }) : 0,
    seeRequests ? prisma.serviceRequest.count({ where: { late: true, status: { in: ["PENDIENTE", "EN_REVISION"] } } }) : 0,
    seeRequests
      ? prisma.serviceRequest.findMany({
          where: { eventDate: { gte: today }, status: { in: ["PENDIENTE", "EN_REVISION", "APROBADA"] } },
          orderBy: [{ eventDate: "asc" }, { startTime: "asc" }],
          take: 5,
        })
      : [],
    prisma.user.count({ where: { role: "SERVIDOR", active: true } }),
    perms.has("avisos.gestionar") ? prisma.notification.count({ where: { sent: false, link: { not: "" } } }) : 0,
    prisma.assignment.findMany({
      where: { userId: s.userId, ...upcomingFilter },
      include: { service: true, area: true },
      orderBy: [{ service: { date: "asc" } }, { service: { startTime: "asc" } }],
      take: 4,
    }),
    prisma.assignmentChange.count({ where: { targetUserId: s.userId, status: "PENDIENTE" } }),
    seeSchedule ? prisma.service.count({ where: { status: "PROGRAMADO", date: { gte: today, lte: in7 } } }) : 0,
    seeSchedule ? prisma.assignment.count({ where: { status: "PENDIENTE", service: { status: "PROGRAMADO", date: { gte: today } } } }) : 0,
    seeSchedule ? prisma.assignmentChange.count({ where: { type: "EMERGENCIA", status: "PENDIENTE" } }) : 0,
    seeSchedule ? prisma.service.count({ where: { status: "PROGRAMADO", date: { gte: today }, assignments: { none: { status: { not: "CANCELADA" } } } } }) : 0,
    seeInv ? prisma.equipment.aggregate({ where: { active: true }, _sum: { qtyDamaged: true, qtyMaintenance: true } }) : null,
    seeInv ? prisma.equipmentLoan.count({ where: { returnedAt: null, expectedReturn: { lt: today } } }) : 0,
    seeInv ? prisma.techIssue.count({ where: { status: "ABIERTA" } }) : 0,
    seeRequests && seeInv
      ? prisma.serviceRequest.count({ where: { status: { in: ["PENDIENTE", "EN_REVISION", "APROBADA"] }, eventDate: { gte: today }, picks: { none: {} } } })
      : 0,
  ]);

  const birthdays = perms.has("usuarios.ver") ? (await upcomingBirthdays(30)).slice(0, 8) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Hola, {s.name.split(" ")[0]}</h1>
      {searchParams.sinpermiso && <Flash error="No tienes permiso para entrar a esa sección. Pídele al coordinador que te lo habilite." />}

      {(incoming > 0 || mine.some((a) => a.status === "PENDIENTE")) && (
        <Link href="/panel/mis-asignaciones" className="block rounded-xl border border-amber-400 bg-amber-50 p-4 text-sm font-medium">
          Tienes {incoming > 0 ? `${incoming} solicitud(es) de cambio por responder` : "asignaciones por confirmar"}. Toca aquí para revisarlas.
        </Link>
      )}

      <section className="card">
        <h2 className="mb-3 text-lg font-bold">Mis próximos turnos</h2>
        {mine.length === 0 ? (
          <p className="text-sm text-ink/70">No tienes turnos próximos.</p>
        ) : (
          <ul className="divide-y divide-ink/10">
            {mine.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span>
                  <span className="block font-medium">{a.service.title}</span>
                  <span className="text-ink/70">
                    {formatShortDate(a.service.date)}, {a.service.startTime} a {a.service.endTime} · {a.area.name}
                  </span>
                </span>
                <span className={`badge ${ASSIGNMENT_STYLE[a.status]}`}>{ASSIGNMENT_LABEL[a.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {birthdays.length > 0 && (
        <section className="card">
          <h2 className="mb-1 text-lg font-bold">Próximos cumpleaños</h2>
          <p className="mb-2 text-xs text-ink/60">Para tenerlos en cuenta: un saludo, una oración, un detalle.</p>
          <BirthdayList list={birthdays} />
        </section>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {seeRequests && <Stat label="Solicitudes pendientes" value={pendientes} href="/panel/solicitudes?estado=PENDIENTE" />}
        {seeRequests && <Stat label="Poca anticipación, sin resolver" value={tardias} href="/panel/solicitudes?estado=PENDIENTE" alert />}
        {seeSchedule && <Stat label="Servicios en los próximos 7 días" value={servicios7} href="/panel/programacion" />}
        {seeSchedule && <Stat label="Asignaciones por confirmar" value={porConfirmar} href="/panel/programacion" alert />}
        {seeSchedule && <Stat label="Servicios sin servidores" value={sinAsignar} href="/panel/programacion" alert />}
        {seeSchedule && <Stat label="Emergencias abiertas" value={emergencias} href="/panel/programacion" alert />}
        {seeInv && <Stat label="Unidades dañadas o en mantenimiento" value={(fuera?._sum.qtyDamaged ?? 0) + (fuera?._sum.qtyMaintenance ?? 0)} href="/panel/inventario?estado=danado" alert />}
        {seeInv && <Stat label="Préstamos vencidos" value={vencidos} href="/panel/inventario/prestamos" alert />}
        {seeInv && <Stat label="Novedades técnicas abiertas" value={novedades} href="/panel/novedades" alert />}
        {seeInv && seeRequests && <Stat label="Solicitudes próximas sin lista de equipos" value={faltantes} href="/panel/solicitudes" alert />}
        <Stat label="Servidores activos" value={servidores} />
        {perms.has("avisos.gestionar") && <Stat label="Avisos de WhatsApp por enviar" value={avisos} href="/panel/avisos" alert />}
      </div>

      {seeRequests && (
        <section className="card">
          <h2 className="mb-3 text-lg font-bold">Próximas solicitudes</h2>
          {proximas.length === 0 ? (
            <p className="text-sm text-ink/70">No hay solicitudes próximas.</p>
          ) : (
            <ul className="divide-y divide-ink/10">
              {proximas.map((r) => (
                <li key={r.id}>
                  <Link href={`/panel/solicitudes/${r.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-fog/60">
                    <span>
                      <span className="block font-medium">{r.activityName}</span>
                      <span className="text-sm text-ink/70">
                        {formatDateEs(r.eventDate)}, {r.startTime} a {r.endTime}
                      </span>
                    </span>
                    <span className={`badge ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <p className="text-sm text-ink/60">WhatsApp automático, estadísticas e informes, y formación se activan en las siguientes fases.</p>
    </div>
  );
}
