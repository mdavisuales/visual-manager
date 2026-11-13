import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// La app Android consulta aquí, cada cierto tiempo, si hay avisos nuevos para el usuario con sesión iniciada
// (se autentica con la misma cookie de sesión que usa la web).
export async function GET(req: NextRequest) {
  const s = await getSession();
  if (!s) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const serverTime = new Date(); // se toma ANTES de consultar para no perder avisos
  const raw = req.nextUrl.searchParams.get("since");
  const since = raw ? new Date(raw) : null;
  const validSince = since && !Number.isNaN(since.getTime()) ? since : null;

  const items = validSince
    ? await prisma.notification.findMany({
        where: { userId: s.userId, createdAt: { gt: validSince } },
        orderBy: { createdAt: "asc" },
        take: 20,
        select: { id: true, message: true, createdAt: true },
      })
    : [];
  const unread = await prisma.notification.count({ where: { userId: s.userId, readAt: null } });

  return NextResponse.json(
    {
      serverTime: serverTime.toISOString(),
      unread,
      // Desde dónde seguir la próxima vez
      next: items.length ? items[items.length - 1].createdAt.toISOString() : serverTime.toISOString(),
      items: items.map((n) => ({ id: n.id, message: n.message, createdAt: n.createdAt.toISOString() })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
