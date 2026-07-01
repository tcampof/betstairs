import type { LigaFutbol } from "@/types/cuotas";

/** Competiciones de fútbol soportadas (claves de The Odds API). */
export const LIGAS_FUTBOL: LigaFutbol[] = [
  { clave: "soccer_fifa_world_cup", nombre: "Mundial FIFA" },
];

export const LIGA_POR_DEFECTO = "soccer_fifa_world_cup";

export function esLigaValida(clave: string): boolean {
  return LIGAS_FUTBOL.some((l) => l.clave === clave);
}
