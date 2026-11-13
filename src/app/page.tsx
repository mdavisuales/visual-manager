import Link from "next/link";
import RequestForm from "@/components/RequestForm";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { todayBogota, formatDateEs, toDateOnly } from "@/lib/dates";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [requirements, settings] = await Promise.all([
    prisma.techRequirement.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, description: true },
    }),
    getSettings(),
  ]);
  const today = todayBogota();
  const minDays = Number(settings.min_days) || 15;

  return (
    <main>
      {/* Degradado: #031660 → #2848c0 → #6f87e1 → #ffffff */}
      <section className="bg-hero px-5 pb-24 pt-16 text-center sm:pt-24">
        <h1 className="font-display text-[clamp(3rem,12vw,7rem)] font-extrabold leading-none tracking-tight text-white">VISUALES MDA</h1>
        <p className="mt-2 font-body text-[clamp(1.35rem,4vw,2.6rem)] font-extralight text-white">{settings.tagline}</p>

        <div className="mt-14 flex flex-col items-center gap-6 sm:mt-20">
          <Link href="/login" className="btn-hero">Conectarse</Link>
          <Link href="/seguimiento" className="btn-hero">Consultar solicitud</Link>
        </div>

        <h2 id="solicitud" className="mt-24 font-body text-[clamp(1.8rem,5vw,2.8rem)] font-light text-ink sm:mt-32">Solicita apoyo técnico</h2>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24 pt-4 sm:px-8">
        <RequestForm requirements={requirements} today={today} todayLabel={formatDateEs(toDateOnly(today))} minDays={minDays} warning={settings.late_warning} />
      </section>

      <footer className="border-t border-ink/10 py-6 text-center text-xs font-light text-ink/60">{settings.org_name}</footer>
    </main>
  );
}
