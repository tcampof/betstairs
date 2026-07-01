import { NextResponse } from "next/server";

import { obtenerUserIdSesion } from "@/server/session";
import { buscarUsuarioPorId } from "@/server/userRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = obtenerUserIdSesion();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const usuario = await buscarUsuarioPorId(userId);
  if (!usuario) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 401 });
  }

  return NextResponse.json({ id: usuario.id, email: usuario.email });
}
