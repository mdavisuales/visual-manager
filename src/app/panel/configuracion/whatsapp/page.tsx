import Link from "next/link";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { apiConfigured } from "@/lib/whatsapp-api";
import Flash from "@/components/Flash";
import { saveWhatsappSettings, sendTestMessage } from "../../whatsapp-actions";

export const dynamic = "force-dynamic";

const yes = (v: boolean) => (v ? <span className="badge bg-emerald-100 text-emerald-900">Listo</span> : <span className="badge bg-amber-100 text-amber-900">Falta</span>);

export default async function WhatsappConfig({ searchParams }: { searchParams: { ok?: string; error?: string } }) {
  const s = await requireSession();
  if (s.role !== "COORDINADOR") redirect("/panel?sinpermiso=1");
  const st = await getSettings();
  const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "https://TU-SITIO";
  const env = [
    ["WHATSAPP_TOKEN", !!process.env.WHATSAPP_TOKEN, "Token permanente de Meta"],
    ["WHATSAPP_PHONE_NUMBER_ID", !!process.env.WHATSAPP_PHONE_NUMBER_ID, "ID del número en Meta"],
    ["WHATSAPP_TEMPLATE_NAME", !!process.env.WHATSAPP_TEMPLATE_NAME, "Nombre de la plantilla aprobada"],
    ["WHATSAPP_APP_SECRET", !!process.env.WHATSAPP_APP_SECRET, "Para validar los avisos de entrega (webhook)"],
    ["WHATSAPP_VERIFY_TOKEN", !!process.env.WHATSAPP_VERIFY_TOKEN, "Clave que escribes al registrar el webhook"],
    ["CRON_SECRET", !!process.env.CRON_SECRET, "Para los recordatorios y reintentos automáticos"],
  ] as const;
  const configured = apiConfigured();

  return (
    <div className="max-w-3xl space-y-6">
      <Link href="/panel/configuracion" className="text-sm underline">← Volver a configuración</Link>
      <h1 className="text-3xl font-bold">WhatsApp</h1>
      <Flash error={searchParams.error} ok={searchParams.ok} />

      <section className="card space-y-2 text-sm">
        <p>
          <strong>Modo actual:</strong> {st.whatsapp_mode === "api" ? "automático (API oficial de WhatsApp)" : "manual (enlaces de WhatsApp, gratis)"}.
        </p>
        <p className="text-ink/70">
          En modo manual, los avisos quedan en la cola de “Avisos de WhatsApp” y alguien los envía con un toque. En modo automático salen solos desde el número del ministerio; si un
          envío falla, vuelve a esa cola para que no se pierda.
        </p>
      </section>

      <form action={saveWhatsappSettings} className="card space-y-4">
        <h2 className="text-lg font-bold">Envío y recordatorios</h2>
        <label className="block">
          <span className="label">Modo de envío</span>
          <select name="whatsapp_mode" defaultValue={st.whatsapp_mode} className="input">
            <option value="manual">Manual (enlaces de WhatsApp, sin costo)</option>
            <option value="api">Automático (API oficial de WhatsApp, con costo por mensaje)</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Recordatorios automáticos de servicios</span>
          <select name="auto_reminders" defaultValue={st.auto_reminders} className="input">
            <option value="off">Desactivados (los generas con el botón en Programación)</option>
            <option value="on">Activados (los genera la tarea programada)</option>
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Avisar con (días de anticipación)</span><input name="reminder_days" type="number" min={1} max={14} defaultValue={st.reminder_days} className="input" /></label>
          <label><span className="label">No antes de la hora (0–23, hora Colombia)</span><input name="reminder_hour" type="number" min={0} max={23} defaultValue={st.reminder_hour} className="input" /></label>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-ink/10 pt-4">
          <label>
            <span className="label">Aviso de cumpleaños al coordinador y líderes</span>
            <select name="birthday_reminders" defaultValue={st.birthday_reminders} className="input">
              <option value="on">Activado</option>
              <option value="off">Desactivado</option>
            </select>
          </label>
          <label><span className="label">Avisar además con (días antes; 0 = solo el día)</span><input name="birthday_days" type="number" min={0} max={14} defaultValue={st.birthday_days} className="input" /></label>
        </div>
        <p className="text-xs text-ink/60">Los avisos de cumpleaños salen una vez al día, después de las 8 a. m., con la tarea programada. En el Resumen y en Equipo siempre puedes ver los próximos cumpleaños.</p>
        <p className="text-xs text-ink/60">Los recordatorios automáticos necesitan la tarea programada (CRON_SECRET). Sin el modo automático, se generan y quedan en la cola manual.</p>
        <button className="btn-primary">Guardar</button>
      </form>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Estado de la API oficial</h2>
        <ul className="divide-y divide-ink/10 text-sm">
          {env.map(([name, ok, desc]) => (
            <li key={name} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><code className="font-bold">{name}</code> <span className="text-ink/60">· {desc}</span></span>
              {yes(ok)}
            </li>
          ))}
        </ul>
        <p className="text-sm">Dirección del webhook para registrar en Meta: <code className="break-all rounded bg-fog px-1.5 py-0.5">{site}/api/whatsapp/webhook</code></p>
        <p className="text-xs text-ink/60">Por seguridad, aquí solo se muestra si cada variable existe, nunca su valor. Se cambian en Netlify (Site configuration → Environment variables).</p>
      </section>

      {configured && (
        <form action={sendTestMessage} className="card space-y-3">
          <h2 className="text-lg font-bold">Enviar un mensaje de prueba</h2>
          <label className="block"><span className="label">WhatsApp de destino</span><input name="phone" type="tel" className="input" placeholder="300 123 4567" required /></label>
          <button className="btn-dark">Enviar prueba</button>
          <p className="text-xs text-ink/60">Usa la plantilla configurada; cuenta como un mensaje cobrado por Meta.</p>
        </form>
      )}
    </div>
  );
}
