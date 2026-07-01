import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { hashPassword } from "@/server/auth";

/**
 * Acceso a la base de datos SQLite mediante el módulo nativo `node:sqlite`
 * (incluido en Node 22+, requiere el flag `--experimental-sqlite`).
 */

let instancia: DatabaseSync | null = null;

function rutaDb(): string {
  const ruta = process.env.ARBOL_DB_PATH ?? "./data/arbol.db";
  return resolve(process.cwd(), ruta);
}

function adoptarLegacyAUsuario(db: DatabaseSync, userId: number): void {
  const legacy = db
    .prepare("SELECT data, updated_at FROM legacy_estado_backup LIMIT 1")
    .get() as { data: string; updated_at: string } | undefined;

  if (!legacy) return;

  const existe = db.prepare("SELECT 1 FROM estado WHERE user_id = ?").get(userId);
  if (existe) return;

  db.prepare(
    `INSERT INTO estado (user_id, data, updated_at) VALUES (?, ?, ?)`,
  ).run(userId, legacy.data, legacy.updated_at);
  db.exec("DELETE FROM legacy_estado_backup");
}

/** Crea el primer usuario desde variables de entorno si la BD aún no tiene cuentas. */
function bootstrapUsuarioInicial(db: DatabaseSync): void {
  const email = process.env.BOOTSTRAP_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_USER_PASSWORD;
  if (!email || !password) return;

  const hayUsuarios = db.prepare("SELECT 1 FROM users LIMIT 1").get();
  if (hayUsuarios) return;

  const ahora = new Date().toISOString();
  const resultado = db
    .prepare(
      `INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)`,
    )
    .run(email, hashPassword(password), ahora);

  adoptarLegacyAUsuario(db, Number(resultado.lastInsertRowid));
}

function migrarEsquemaUsuarios(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const columnas = db.prepare("PRAGMA table_info(estado)").all() as {
    name: string;
  }[];
  const tieneUserId = columnas.some((c) => c.name === "user_id");

  if (!tieneUserId && columnas.length > 0) {
    const legacy = db
      .prepare("SELECT data, updated_at FROM estado WHERE id = 1")
      .get() as { data: string; updated_at: string } | undefined;

    db.exec("DROP TABLE estado");
    db.exec(`
      CREATE TABLE estado (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    if (legacy) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS legacy_estado_backup (
          data TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
      db.prepare(
        "INSERT INTO legacy_estado_backup (data, updated_at) VALUES (?, ?)",
      ).run(legacy.data, legacy.updated_at);
    }
  } else if (!tieneUserId) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS estado (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS legacy_estado_backup (
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export function getDb(): DatabaseSync {
  if (instancia) return instancia;

  const ruta = rutaDb();
  mkdirSync(dirname(ruta), { recursive: true });

  const db = new DatabaseSync(ruta);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  db.exec(`
    CREATE TABLE IF NOT EXISTS odds_cache (
      clave TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      expira_en INTEGER NOT NULL
    );
  `);

  migrarEsquemaUsuarios(db);
  bootstrapUsuarioInicial(db);

  instancia = db;
  return instancia;
}
