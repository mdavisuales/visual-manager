import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Primera barrera: sin sesión válida no se entra a /panel.
// Cada página del panel vuelve a validar la sesión y los permisos en el servidor.
export async function middleware(req: NextRequest) {
  const token = req.cookies.get("vm_session")?.value;
  const secret = process.env.AUTH_SECRET;
  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
      return NextResponse.next();
    } catch {
      /* sesión inválida o vencida */
    }
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = { matcher: ["/panel/:path*"] };
