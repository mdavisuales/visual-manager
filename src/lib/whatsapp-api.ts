import { normalizePhone } from "./whatsapp";

// Envío por la API oficial (WhatsApp Cloud API de Meta) usando UNA plantilla de utilidad con 2 variables:
//   {{1}} = nombre de la persona, {{2}} = texto del aviso.
// Texto sugerido para la plantilla (ver README):
//   Hola {{1}}, tienes un aviso del Ministerio de Visuales MDA: {{2}} Entra al panel de Visual Manager para ver el detalle.

export function apiConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_NAME);
}

// Meta no permite saltos de línea, tabuladores ni más de 4 espacios seguidos dentro de una variable.
export function sanitizeParam(s: string): string {
  return s
    .replace(/[\r\n]+/g, " | ")
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, 700);
}

export type SendResult = { ok: true; id: string } | { ok: false; error: string };

export async function sendTemplate(phone: string, vars: string[]): Promise<SendResult> {
  const to = normalizePhone(phone);
  if (to.length < 11) return { ok: false, error: "Número de WhatsApp no válido" };

  const version = process.env.WHATSAPP_API_VERSION || "v25.0";
  const url = `https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: process.env.WHATSAPP_TEMPLATE_NAME,
          language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "es" },
          components: [{ type: "body", parameters: vars.map((v) => ({ type: "text", text: sanitizeParam(v) })) }],
        },
      }),
      signal: ctrl.signal,
    });
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { code?: number; message?: string; error_data?: { details?: string } } };
    const id = json.messages?.[0]?.id;
    if (res.ok && id) return { ok: true, id };
    const e = json.error;
    return { ok: false, error: `${e?.code ?? res.status}: ${e?.message ?? "Error desconocido"}${e?.error_data?.details ? ` – ${e.error_data.details}` : ""}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error && err.name === "AbortError" ? "Tiempo de espera agotado" : "No se pudo conectar con WhatsApp" };
  } finally {
    clearTimeout(timer);
  }
}
