import { NextResponse } from "next/server";

import { esEstadoArbolValido } from "@/lib/escaleras";
import { guardarEstado, leerEstado } from "@/server/estadoRepo";
import { obtenerUserIdSesion } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = obtenerUserIdSesion();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  try {
    const estado = leerEstado(userId);
    return NextResponse.json(estado);
  } catch (error) {
    console.error("Error leyendo el estado", error);
    return NextResponse.json(
      { error: "No se pudo leer el estado" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  const userId = obtenerUserIdSesion();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!esEstadoArbolValido(cuerpo)) {
    return NextResponse.json(
      { error: "Estado con formato inválido" },
      { status: 400 },
    );
  }

  try {
    guardarEstado(userId, cuerpo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error guardando el estado", error);
    return NextResponse.json(
      { error: "No se pudo guardar el estado" },
      { status: 500 },
    );
  }
}
