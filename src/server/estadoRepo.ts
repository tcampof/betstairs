import { crearEstadoInicial, esEstadoArbolValido } from "@/lib/escaleras";
import type { EstadoArbol } from "@/types";
import { getDb } from "@/server/db";

/**
 * Repositorio del estado del árbol por usuario. Cada fila es un documento JSON
 * completo asociado a `user_id`.
 */

interface FilaEstado {
  data: string;
}

/** Lee el estado del usuario; si no existe o es inválido, devuelve el inicial. */
export function leerEstado(userId: number): EstadoArbol {
  const fila = getDb()
    .prepare("SELECT data FROM estado WHERE user_id = ?")
    .get(userId) as FilaEstado | undefined;

  if (!fila) return crearEstadoInicial();

  try {
    const parsed: unknown = JSON.parse(fila.data);
    return esEstadoArbolValido(parsed) ? parsed : crearEstadoInicial();
  } catch {
    return crearEstadoInicial();
  }
}

/** Inserta o actualiza el estado completo del usuario. */
export function guardarEstado(userId: number, estado: EstadoArbol): void {
  getDb()
    .prepare(
      `INSERT INTO estado (user_id, data, updated_at)
       VALUES (:userId, :data, :updated)
       ON CONFLICT(user_id) DO UPDATE SET data = :data, updated_at = :updated`,
    )
    .run({
      userId,
      data: JSON.stringify(estado),
      updated: new Date().toISOString(),
    });
}
