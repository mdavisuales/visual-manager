"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const active = href === "/panel" ? path === "/panel" : path.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium ${
        active ? "bg-white font-semibold text-navy" : "text-white/85 hover:bg-white/15"
      }`}
    >
      {children}
    </Link>
  );
}
