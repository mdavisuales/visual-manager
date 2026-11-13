import Link from "next/link";

export default function InventoryTabs({ current, packages }: { current: "equipos" | "prestamos" | "paquetes"; packages: boolean }) {
  const tab = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium ${active ? "bg-navy text-white" : "border border-ink/10 bg-white hover:bg-fog"}`;
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Inventario">
      <Link href="/panel/inventario" className={tab(current === "equipos")}>Equipos</Link>
      <Link href="/panel/inventario/prestamos" className={tab(current === "prestamos")}>Préstamos</Link>
      {packages && <Link href="/panel/inventario/paquetes" className={tab(current === "paquetes")}>Paquetes técnicos</Link>}
    </nav>
  );
}
