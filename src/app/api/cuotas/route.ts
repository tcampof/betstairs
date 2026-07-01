import { NextResponse } from "next/server";

import {
  analizarEvento,
  marcarEncajeObjetivo,
  ordenarEventos,
} from "@/lib/analisisCuotas";
import { esLigaValida, LIGA_POR_DEFECTO } from "@/lib/ligas";
import { guardarCache, leerCache } from "@/server/odds/cache";
import { ErrorProveedor } from "@/server/odds/proveedor";
import { crearProveedorTheOddsApi } from "@/server/odds/theOddsApi";
import { obtenerUserIdSesion } from "@/server/session";
import type { RespuestaCuotas, ResultadoProveedor } from "@/types/cuotas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// La capa gratuita es muy limitada: cacheamos 10 minutos por liga/región/mercado.
const TTL_CACHE_MS = 10 * 60 * 1000;
const MERCADO = "h2h";

export async function GET(request: Request) {
  const userId = obtenerUserIdSesion();
  if (!userId) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const ligaParam = searchParams.get("liga") ?? LIGA_POR_DEFECTO;
  const liga = esLigaValida(ligaParam) ? ligaParam : LIGA_POR_DEFECTO;
  const region = searchParams.get("region") ?? "eu";
  const objetivoParam = Number.parseFloat(searchParams.get("objetivo") ?? "");
  const objetivoCuota = Number.isFinite(objetivoParam) ? objetivoParam : null;

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Falta la variable ODDS_API_KEY. Añádela a .env.local (local) o al entorno del contenedor (Docker).",
      },
      { status: 503 },
    );
  }

  const claveCache = `cuotas:${liga}:${region}:${MERCADO}`;

  try {
    let datos = leerCache<ResultadoProveedor>(claveCache);
    let enCache = true;

    if (!datos) {
      enCache = false;
      const proveedor = crearProveedorTheOddsApi(apiKey);
      datos = await proveedor.listarEventos({ liga, region, mercado: MERCADO });
      guardarCache(claveCache, datos, TTL_CACHE_MS);
    }

    const eventos = ordenarEventos(
      datos.eventos
        .map(analizarEvento)
        .map((e) => marcarEncajeObjetivo(e, objetivoCuota)),
    );

    const respuesta: RespuestaCuotas = {
      generadoEn: new Date().toISOString(),
      enCache,
      liga,
      objetivoCuota,
      creditosRestantes: datos.creditosRestantes,
      eventos,
    };

    return NextResponse.json(respuesta);
  } catch (error) {
    if (error instanceof ErrorProveedor) {
      const estado = error.estado === 401 ? 401 : 502;
      return NextResponse.json({ error: error.message }, { status: estado });
    }
    console.error("Error consultando cuotas", error);
    return NextResponse.json(
      { error: "No se pudieron obtener las cuotas." },
      { status: 500 },
    );
  }
}
