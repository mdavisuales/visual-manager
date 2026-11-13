"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { isAppRequest } from "@/lib/appmode";

export type LoginState = { error?: string };

// Hash de relleno para que tardar lo mismo exista o no el correo
const DUMMY = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.oBq3mH5kqGZ8k9d6w1b0nQz1x8aS";

export async function login(_prev: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY);
  if (!user || !ok || !user.active) return { error: "Correo o contraseña incorrectos." };
  // En la app Android la sesión dura 30 días para no pedir la contraseña a cada rato
  await createSession(user.id, isAppRequest() ? 30 : 7);
  redirect("/panel");
}

export async function logout() {
  destroySession();
  redirect("/login");
}
