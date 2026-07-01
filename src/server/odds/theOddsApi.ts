import type { CuotaCruda, EventoCrudo, ResultadoProveedor } from "@/types/cuotas";
import {
  ErrorProveedor,
  type OpcionesConsulta,
  type ProveedorCuotas,
} from "@/server/odds/proveedor";

const BASE_URL = "https://api.the-odds-api.com/v4";

/* Tipos parciales de la respuesta de The Odds API (sólo lo que usamos). */
interface OddsApiOutcome {
  name: string;
  price: number;
}
interface OddsApiMarket {
  key: string;
  outcomes: OddsApiOutcome[];
}
interface OddsApiBookmaker {
  key: string;
  title: string;
  markets: OddsApiMarket[];
}
interface OddsApiEvent {
  id: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

function mapearEvento(evento: OddsApiEvent, mercado: string): EventoCrudo {
  const cuotas: CuotaCruda[] = [];

  for (const casa of evento.bookmakers ?? []) {
    const m = casa.markets?.find((mk) => mk.key === mercado);
    if (!m) continue;
    for (const out of m.outcomes ?? []) {
      if (typeof out.price === "number" && out.price > 1) {
        cuotas.push({
          casa: casa.title,
          resultado: out.name,
          precio: out.price,
        });
      }
    }
  }

  return {
    id: evento.id,
    liga: evento.sport_title,
    comienza: evento.commence_time,
    local: evento.home_team,
    visitante: evento.away_team,
    cuotas,
  };
}

/**
 * Implementación de `ProveedorCuotas` sobre The Odds API (v4).
 * Devuelve cuotas en formato decimal y normaliza los eventos.
 */
export function crearProveedorTheOddsApi(apiKey: string): ProveedorCuotas {
  return {
    nombre: "The Odds API",
    async listarEventos({ liga, region, mercado }: OpcionesConsulta) {
      const url =
        `${BASE_URL}/sports/${encodeURIComponent(liga)}/odds/` +
        `?apiKey=${encodeURIComponent(apiKey)}` +
        `&regions=${encodeURIComponent(region)}` +
        `&markets=${encodeURIComponent(mercado)}` +
        `&oddsFormat=decimal`;

      const respuesta = await fetch(url, { cache: "no-store" });

      if (!respuesta.ok) {
        const detalle = await respuesta.text().catch(() => "");
        throw new ErrorProveedor(
          respuesta.status,
          `The Odds API respondió ${respuesta.status}: ${detalle.slice(0, 200)}`,
        );
      }

      const cabeceraRestantes = respuesta.headers.get("x-requests-remaining");
      const creditosRestantes =
        cabeceraRestantes !== null ? Number(cabeceraRestantes) : null;

      const datos = (await respuesta.json()) as OddsApiEvent[];
      const eventos: ResultadoProveedor["eventos"] = datos.map((e) =>
        mapearEvento(e, mercado),
      );

      return { eventos, creditosRestantes };
    },
  };
}
