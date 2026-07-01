import { crearEstadoInicial, esEstadoArbolValido } from "@/lib/escaleras";
import type { EstadoArbol } from "@/types";
import { ensureDb, exec, queryOne } from "@/server/db";

interface FilaEstado {
  data: string;
}

/** Lee el estado del usuario; si no existe o es inválido, devuelve el inicial. */
export async function leerEstado(userId: number): Promise<EstadoArbol> {
  await ensureDb();

  const fila = await queryOne<FilaEstado>(
    "SELECT data FROM estado WHERE user_id = ?",
    [userId],
  );

  if (!fila) return crearEstadoInicial();

  try {
    const parsed: unknown = JSON.parse(fila.data);
    return esEstadoArbolValido(parsed) ? parsed : crearEstadoInicial();
  } catch {
    return crearEstadoInicial();
  }
}

/** Inserta o actualiza el estado completo del usuario. */
export async function guardarEstado(
  userId: number,
  estado: EstadoArbol,
): Promise<void> {
  await ensureDb();

  const data = JSON.stringify(estado);
  const updated = new Date().toISOString();

  await exec(
    `INSERT INTO estado (user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [userId, data, updated],
  );
}
