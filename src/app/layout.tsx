import type { Metadata } from "next";
import { League_Spartan, Poppins } from "next/font/google";
import "./globals.css";

// League Spartan: títulos y botones · Poppins: textos (200 ultradelgada, 300 muy delgada, 600 seminegrita para etiquetas)
const display = League_Spartan({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700", "800", "900"] });
const body = Poppins({ subsets: ["latin"], variable: "--font-body", weight: ["200", "300", "400", "500", "600"] });

export const metadata: Metadata = {
  title: "Visuales MDA – Visual Manager",
  description: "Solicita apoyo técnico al Ministerio de Visuales de la iglesia MDA.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
