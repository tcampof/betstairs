"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

type ModoAuth = "login" | "register";

export function FormAuth() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [modo, setModo] = useState<ModoAuth>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const destino = searchParams.get("next") || "/";

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setError(null);
    setCargando(true);

    const ruta = modo === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const respuesta = await fetch(ruta, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const datos = (await respuesta.json()) as { error?: string };

      if (!respuesta.ok) {
        setError(datos.error ?? "No se pudo completar la operación");
        return;
      }

      router.replace(destino);
      router.refresh();
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="glass-card mx-auto w-full max-w-md p-6 sm:p-8">
      <header className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-slate-50">
          Árbol de Escaleras
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {modo === "login"
            ? "Inicia sesión para acceder a tu bankroll"
            : "Crea una cuenta para guardar tu progreso"}
        </p>
      </header>

      <form onSubmit={enviar} className="space-y-4">
        <div>
          <label
            htmlFor="auth-email"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-glass w-full"
            placeholder="tu@email.com"
          />
        </div>

        <div>
          <label
            htmlFor="auth-password"
            className="mb-1 block text-xs font-medium text-slate-400"
          >
            Contraseña
          </label>
          <input
            id="auth-password"
            type="password"
            autoComplete={
              modo === "login" ? "current-password" : "new-password"
            }
            required
            minLength={modo === "register" ? 8 : 1}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-glass w-full"
            placeholder={modo === "register" ? "Mínimo 8 caracteres" : ""}
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm text-rose-300">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={cargando}
          className="btn-glass w-full font-semibold border-emerald-300/30 bg-emerald-400/15 text-emerald-50 hover:border-emerald-300/50 hover:bg-emerald-400/25 disabled:opacity-50"
        >
          {cargando
            ? "Espera…"
            : modo === "login"
              ? "Entrar"
              : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-400">
        {modo === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
        <button
          type="button"
          onClick={() => {
            setModo(modo === "login" ? "register" : "login");
            setError(null);
          }}
          className="font-medium text-sky-300 hover:text-sky-200"
        >
          {modo === "login" ? "Regístrate" : "Inicia sesión"}
        </button>
      </p>
    </div>
  );
}
