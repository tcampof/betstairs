import { getDb } from "@/server/db";

/**
 * Caché simple con expiración (TTL) sobre SQLite. Imprescindible para respetar
 * la cuota gratuita del proveedor de cuotas (p. ej. ~16 peticiones/día).
 */

interface FilaCache {
  data: string;
  expira_en: number;
}

export function leerCache<T>(clave: string): T | null {
  const fila = getDb()
    .prepare("SELECT data, expira_en FROM odds_cache WHERE clave = :clave")
    .get({ clave }) as FilaCache | undefined;

  if (!fila || Date.now() > fila.expira_en) return null;

  try {
    return JSON.parse(fila.data) as T;
  } catch {
    return null;
  }
}

export function guardarCache(clave: string, valor: unknown, ttlMs: number): void {
  getDb()
    .prepare(
      `INSERT INTO odds_cache (clave, data, expira_en)
       VALUES (:clave, :data, :expira)
       ON CONFLICT(clave) DO UPDATE SET data = :data, expira_en = :expira`,
    )
    .run({
      clave,
      data: JSON.stringify(valor),
      expira: Date.now() + ttlMs,
    });
}
