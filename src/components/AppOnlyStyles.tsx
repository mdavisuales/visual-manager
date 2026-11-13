import { isAppRequest } from "@/lib/appmode";

// Solo para la app Android: oculta el distintivo "Powered by Netlify" (lo agrega Netlify, no la plataforma),
// que tapa la barra inferior. En el navegador no se toca nada.
export default function AppOnlyStyles() {
  if (!isAppRequest()) return null;
  return <style dangerouslySetInnerHTML={{ __html: "#nl-badge-frame,[id^='nl-badge'],[class*='nl-badge']{display:none!important;visibility:hidden!important}" }} />;
}
