// Función programada de Netlify: cada hora llama a /api/cron de la aplicación.
export default async () => {
  const site = process.env.NEXT_PUBLIC_SITE_URL || process.env.URL;
  if (!site || !process.env.CRON_SECRET) {
    console.error("Falta NEXT_PUBLIC_SITE_URL (o URL) o CRON_SECRET");
    return new Response("Configuración incompleta", { status: 500 });
  }
  const res = await fetch(`${site}/api/cron`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
  console.log("cron:", res.status, await res.text());
  return new Response("ok");
};

export const config = { schedule: "0 * * * *" };
