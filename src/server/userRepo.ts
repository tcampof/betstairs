import { hashPassword, verifyPassword } from "@/server/auth";
import {
  adoptarLegacyAUsuario,
  ensureDb,
  queryOne,
  runInsert,
} from "@/server/db";

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

function filaAUsuario(fila: {
  id: number;
  email: string;
  created_at: string;
}): Usuario {
  return {
    id: fila.id,
    email: fila.email,
    createdAt: fila.created_at,
  };
}

export async function buscarUsuarioPorEmail(
  email: string,
): Promise<(Usuario & { passwordHash: string }) | null> {
  await ensureDb();

  const fila = await queryOne<FilaUsuario>(
    "SELECT id, email, password_hash, created_at FROM users WHERE email = ? COLLATE NOCASE",
    [email.trim().toLowerCase()],
  );

  if (!fila) return null;
  return { ...filaAUsuario(fila), passwordHash: fila.password_hash };
}

export async function buscarUsuarioPorId(id: number): Promise<Usuario | null> {
  await ensureDb();

  const fila = await queryOne<Pick<FilaUsuario, "id" | "email" | "created_at">>(
    "SELECT id, email, created_at FROM users WHERE id = ?",
    [id],
  );

  if (!fila) return null;
  return filaAUsuario(fila);
}

export async function crearUsuario(
  email: string,
  password: string,
): Promise<Usuario> {
  await ensureDb();

  const normalizado = email.trim().toLowerCase();
  const ahora = new Date().toISOString();

  const userId = await runInsert(
    "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
    [normalizado, hashPassword(password), ahora],
  );

  await adoptarLegacyAUsuario(userId);
  return { id: userId, email: normalizado, createdAt: ahora };
}

export async function verificarCredenciales(
  email: string,
  password: string,
): Promise<Usuario | null> {
  const usuario = await buscarUsuarioPorEmail(email);
  if (!usuario || !verifyPassword(password, usuario.passwordHash)) {
    return null;
  }
  const { passwordHash: _, ...publico } = usuario;
  return publico;
}
