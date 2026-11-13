import { randomInt } from "crypto";

// Sin caracteres ambiguos (0/O, 1/I)
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function generateCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return `VM-${s}`;
}
