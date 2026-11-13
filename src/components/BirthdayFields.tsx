import { MESES } from "@/lib/birthday-utils";

// Cumpleaños: solo día y mes
export default function BirthdayFields({ month, day }: { month?: number | null; day?: number | null }) {
  return (
    <fieldset>
      <legend className="label">Cumpleaños (día y mes)</legend>
      <div className="grid grid-cols-2 gap-3">
        <select name="birthMonth" defaultValue={month ? String(month) : ""} className="input" aria-label="Mes">
          <option value="">Mes</option>
          {MESES.map((m, i) => (
            <option key={m} value={i + 1}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
          ))}
        </select>
        <input name="birthDay" type="number" min={1} max={31} defaultValue={day ?? ""} placeholder="Día" className="input" aria-label="Día" />
      </div>
      <p className="hint">Solo se guarda el día y el mes, no el año.</p>
    </fieldset>
  );
}
