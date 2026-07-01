import type { ResultadoProveedor } from "@/types/cuotas";

/** Opciones de consulta comunes a cualquier proveedor de cuotas. */
export interface OpcionesConsulta {
  /** Clave de liga/deporte del proveedor. */
  liga: string;
  /** Región de casas de apuestas (p. ej. "eu", "uk"). */
  region: string;
  /** Mercado (p. ej. "h2h"). */
  mercado: string;
}

/**
 * Abstracción de un proveedor de cuotas. Permite cambiar de servicio (The Odds
 * API, OddsPapi, etc.) sin tocar la lógica de análisis ni la UI.
 */
export interface ProveedorCuotas {
  nombre: string;
  listarEventos(opciones: OpcionesConsulta): Promise<ResultadoProveedor>;
}

/** Error normalizado de un proveedor (incluye el código HTTP de origen). */
export class ErrorProveedor extends Error {
  readonly estado: number;

  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.name = "ErrorProveedor";
    this.estado = estado;
  }
}
