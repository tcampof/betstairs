import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { SESSION_MAX_AGE_SEC } from "@/server/authConstants";

export { SESSION_COOKIE, SESSION_MAX_AGE_SEC } from "@/server/authConstants";

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET debe definirse en producción (mín. 16 caracteres).");
    }
    return "dev-secret-cambiar-en-produccion";
  }
  return secret;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidato = scryptSync(password, salt, 64).toString("hex");
  try {
    return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(candidato, "hex"));
  } catch {
    return false;
  }
}

export function crearTokenSesion(userId: number): string {
  const payload = JSON.stringify({
    userId,
    exp: Date.now() + SESSION_MAX_AGE_SEC * 1000,
  });
  const payloadB64 = Buffer.from(payload).toString("base64url");
  const firma = createHmac("sha256", authSecret())
    .update(payloadB64)
    .digest("base64url");
  return `${payloadB64}.${firma}`;
}

export function verificarTokenSesion(
  token: string | undefined,
): { userId: number } | null {
  if (!token) return null;
  const punto = token.lastIndexOf(".");
  if (punto <= 0) return null;

  const payloadB64 = token.slice(0, punto);
  const firma = token.slice(punto + 1);
  const esperada = createHmac("sha256", authSecret())
    .update(payloadB64)
    .digest("base64url");

  try {
    if (!timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8"),
    ) as { userId?: number; exp?: number };
    if (
      typeof payload.userId !== "number" ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      return null;
    }
    return { userId: payload.userId };
  } catch {
    return null;
  }
}

export function esEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
