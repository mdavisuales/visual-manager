import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// 1) Sin sesión válida no se entra a /panel (cada página del panel vuelve a validar sesión y permisos).
// 2) La app Android no muestra las páginas públicas: el formulario de solicitudes y la consulta quedan fuera.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApp = (req.headers.get("user-agent") ?? "").includes("VisualManagerApp");

  if (pathname === "/" || pathname.startsWith("/seguimiento")) {
    return isApp ? NextResponse.redirect(new URL("/app", req.url)) : NextResponse.next();
  }

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

export const config = { matcher: ["/", "/seguimiento/:path*", "/panel/:path*"] };
