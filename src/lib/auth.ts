import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "./db";

const COOKIE = "vm_session";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("Falta la variable de entorno AUTH_SECRET");
  return new TextEncoder().encode(s);
}

export type Session = { userId: string; role: Role; name: string };

export async function createSession(userId: string, days = 7) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * days,
  });
}

// Lee la sesión y vuelve a consultar al usuario: si lo desactivan o le cambian el rol, se aplica de inmediato.
export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const user = await prisma.user.findUnique({ where: { id: String(payload.userId) } });
    if (!user || !user.active) return null;
    return { userId: user.id, role: user.role, name: user.name };
  } catch {
    return null;
  }
}

export function destroySession() {
  cookies().delete(COOKIE);
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}
