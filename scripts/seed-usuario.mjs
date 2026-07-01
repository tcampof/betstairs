/**
 * Migra el esquema antiguo, crea el usuario inicial y vincula el estado existente.
 *
 * Uso:
 *   npm run seed:usuario
 *
 * Variables (.env):
 *   BOOTSTRAP_USER_EMAIL
 *   BOOTSTRAP_USER_PASSWORD
 *   ARBOL_DB_PATH (opcional)
 */

import { randomBytes, scryptSync } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

function cargarEnvLocal() {
  const ruta = resolve(process.cwd(), ".env");
  if (!existsSync(ruta)) return;
  for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/)) {
    const t = linea.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const clave = t.slice(0, i).trim();
    let valor = t.slice(i + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    if (process.env[clave] === undefined) process.env[clave] = valor;
  }
}

cargarEnvLocal();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function rutaDb() {
  return resolve(process.cwd(), process.env.ARBOL_DB_PATH ?? "./data/arbol.db");
}

function migrarEsquemaUsuarios(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  const columnas = db.prepare("PRAGMA table_info(estado)").all();
  const tieneUserId = columnas.some((c) => c.name === "user_id");

  if (!tieneUserId && columnas.length > 0) {
    const legacy = db
      .prepare("SELECT data, updated_at FROM estado WHERE id = 1")
      .get();

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
      console.log("Estado anterior respaldado para asignar al usuario.");
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

function adoptarLegacy(db, userId) {
  const legacy = db
    .prepare("SELECT data, updated_at FROM legacy_estado_backup LIMIT 1")
    .get();
  if (!legacy) return false;

  const existe = db.prepare("SELECT 1 FROM estado WHERE user_id = ?").get(userId);
  if (existe) return false;

  db.prepare(
    "INSERT INTO estado (user_id, data, updated_at) VALUES (?, ?, ?)",
  ).run(userId, legacy.data, legacy.updated_at);
  db.exec("DELETE FROM legacy_estado_backup");
  return true;
}

function main() {
  const email = process.env.BOOTSTRAP_USER_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_USER_PASSWORD;

  if (!email || !password) {
    console.error(
      "Define BOOTSTRAP_USER_EMAIL y BOOTSTRAP_USER_PASSWORD en .env",
    );
    process.exit(1);
  }

  const ruta = rutaDb();
  mkdirSync(dirname(ruta), { recursive: true });

  const db = new DatabaseSync(ruta);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  migrarEsquemaUsuarios(db);

  let usuario = db
    .prepare("SELECT id, email FROM users WHERE email = ? COLLATE NOCASE")
    .get(email);

  if (!usuario) {
    const ahora = new Date().toISOString();
    const resultado = db
      .prepare(
        "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
      )
      .run(email, hashPassword(password), ahora);
    usuario = { id: Number(resultado.lastInsertRowid), email };
    console.log(`Usuario creado: ${email}`);
  } else {
    console.log(`Usuario ya existía: ${email}`);
  }

  const asignado = adoptarLegacy(db, usuario.id);
  if (asignado) {
    console.log("Estado anterior vinculado a este usuario.");
  } else {
    const fila = db
      .prepare("SELECT length(data) AS len FROM estado WHERE user_id = ?")
      .get(usuario.id);
    if (fila?.len) {
      console.log(`El usuario ya tiene estado guardado (${fila.len} bytes).`);
    } else if (
      db.prepare("SELECT 1 FROM legacy_estado_backup LIMIT 1").get()
    ) {
      console.warn(
        "Hay backup legacy pero no se pudo asignar (¿otro usuario ya lo tiene?).",
      );
    } else {
      console.log("Sin backup legacy; el usuario empezará con estado vacío.");
    }
  }

  db.close();

  console.log("\n--- Credenciales de acceso ---");
  console.log(`Email:      ${email}`);
  console.log(`Contraseña: ${password}`);
  console.log("Entra en /login con estos datos.\n");
}

main();
