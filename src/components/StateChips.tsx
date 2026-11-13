import { STATE_META, type StateCounts } from "@/lib/inventory";

export default function StateChips({ counts, total }: { counts: StateCounts; total: number }) {
  return (
    <span className="flex flex-wrap gap-1.5">
      {STATE_META.filter((m) => counts[m.key] > 0 || (m.key === "disponible" && total > 0)).map((m) => (
        <span key={m.key} className={`badge ${m.style}`}>
          {counts[m.key]} {m.label.toLowerCase()}
        </span>
      ))}
    </span>
  );
}
