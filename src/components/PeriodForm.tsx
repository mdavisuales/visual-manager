import type { Period } from "@/lib/periods";

type Sp = Record<string, string | undefined>;

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

// Selector de período: mensual, trimestral, semestral, anual o personalizado
export default function PeriodForm({ sp, period, action = "/panel/estadisticas" }: { sp: Sp; period: Period; action?: string }) {
  const year = sp.anio ?? period.start.slice(0, 4);
  return (
    <form action={action} className="card space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="label">Período</span>
          <select name="tipo" defaultValue={period.type} className="input">
            <option value="mensual">Mensual</option>
            <option value="trimestral">Trimestral</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
            <option value="personalizado">Personalizado</option>
          </select>
        </label>
        <label><span className="label">Año</span><input name="anio" type="number" min={2000} max={2100} defaultValue={year} className="input" /></label>
        <label>
          <span className="label">Mes (mensual)</span>
          <select name="mes" defaultValue={sp.mes ?? String(Number(period.start.slice(5, 7)))} className="input">
            {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Trimestre</span>
          <select name="trimestre" defaultValue={sp.trimestre ?? "1"} className="input">
            {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Trimestre {q}</option>)}
          </select>
        </label>
        <label>
          <span className="label">Semestre</span>
          <select name="semestre" defaultValue={sp.semestre ?? "1"} className="input">
            <option value="1">Primer semestre</option>
            <option value="2">Segundo semestre</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label><span className="label">Desde</span><input name="desde" type="date" defaultValue={sp.desde ?? ""} className="input" /></label>
          <label><span className="label">Hasta</span><input name="hasta" type="date" defaultValue={sp.hasta ?? ""} className="input" /></label>
        </div>
      </div>
      <p className="text-xs text-ink/60">Solo se usan los campos que corresponden al tipo de período elegido (desde/hasta, solo en “Personalizado”).</p>
      <button className="btn-dark">Ver estadísticas</button>
    </form>
  );
}
