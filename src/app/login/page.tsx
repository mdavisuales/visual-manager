import Link from "next/link";
import SiteHero from "@/components/SiteHero";
import { isAppRequest } from "@/lib/appmode";
import LoginForm from "./LoginForm";
import AppOnlyStyles from "@/components/AppOnlyStyles";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const app = isAppRequest();
  return (
    <main>
      <AppOnlyStyles />
      <SiteHero title="Conectarse" subtitle="Solo para integrantes del Ministerio de Visuales." home={!app} />
      <section className="mx-auto max-w-sm px-5 pb-20">
        <LoginForm />
        {!app && <Link href="/" className="mt-8 block text-center text-sm font-light underline">Volver al formulario de solicitudes</Link>}
      </section>
    </main>
  );
}
