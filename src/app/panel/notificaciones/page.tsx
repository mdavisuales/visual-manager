import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTimeEs } from "@/lib/dates";
import { markAllRead } from "../team-actions";

export const dynamic = "force-dynamic";

export default async function Notificaciones() {
  const s = await requireSession();
  const list = await prisma.notification.findMany({ where: { userId: s.userId }, orderBy: { createdAt: "desc" }, take: 50 });
  const unread = list.filter((n) => !n.readAt).length;

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Notificaciones</h1>
        {unread > 0 && (
          <form action={markAllRead}><button className="btn-ghost">Marcar todas como leídas</button></form>
        )}
      </div>
      {list.length === 0 ? (
        <p className="card text-sm text-ink/70">No tienes notificaciones.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li key={n.id} className={`card text-sm ${n.readAt ? "" : "border-lamp bg-amber-50"}`}>
              <p className="whitespace-pre-wrap">{n.message}</p>
              <p className="mt-2 text-xs text-ink/50">{formatDateTimeEs(n.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
