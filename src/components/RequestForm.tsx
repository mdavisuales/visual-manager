"use client";
import { useState } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { createRequest } from "@/app/actions";
import type { FormState } from "@/lib/types";
import { diffDays } from "@/lib/dates";
import { LOCATION_LABEL } from "@/lib/constants";

type Req = { id: string; name: string; description: string | null };
const initial: FormState = { ok: false };

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn-hero" disabled={pending}>
      {pending ? "Enviando…" : "Enviar solicitud"}
    </button>
  );
}

function Field({ label, error, hint, children, className = "" }: { label: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
      {error && <span className="err block">{error}</span>}
    </label>
  );
}

function WarningIcon() {
  return (
    <svg viewBox="0 0 64 64" className="mx-auto h-14 w-14" aria-hidden="true">
      <path d="M32 7 3 58h58L32 7Z" fill="#ffdd57" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
      <path d="M32 25v15" stroke="#000" strokeWidth="6" strokeLinecap="round" />
      <circle cx="32" cy="49" r="3.6" fill="#000" />
    </svg>
  );
}

// Aviso amarillo del boceto. Si el evento está a menos de los días mínimos, muestra el mensaje completo.
function Notice({ late, minDays, warning }: { late: boolean; minDays: number; warning: string }) {
  return (
    <div role={late ? "alert" : undefined} className={`rounded-md bg-lamp p-4 text-[0.8rem] leading-snug text-ink transition ${late ? "ring-4 ring-brand/70" : ""}`}>
      <WarningIcon />
      {late ? (
        <>
          <p className="mt-2 font-bold">Tu solicitud queda sujeta a disponibilidad</p>
          <p className="mt-1">{warning}</p>
          <p className="mt-2 font-bold">Puedes enviarla igualmente; el equipo la revisará según su disponibilidad.</p>
        </>
      ) : (
        <>
          <p className="mt-2 font-bold">Pide con tiempo</p>
          <p className="mt-1">Las solicitudes deben realizarse con al menos {minDays} días de anticipación. Si la envías con menos tiempo, su atención dependerá de la disponibilidad del equipo.</p>
        </>
      )}
    </div>
  );
}

export default function RequestForm(props: { requirements: Req[]; today: string; todayLabel: string; minDays: number; warning: string }) {
  const [state, action] = useFormState(createRequest, initial);
  const [eventDate, setEventDate] = useState("");
  const [loc, setLoc] = useState("AUDITORIO_PRINCIPAL");
  const e = state.errors ?? {};

  const days = eventDate ? diffDays(props.today, eventDate) : null;
  const showLate = days !== null && days >= 0 && days < props.minDays;

  if (state.ok) {
    return (
      <div className="mx-auto max-w-xl space-y-5 text-center">
        <h2 className="text-3xl font-extrabold">Solicitud enviada</h2>
        <p className="font-light">Guarda este código para consultar el estado de tu solicitud:</p>
        <p className="rounded-3xl bg-mist px-4 py-4 font-display text-4xl font-extrabold tracking-widest">{state.code}</p>
        {state.late && <Notice late minDays={props.minDays} warning={props.warning} />}
        <div className="flex flex-col items-center gap-4 pt-2">
          <Link className="btn-hero" href={`/seguimiento?codigo=${state.code}`}>Ver el estado</Link>
          <a className="btn-ghost" href="/">Hacer otra solicitud</a>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-10">
      {/* Campo trampa para bots: las personas no lo ven */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {state.message && (
        <p role="alert" className="rounded-2xl bg-red-50 p-3 text-center text-sm font-medium text-red-800">
          {state.message}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_17rem]">
        <aside className="order-first lg:order-last lg:sticky lg:top-6 lg:self-start">
          <Notice late={showLate} minDays={props.minDays} warning={props.warning} />
        </aside>

        <div className="space-y-6">
          <div className="grid items-end gap-x-8 gap-y-5 md:grid-cols-3">
            <Field label="Actividad" error={e.activityName}><input name="activityName" className="input" required /></Field>
            <Field label="Ministerio" error={e.ministry}><input name="ministry" className="input" required /></Field>
            <Field label="Fecha del evento" error={e.eventDate} hint={`Solicitud de hoy, ${props.todayLabel}`}>
              <input name="eventDate" type="date" min={props.today} value={eventDate} onChange={(ev) => setEventDate(ev.target.value)} className="input" required />
            </Field>
          </div>

          <div className="grid grid-cols-2 items-end gap-x-4 gap-y-5 md:grid-cols-4 md:gap-x-8">
            <Field label="Responsable" error={e.organizerName} className="col-span-2 md:col-span-1"><input name="organizerName" className="input" required /></Field>
            <Field label="WhatsApp de contacto" error={e.whatsapp} className="col-span-2 md:col-span-1"><input name="whatsapp" type="tel" inputMode="tel" className="input" placeholder="300 123 4567" required /></Field>
            <Field label="Hora de inicio" error={e.startTime}><input name="startTime" type="time" className="input" required /></Field>
            <Field label="Hora de finalización" error={e.endTime}><input name="endTime" type="time" className="input" required /></Field>
          </div>

          <div className="grid items-end gap-x-8 gap-y-5 md:grid-cols-3">
            <Field label="Ubicación" error={e.locationType}>
              <select name="locationType" value={loc} onChange={(ev) => setLoc(ev.target.value)} className="input">
                {Object.entries(LOCATION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            {loc === "FUERA_IGLESIA" && (
              <Field label="Dirección" error={e.address}><input name="address" className="input" required /></Field>
            )}
            <Field label="Asistentes (aprox., opcional)" error={e.attendees}><input name="attendees" type="number" min={0} className="input" /></Field>
          </div>

          <Field label="Observaciones" error={e.observations} hint="Necesidades especiales, música, presentaciones o instrucciones específicas.">
            <textarea name="observations" rows={5} className="input" />
          </Field>

          <fieldset>
            <legend className="label">Requerimientos</legend>
            {props.requirements.length === 0 ? (
              <p className="pl-4 text-sm font-light">Cuéntanos lo que necesitas en las observaciones.</p>
            ) : (
              <div className="grid gap-x-8 gap-y-1 pl-4 sm:grid-cols-2">
                {props.requirements.map((r) => (
                  <label key={r.id} className="flex items-start gap-3 py-1.5 text-sm">
                    <input type="checkbox" name="requirements" value={r.id} className="mt-0.5 h-5 w-5 shrink-0 accent-[#1800ad]" />
                    <span>
                      <span className="font-medium">{r.name}</span>
                      {r.description && <span className="block text-xs font-light text-ink/70">{r.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        </div>
      </div>

      <div className="flex justify-center">
        <Submit />
      </div>
    </form>
  );
}
