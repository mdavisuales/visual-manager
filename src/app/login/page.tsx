"use client";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import SiteHero from "@/components/SiteHero";
import { login, type LoginState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-hero" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export default function LoginPage() {
  const [state, action] = useFormState<LoginState, FormData>(login, {});
  return (
    <main>
      <SiteHero title="Conectarse" subtitle="Solo para integrantes del Ministerio de Visuales." />
      <section className="mx-auto max-w-sm px-5 pb-20">
        <form action={action} className="flex flex-col items-center gap-5">
          <label className="block w-full">
            <span className="label">Correo</span>
            <input name="email" type="email" autoComplete="username" className="input" required />
          </label>
          <label className="block w-full">
            <span className="label">Contraseña</span>
            <input name="password" type="password" autoComplete="current-password" className="input" required />
          </label>
          {state.error && <p role="alert" className="err">{state.error}</p>}
          <div className="pt-2"><Submit /></div>
        </form>
        <Link href="/" className="mt-8 block text-center text-sm font-light underline">Volver al formulario de solicitudes</Link>
      </section>
    </main>
  );
}
