// Normaliza un número a formato internacional. Si trae 10 dígitos y empieza por 3, asume Colombia (57).
export function normalizePhone(raw: string): string {
  const d = raw.replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("3")) return `57${d}`;
  return d;
}

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${normalizePhone(phone)}?text=${encodeURIComponent(text)}`;
}
