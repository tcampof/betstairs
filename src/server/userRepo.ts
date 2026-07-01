import { hashPassword, verifyPassword } from "@/server/auth";
import { getDb } from "@/server/db";

export interface Usuario {
  id: number;
  email: string;
  createdAt: string;
}

interface FilaUsuario {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

function filaAUsuario(fila: FilaUsuario): Usuario {
  return {
    id: fila.id,
    email: fila.email,
    createdAt: fila.created_at,
  };
}

export function buscarUsuarioPorEmail(email: string): (Usuario & { passwordHash: string }) | null {
  const fila = getDb()
    .prepare(
      "SELECT id, email, password_hash, created_at FROM users WHERE email = ? COLLATE NOCASE",
    )
    .get(email.trim().toLowerCase()) as FilaUsuario | undefined;

  if (!fila) return null;
  return { ...filaAUsuario(fila), passwordHash: fila.password_hash };
}

export function buscarUsuarioPorId(id: number): Usuario | null {
  const fila = getDb()
    .prepare("SELECT id, email, created_at FROM users WHERE id = ?")
    .get(id) as Pick<FilaUsuario, "id" | "email" | "created_at"> | undefined;

  if (!fila) return null;
  return {
    id: fila.id,
    email: fila.email,
    createdAt: fila.created_at,
  };
}

/** Adopta el estado legacy (id=1) al primer usuario registrado. */
function adoptarEstadoLegacy(userId: number): void {
  const db = getDb();
  const legacy = db
    .prepare("SELECT data, updated_at FROM legacy_estado_backup LIMIT 1")
    .get() as { data: string; updated_at: string } | undefined;

  if (!legacy) return;

  const existe = db
    .prepare("SELECT 1 FROM estado WHERE user_id = ?")
    .get(userId);

  if (existe) return;

  db.prepare(
    `INSERT INTO estado (user_id, data, updated_at) VALUES (?, ?, ?)`,
  ).run(userId, legacy.data, legacy.updated_at);
  db.exec("DELETE FROM legacy_estado_backup");
}

export function crearUsuario(email: string, password: string): Usuario {
  const normalizado = email.trim().toLowerCase();
  const ahora = new Date().toISOString();

  const resultado = getDb()
    .prepare(
      `INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)`,
    )
    .run(normalizado, hashPassword(password), ahora);

  const userId = Number(resultado.lastInsertRowid);
  adoptarEstadoLegacy(userId);
  return { id: userId, email: normalizado, createdAt: ahora };
}

export function verificarCredenciales(
  email: string,
  password: string,
): Usuario | null {
  const usuario = buscarUsuarioPorEmail(email);
  if (!usuario || !verifyPassword(password, usuario.passwordHash)) {
    return null;
  }
  const { passwordHash: _, ...publico } = usuario;
  return publico;
}
