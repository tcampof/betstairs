import { NextResponse } from "next/server";

import { esEmailValido } from "@/server/auth";
import { establecerCookieSesion } from "@/server/session";
import { buscarUsuarioPorEmail, crearUsuario } from "@/server/userRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_PASSWORD = 8;

export async function POST(request: Request) {
  let cuerpo: { email?: string; password?: string };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const email = cuerpo.email?.trim() ?? "";
  const password = cuerpo.password ?? "";

  if (!esEmailValido(email)) {
    return NextResponse.json({ error: "Email no válido" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres` },
      { status: 400 },
    );
  }

  if (await buscarUsuarioPorEmail(email)) {
    return NextResponse.json(
      { error: "Ya existe una cuenta con ese email" },
      { status: 409 },
    );
  }

  try {
    const usuario = await crearUsuario(email, password);
    establecerCookieSesion(usuario.id);
    return NextResponse.json({
      id: usuario.id,
      email: usuario.email,
    });
  } catch (error) {
    console.error("Error registrando usuario", error);
    return NextResponse.json(
      { error: "No se pudo crear la cuenta" },
      { status: 500 },
    );
  }
}
