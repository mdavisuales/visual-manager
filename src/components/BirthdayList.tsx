import Link from "next/link";
import type { Birthday } from "@/lib/birthdays";
import { whenText } from "@/lib/birthday-utils";
import { formatShortDate, toDateOnly } from "@/lib/dates";

export default function BirthdayList({ list, link = true }: { list: Birthday[]; link?: boolean }) {
  return (
    <ul className="divide-y divide-ink/10 text-sm">
      {list.map((b) => (
        <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <span>
            {link ? <Link href={`/panel/equipo/${b.id}`} className="font-medium underline">{b.name}</Link> : <span className="font-medium">{b.name}</span>}
            <span className="ml-2 text-ink/60">{formatShortDate(toDateOnly(b.date))}</span>
          </span>
          <span className={`badge ${b.daysUntil === 0 ? "bg-lamp text-ink" : "bg-fog"}`}>{whenText(b.daysUntil)}</span>
        </li>
      ))}
    </ul>
  );
}
