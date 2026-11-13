import Link from "next/link";

// Encabezado degradado compacto para las páginas públicas secundarias (consulta y acceso)
export default function SiteHero({ title, subtitle, home = true }: { title: string; subtitle?: string; home?: boolean }) {
  return (
    <section className="bg-hero px-5 pb-14 pt-8 text-center">
      {home ? (
        <Link href="/" className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
          VISUALES MDA
        </Link>
      ) : (
        <p className="font-display text-2xl font-extrabold tracking-tight text-white sm:text-3xl">VISUALES MDA</p>
      )}
      <h1 className="mt-14 font-body text-3xl font-light text-ink sm:text-4xl">{title}</h1>
      {subtitle && <p className="mx-auto mt-2 max-w-xl text-sm font-light text-ink/80">{subtitle}</p>}
    </section>
  );
}
