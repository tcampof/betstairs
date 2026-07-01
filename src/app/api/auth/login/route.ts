import { NextResponse } from "next/server";

import { establecerCookieSesion } from "@/server/session";
import { verificarCredenciales } from "@/server/userRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let cuerpo: { email?: string; password?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = cuerpo.email?.trim() ?? "";
  const password = cuerpo.password ?? "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email y contraseña son obligatorios" },
      { status: 400 },
    );
  }

  const usuario = await verificarCredenciales(email, password);
  if (!usuario) {
    return NextResponse.json(
      { error: "Credenciales incorrectas" },
      { status: 401 },
    );
  }

  establecerCookieSesion(usuario.id);
  return NextResponse.json({ id: usuario.id, email: usuario.email });
}
