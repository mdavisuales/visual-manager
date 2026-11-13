import { headers } from "next/headers";

// La app Android se identifica con este texto en su "user agent" (lo agrega la propia app).
export const APP_UA = "VisualManagerApp";

export function isAppRequest(): boolean {
  return (headers().get("user-agent") ?? "").includes(APP_UA);
}
