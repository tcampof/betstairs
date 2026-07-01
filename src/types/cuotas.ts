/**
 * Tipos del módulo de análisis de cuotas.
 *
 * `*Crudo` representa los datos normalizados que devuelve un proveedor externo
 * (independiente de la casa concreta); `*Analizado` añade los cálculos propios
 * (probabilidad implícita, cuota justa sin margen, valor +EV, etc.).
 */

/** Mercado de apuesta soportado (de momento, 1X2 / moneyline). */
export type MercadoClave = "h2h";

/** Liga de fútbol (claves de The Odds API). */
export interface LigaFutbol {
  clave: string;
  nombre: string;
}

/** Una cuota concreta de una casa para un resultado de un evento. */
export interface CuotaCruda {
  casa: string;
  resultado: string;
  precio: number;
}

/** Evento con todas sus cuotas crudas, ya normalizado. */
export interface EventoCrudo {
  id: string;
  liga: string;
  comienza: string;
  local: string;
  visitante: string;
  cuotas: CuotaCruda[];
}

/** Resultado de consultar al proveedor (incluye créditos restantes si aplica). */
export interface ResultadoProveedor {
  eventos: EventoCrudo[];
  creditosRestantes: number | null;
}

/** Un resultado (Local / Empate / Visitante) tras el análisis. */
export interface ResultadoAnalizado {
  nombre: string;
  mejorCuota: number;
  mejorCasa: string;
  /** Probabilidad implícita de la mejor cuota (1 / cuota). */
  probImplicita: number;
  /** Probabilidad "justa" de consenso, sin el margen de la casa (0..1). */
  probJusta: number;
  /** Cuota justa equivalente (1 / probJusta). */
  cuotaJusta: number;
  /** Valor esperado por unidad apostada: mejorCuota * probJusta - 1. */
  valor: number;
  esValor: boolean;
  /** La mejor cuota encaja con el objetivo del peldaño. */
  encajaObjetivo: boolean;
}

/** Un evento tras el análisis completo. */
export interface EventoAnalizado {
  id: string;
  liga: string;
  comienza: string;
  local: string;
  visitante: string;
  numCasas: number;
  /** Margen medio de las casas (overround), 0..1. */
  margenMedio: number;
  resultados: ResultadoAnalizado[];
  encajaObjetivo: boolean;
  hayValor: boolean;
}

/** Respuesta del endpoint /api/cuotas. */
export interface RespuestaCuotas {
  generadoEn: string;
  enCache: boolean;
  liga: string;
  objetivoCuota: number | null;
  creditosRestantes: number | null;
  eventos: EventoAnalizado[];
}
