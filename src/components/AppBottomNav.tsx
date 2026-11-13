"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  turnos: (<><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M8 2v4M16 2v4M3 10h18M9 16l2 2 4-4" /></>),
  disponibilidad: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  avisos: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />,
  mas: <path d="M4 6h16M4 12h16M4 18h16" />,
};

type Item = { href: string; label: string; icon: keyof typeof ICONS; badge?: number };

export default function AppBottomNav({ incoming, unread }: { incoming: number; unread: number }) {
  const path = usePathname();
  const items: Item[] = [
    { href: "/panel", label: "Inicio", icon: "home" },
    { href: "/panel/mis-asignaciones", label: "Turnos", icon: "turnos", badge: incoming },
    { href: "/panel/disponibilidad", label: "Disponib.", icon: "disponibilidad" },
    { href: "/panel/notificaciones", label: "Avisos", icon: "avisos", badge: unread },
    { href: "/panel/mas", label: "Más", icon: "mas" },
  ];
  return (
    <nav aria-label="Navegación de la app" className="fixed inset-x-0 bottom-0 z-20 flex border-t border-ink/10 bg-white shadow-[0_-4px_16px_rgba(3,22,96,0.08)]">
      {items.map((it) => {
        const active = it.href === "/panel" ? path === "/panel" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[0.68rem] font-medium ${active ? "text-brand" : "text-ink/60"}`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {ICONS[it.icon]}
            </svg>
            {it.label}
            {!!it.badge && it.badge > 0 && (
              <span className="absolute right-[26%] top-1 min-w-[1.1rem] rounded-full bg-brand px-1 text-center text-[0.65rem] font-bold leading-[1.1rem] text-white">{it.badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
