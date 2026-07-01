import { cookies } from "next/headers";

import {
  crearTokenSesion,
  verificarTokenSesion,
} from "@/server/auth";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
} from "@/server/authConstants";

export function obtenerUserIdSesion(): number | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verificarTokenSesion(token)?.userId ?? null;
}

export function requerirUserIdSesion(): number {
  const userId = obtenerUserIdSesion();
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }
  return userId;
}

export function establecerCookieSesion(userId: number): void {
  cookies().set(SESSION_COOKIE, crearTokenSesion(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });
}

export function borrarCookieSesion(): void {
  cookies().delete(SESSION_COOKIE);
}
