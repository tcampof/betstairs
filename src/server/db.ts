import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { createClient, type Client } from "@libsql/client";

import { hashPassword } from "@/server/auth";

type SqlValue = string | number | null;

let modo: "turso" | "sqlite" | null = null;
let sqlite: DatabaseSync | null = null;
let turso: Client | null = null;
let initPromise: Promise<void> | null = null;

function rutaDb(): string {
  const ruta = process.env.ARBOL_DB_PATH ?? "./data/arbol.db";
  return resolve(process.cwd(), ruta);
}

function usaTurso(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL?.trim());
}

async function exec(sql: string, args: SqlValue[] = []): Promise<void> {
  if (modo === "turso") {
    await turso!.execute({ sql, args });
    return;
  }
  sqlite!.prepare(sql).run(...args);
}

function tursoRowToObject<T>(columns: string[], row: unknown): T {
  const values = row as unknown[];
  return Object.fromEntries(columns.map((col, i) => [col, values[i]])) as T;
}

async function queryOne<T>(sql: string, args: SqlValue[] = []): Promise<T | undefined> {
  if (modo === "turso") {
    const result = await turso!.execute({ sql, args });
    if (result.rows.length === 0) return undefined;
    return tursoRowToObject<T>(result.columns, result.rows[0]);
  }
  return sqlite!.prepare(sql).get(...args) as T | undefined;
}

async function queryAll<T>(sql: string, args: SqlValue[] = []): Promise<T[]> {
  if (modo === "turso") {
    const result = await turso!.execute({ sql, args });
    return result.rows.map((row) => tursoRowToObject<T>(result.columns, row));
  }
  return sqlite!.prepare(sql).all(...args) as T[];
}

async function runInsert(sql: string, args: SqlValue[]): Promise<number> {
  if (modo === "turso") {
    const result = await turso!.execute({ sql, args });
    return Number(result.lastInsertRowid ?? 0);
  }
  const result = sqlite!.prepare(sql).run(...args);
  return Number(result.lastInsertRowid);
}

async function adoptarLegacyAUsuario(userId: number): Promise<void> {
  const legacy = await queryOne<{ data: string; updated_at: string }>(
    "SELECT data, updated_at FROM legacy_estado_backup LIMIT 1",
  );
  if (!legacy) return;

  const existe = await queryOne("SELECT 1 AS ok FROM estado WHERE user_id = ?", [
    userId,
  ]);
  if (existe) return;

  await exec(
    "INSERT INTO estado (user_id, data, updated_at) VALUES (?, ?, ?)",
    [userId, legacy.data, legacy.updated_at],
  );
  await exec("DELETE FROM legacy_estado_backup");
}

async function bootstrapUsuarioInicial(): Promise<void> {
  const email = process.env.BOOTSTRAP_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_USER_PASSWORD;
  if (!email || !password) return;

  const hayUsuarios = await queryOne("SELECT 1 AS ok FROM users LIMIT 1");
  if (hayUsuarios) return;

  const ahora = new Date().toISOString();
  const userId = await runInsert(
    "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
    [email, hashPassword(password), ahora],
  );
  await adoptarLegacyAUsuario(userId);
}

async function migrarEsquemaUsuarios(): Promise<void> {
  await exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const columnas = await queryAll<{ name: string }>("PRAGMA table_info(estado)");
  const tieneUserId = columnas.some((c) => c.name === "user_id");

  if (!tieneUserId && columnas.length > 0) {
    const legacy = await queryOne<{ data: string; updated_at: string }>(
      "SELECT data, updated_at FROM estado WHERE id = 1",
    );

    await exec("DROP TABLE estado");
    await exec(`
      CREATE TABLE estado (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    if (legacy) {
      await exec(`
        CREATE TABLE IF NOT EXISTS legacy_estado_backup (
          data TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      await exec(
        "INSERT INTO legacy_estado_backup (data, updated_at) VALUES (?, ?)",
        [legacy.data, legacy.updated_at],
      );
    }
  } else if (!tieneUserId) {
    await exec(`
      CREATE TABLE IF NOT EXISTS estado (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  await exec(`
    CREATE TABLE IF NOT EXISTS legacy_estado_backup (
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

async function initDatabaseInternal(): Promise<void> {
  if (modo) return;

  if (usaTurso()) {
    modo = "turso";
    turso = createClient({
      url: process.env.TURSO_DATABASE_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
    console.info("[db] Turso — los datos persisten entre despliegues");
  } else {
    modo = "sqlite";
    const ruta = rutaDb();
    mkdirSync(dirname(ruta), { recursive: true });
    sqlite = new DatabaseSync(ruta);
    sqlite.exec("PRAGMA journal_mode = WAL;");
    sqlite.exec("PRAGMA foreign_keys = ON;");
    console.info(`[db] SQLite local: ${ruta}`);
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[db] Sin TURSO_DATABASE_URL ni disco persistente, los datos se pierden al redesplegar.",
      );
    }
  }

  await exec(`
    CREATE TABLE IF NOT EXISTS odds_cache (
      clave TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      expira_en INTEGER NOT NULL
    );
  `);

  await migrarEsquemaUsuarios();
  await bootstrapUsuarioInicial();
}

/** Inicializa la BD (idempotente). Obligatorio antes de cualquier consulta. */
export async function ensureDb(): Promise<void> {
  if (!initPromise) initPromise = initDatabaseInternal();
  await initPromise;
}

export { exec, queryOne, queryAll, runInsert, adoptarLegacyAUsuario };
