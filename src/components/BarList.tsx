// Gráfico de barras horizontales sencillo (sin librerías)
export default function BarList({ title, data }: { title: string; data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <section className="card space-y-2">
      <h3 className="font-display text-base font-bold">{title}</h3>
      {data.every((d) => d.value === 0) ? (
        <p className="text-sm text-ink/60">Sin datos en el período.</p>
      ) : (
        <ul className="space-y-1.5">
          {data.map((d) => (
            <li key={d.label} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-2 text-sm">
              <span className="truncate" title={d.label}>{d.label}</span>
              <span className="h-3 overflow-hidden rounded bg-fog">
                <span className="block h-full bg-royal" style={{ width: `${(d.value / max) * 100}%` }} />
              </span>
              <span className="text-right font-bold">{d.value}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
