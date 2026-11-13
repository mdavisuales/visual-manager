import SiteHero from "@/components/SiteHero";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatDateEs } from "@/lib/dates";
import { LOCATION_LABEL, STATUS_LABEL, STATUS_MESSAGE, STATUS_STYLE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Seguimiento({ searchParams }: { searchParams: { codigo?: string } }) {
  const settings = await getSettings();
  const codigo = (searchParams.codigo ?? "").trim().toUpperCase();
  const req = codigo ? await prisma.serviceRequest.findUnique({ where: { code: codigo } }) : null;

  return (
    <main>
      <SiteHero title="Consultar solicitud" subtitle="Escribe el código que recibiste al enviar tu solicitud." />
      <section className="mx-auto max-w-xl px-5 pb-20">
        <form className="mb-8 flex flex-col items-center gap-6">
          <label className="block w-full">
            <span className="label">Código de seguimiento</span>
            <input name="codigo" defaultValue={codigo} placeholder="VM-XXXXXX" className="input uppercase" required />
          </label>
          <button className="btn-hero">Consultar</button>
        </form>

        {codigo && !req && (
          <p role="alert" className="rounded-2xl bg-red-50 p-4 text-center text-sm font-medium text-red-800">
            No encontramos ninguna solicitud con ese código. Revisa que esté escrito igual que en tu confirmación.
          </p>
        )}

        {req && (
          <div className="space-y-4 rounded-2xl border border-ink/10 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-bold">{req.activityName}</h2>
              <span className={`badge ${STATUS_STYLE[req.status]}`}>{STATUS_LABEL[req.status]}</span>
            </div>
            <p className="font-light">{STATUS_MESSAGE[req.status]}</p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-semibold uppercase text-ink/60">Fecha</dt><dd>{formatDateEs(req.eventDate)}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-ink/60">Horario</dt><dd>{req.startTime} a {req.endTime}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-ink/60">Lugar</dt><dd>{LOCATION_LABEL[req.locationType]}</dd></div>
              <div><dt className="text-xs font-semibold uppercase text-ink/60">Código</dt><dd>{req.code}</dd></div>
            </dl>
            {req.late && (
              <p className="rounded-md bg-lamp p-3 text-sm">
                Esta solicitud llegó con menos de {settings.min_days} días de anticipación, por lo que su atención está sujeta a la disponibilidad de personal y equipos.
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
