import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Puerta de entrada de la app Android: con sesión va al panel; sin sesión, al acceso.
export default async function AppEntry() {
  const s = await getSession();
  redirect(s ? "/panel" : "/login");
}
