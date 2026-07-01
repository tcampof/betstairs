import type { ResumenMensual, StatsMesActual } from "@/types";

/** Balance de cierre del mes anterior que activa inicio premium (4×20 €). */
export const UMBRAL_INICIO_MES_PREMIUM = 1000;

/** Capital total con el que arranca un mes premium. */
export const CAPITAL_MES_PREMIUM = 80;

/** Capital por escalera principal en un mes premium. */
export const CAPITAL_POR_ESCALERA_PREMIUM = 20;

/** Clave de mes en formato `YYYY-MM`. */
export function claveMes(fecha = new Date()): string {
  const y = fecha.getFullYear();
  const m = String(fecha.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** Etiqueta legible del mes (ej. "junio de 2026"). */
export function formatearMes(clave: string): string {
  const [anio, mes] = clave.split("-");
  const y = Number(anio);
  const m = Number(mes);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return clave;
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
  }).format(new Date(y, m - 1, 1));
}

export const STATS_MES_VACIO: StatsMesActual = {
  apuestasRealizadas: 0,
  escalerasRotas: 0,
};

/** Stats del mes en curso (tolerante a estados antiguos). */
export function statsMesDe(
  stats?: StatsMesActual | null,
): StatsMesActual {
  if (!stats) return { ...STATS_MES_VACIO };
  return {
    apuestasRealizadas: stats.apuestasRealizadas ?? 0,
    escalerasRotas: stats.escalerasRotas ?? 0,
  };
}

/** Historial mensual (tolerante a estados antiguos). */
export function historialMensualDe(
  historial?: ResumenMensual[] | null,
): ResumenMensual[] {
  return Array.isArray(historial) ? historial : [];
}
