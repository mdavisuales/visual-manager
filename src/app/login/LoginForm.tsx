"use client";
import { useFormState, useFormStatus } from "react-dom";
import { login, type LoginState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-hero" disabled={pending}>
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}

export default function LoginForm() {
  const [state, action] = useFormState<LoginState, FormData>(login, {});
  return (
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
  );
}
