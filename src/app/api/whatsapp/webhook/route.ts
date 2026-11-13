import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Meta verifica la dirección con una petición GET al configurar el webhook.
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

const STATUS_MAP: Record<string, string> = { sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" };
const ORDER = ["ACCEPTED", "SENT", "DELIVERED", "READ"];

// Meta avisa aquí si el mensaje se entregó, se leyó o falló. Se exige la firma de Meta.
export async function POST(req: NextRequest) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  const raw = await req.text();
  if (!secret) return new NextResponse("Webhook no configurado", { status: 503 });

  const sig = req.headers.get("x-hub-signature-256") ?? "";
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return new NextResponse("Firma inválida", { status: 401 });

  try {
    const body = JSON.parse(raw);
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const st of change.value?.statuses ?? []) {
          const status = STATUS_MAP[st.status as string];
          if (!st.id || !status) continue;
          const n = await prisma.notification.findFirst({ where: { waMessageId: st.id } });
          if (!n) continue;
          if (status === "FAILED") {
            const e = st.errors?.[0];
            // Si falla la entrega, vuelve a la cola manual para enviarlo con el enlace de WhatsApp
            await prisma.notification.update({
              where: { id: n.id },
              data: { apiStatus: "FAILED", sent: false, apiError: `${e?.code ?? ""} ${e?.title ?? e?.message ?? "Entrega fallida"}`.trim().slice(0, 300) },
            });
          } else if (ORDER.indexOf(status) > ORDER.indexOf(n.apiStatus ?? "ACCEPTED")) {
            // Los estados pueden llegar desordenados: nunca se retrocede
            await prisma.notification.update({ where: { id: n.id }, data: { apiStatus: status } });
          }
        }
      }
    }
  } catch (err) {
    console.error("Webhook de WhatsApp:", err);
  }
  return new NextResponse("ok", { status: 200 });
}
