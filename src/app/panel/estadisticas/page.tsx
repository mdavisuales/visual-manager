import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { periodFromParams } from "@/lib/periods";
import { computeStats, pct } from "@/lib/stats";
import { executiveSummary } from "@/lib/report-text";
import { STATUS_LABEL, SERVICE_LABEL } from "@/lib/constants";
import PeriodForm from "@/components/PeriodForm";
import BarList from "@/components/BarList";
import { createReport } from "../reports-actions";

export const dynamic = "force-dynamic";

type Sp = { tipo?: string; anio?: string; mes?: string; trimestre?: string; semestre?: string; desde?: string; hasta?: string };

const fp = (v: number | null) => (v === null ? "—" : `${String(v).replace(".", ",")} %`);

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card">
      <p className="font-display text-3xl font-bold">{value}</p>
      <p className="mt-1 text-sm text-ink/70">{label}</p>
    </div>
  );
}

export default async function Estadisticas({ searchParams }: { searchParams: Sp }) {
  const s = await requireSession();
  await requirePermission(s.role, "informes.ver");
  const period = periodFromParams(searchParams);
  const st = await computeStats(period);
  const t = st.team;
  const i = st.inventory;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Estadísticas</h1>
        <Link href="/panel/informes" className="btn-ghost">Informes generados</Link>
      </div>
      <PeriodForm sp={searchParams} period={period} />
      <p className="font-display text-xl font-bold">{period.label}</p>

      <section className="card space-y-2 text-sm leading-relaxed">
        <h2 className="text-lg font-bold">Resumen</h2>
        {executiveSummary(st).map((p, k) => <p key={k}>{p}</p>)}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Solicitudes recibidas" value={st.requests.received} />
        <Kpi label="Servicios en el período" value={st.services.total} />
        <Kpi label="Asignaciones" value={t.assignments.total} />
        <Kpi label="Servidores activos" value={t.activeServers} />
        <Kpi label="Tasa de confirmación" value={fp(t.confirmationRate)} />
        <Kpi label="Tasa de asistencia" value={fp(t.attendanceRate)} />
        <Kpi label="Reemplazos e intercambios" value={st.changes.replacements.total + st.changes.swaps.total} />
        <Kpi label="Emergencias reportadas" value={st.changes.emergencies.total} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <BarList title="Solicitudes por estado" data={Object.keys(STATUS_LABEL).map((k) => ({ label: STATUS_LABEL[k], value: st.requests.byStatus[k] ?? 0 }))} />
        <BarList title="Servicios por estado" data={Object.keys(SERVICE_LABEL).map((k) => ({ label: SERVICE_LABEL[k], value: st.services.byStatus[k] ?? 0 }))} />
        <BarList title="Asistencia" data={[{ label: "Presentes", value: t.attendance.presentes }, { label: "Ausentes", value: t.attendance.ausentes }, { label: "Sin registrar", value: t.attendance.sinRegistro }]} />
        <BarList title="Ministerios que más solicitan" data={st.requests.byMinistry.slice(0, 8).map((m) => ({ label: m.name, value: m.count }))} />
        <BarList
          title="Estado de las unidades (hoy)"
          data={[
            { label: "Disponibles", value: i.states.disponible },
            { label: "En uso", value: i.states.enUso },
            { label: "Prestadas", value: i.states.prestado },
            { label: "En mantenimiento", value: i.states.mantenimiento },
            { label: "Dañadas", value: i.states.danado },
          ]}
        />
        <BarList title="Servidores con más asignaciones" data={t.perServer.slice(0, 8).map((p) => ({ label: p.name, value: p.asignados }))} />
      </div>

      <section className="card space-y-2 text-sm">
        <h2 className="text-lg font-bold">Inventario y novedades en el período</h2>
        <p>
          Préstamos: <strong>{i.loansInPeriod}</strong> · Devueltos: <strong>{i.loansReturned}</strong> · Vencidos hoy: <strong>{i.overdueNow}</strong> · Unidades nuevas con daños: <strong>{i.newDamaged}</strong> · A mantenimiento:{" "}
          <strong>{i.sentToMaintenance}</strong> · Novedades: <strong>{i.issues.reported}</strong> ({i.issues.resolved} atendidas)
        </p>
        {st.training && (
          <p>
            Formación: <strong>{st.training.list.length}</strong> capacitaciones ({st.training.held} realizadas) · <strong>{st.training.participants}</strong> participaciones · finalización{" "}
            <strong>{fp(st.training.completionRate)}</strong>
          </p>
        )}
        <p className="text-ink/60">Confirmación = asignaciones confirmadas / asignaciones del período. Asistencia = presentes / (presentes + ausentes registrados por coordinación o líderes en cada servicio).</p>
      </section>

      <form action={createReport} className="card space-y-4">
        <h2 className="text-lg font-bold">Generar informe ministerial</h2>
        <p className="text-sm text-ink/70">
          Guarda una copia de las cifras de <strong>{period.label}</strong> y te deja descargarla en PDF (con portada, resumen, tablas y gráficos) y en Excel. Puedes escribir ahora los logros, necesidades y
          observaciones, o completarlos después.
        </p>
        {(["tipo", "anio", "mes", "trimestre", "semestre", "desde", "hasta"] as const).map((k) => (searchParams[k] ? <input key={k} type="hidden" name={k} value={searchParams[k]} /> : null))}
        <label className="block"><span className="label">Logros del período</span><textarea name="achievements" rows={4} className="input" /></label>
        <label className="block"><span className="label">Necesidades</span><textarea name="needs" rows={3} className="input" /></label>
        <label className="block"><span className="label">Observaciones relevantes</span><textarea name="observations" rows={3} className="input" /></label>
        <button className="btn-primary">Generar informe</button>
      </form>
    </div>
  );
}
