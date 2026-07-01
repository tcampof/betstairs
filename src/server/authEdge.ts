import { SESSION_COOKIE } from "@/server/authConstants";

function authSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") return "";
    return "dev-secret-cambiar-en-produccion";
  }
  return secret;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): string {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
}

/** Verificación de sesión compatible con Edge (middleware). */
export async function verificarSesionEdge(
  token: string | undefined,
): Promise<number | null> {
  if (!token) return null;
  const secret = authSecret();
  if (!secret) return null;

  const punto = token.lastIndexOf(".");
  if (punto <= 0) return null;

  const payloadB64 = token.slice(0, punto);
  const firma = token.slice(punto + 1);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payloadB64),
    ),
  );
  const esperada = base64UrlEncode(sigBytes);

  if (firma.length !== esperada.length) return null;
  let diff = 0;
  for (let i = 0; i < firma.length; i++) {
    diff |= firma.charCodeAt(i) ^ esperada.charCodeAt(i);
  }
  if (diff !== 0) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as {
      userId?: number;
      exp?: number;
    };
    if (
      typeof payload.userId !== "number" ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      return null;
    }
    return payload.userId;
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };
