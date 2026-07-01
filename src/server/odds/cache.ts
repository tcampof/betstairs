import { ensureDb, exec, queryOne } from "@/server/db";

interface FilaCache {
  data: string;
  expira_en: number;
}

export async function leerCache<T>(clave: string): Promise<T | null> {
  await ensureDb();

  const fila = await queryOne<FilaCache>(
    "SELECT data, expira_en FROM odds_cache WHERE clave = ?",
    [clave],
  );

  if (!fila || Date.now() > Number(fila.expira_en)) return null;

  try {
    return JSON.parse(fila.data) as T;
  } catch {
    return null;
  }
}

export async function guardarCache(
  clave: string,
  valor: unknown,
  ttlMs: number,
): Promise<void> {
  await ensureDb();

  const data = JSON.stringify(valor);
  const expira = Date.now() + ttlMs;

  await exec(
    `INSERT INTO odds_cache (clave, data, expira_en) VALUES (?, ?, ?)
     ON CONFLICT(clave) DO UPDATE SET data = excluded.data, expira_en = excluded.expira_en`,
    [clave, data, expira],
  );
}
