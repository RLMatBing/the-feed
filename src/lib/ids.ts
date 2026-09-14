import { randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function uid(): string {
  return randomBytes(8).toString("hex");
}

export function roomCode(): string {
  let code = "";
  const bytes = randomBytes(4);
  for (let i = 0; i < 4; i += 1) {
    code += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return code;
}

export function nowIso(): string {
  return new Date().toISOString();
}
