"use client";

import { useRef } from "react";

import type { RespaldoArbol } from "@/types";
import { formatearFecha } from "@/lib/format";

interface RecuperacionEstadoProps {
  respaldo: RespaldoArbol | undefined;
  estadoSospechoso: boolean;
  onDeshacerRebalanceo: () => void;
  onImportarEstado: (datos: unknown) => boolean;
}

/** Avisos y acciones para recuperar el árbol tras un rebalanceo erróneo. */
export function RecuperacionEstado({
  respaldo,
  estadoSospechoso,
  onDeshacerRebalanceo,
  onImportarEstado,
}: RecuperacionEstadoProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (!respaldo && !estadoSospechoso) return null;

  const handleImportar = async (archivo: File | undefined) => {
    if (!archivo) return;
    try {
      const texto = await archivo.text();
      const datos: unknown = JSON.parse(texto);
      if (
        window.confirm(
          "¿Reemplazar el estado actual con el contenido del archivo? Se guardará automáticamente.",
        )
      ) {
        const ok = onImportarEstado(datos);
        if (!ok) {
          window.alert(
            "El archivo no tiene un estado válido del árbol de escaleras.",
          );
        }
      }
    } catch {
      window.alert("No se pudo leer el archivo. Comprueba que sea un JSON válido.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (respaldo) {
    const etiquetaMotivo =
      respaldo.motivo === "completar_escaleras"
        ? "completar escaleras"
        : "rebalanceo";

    return (
      <section
        role="alert"
        className="glass-card flex flex-wrap items-center justify-between gap-3 border-sky-300/35 bg-sky-400/[0.08] p-4"
      >
        <div className="flex items-start gap-3">
          <span aria-hidden className="text-xl text-sky-300">
            ↩
          </span>
          <div>
            <h3 className="text-sm font-semibold text-sky-200">
              Respaldo disponible
            </h3>
            <p className="text-xs text-slate-400">
              Hay una copia del árbol anterior al {etiquetaMotivo} del{" "}
              {formatearFecha(respaldo.fecha)} (peldaños, historial y apuestas
              pendientes). Puedes restaurarla si el reparto fue un error.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (
              window.confirm(
                "¿Restaurar el árbol al estado anterior al rebalanceo? Se perderán los cambios posteriores al reparto.",
              )
            ) {
              onDeshacerRebalanceo();
            }
          }}
          className="btn-glass border-sky-300/40 bg-sky-400/15 font-semibold text-sky-100 hover:bg-sky-400/25"
        >
          Deshacer rebalanceo
        </button>
      </section>
    );
  }

  return (
    <section
      role="alert"
      className="glass-card flex flex-col gap-3 border-amber-300/35 bg-amber-400/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="text-xl text-amber-300">
          ⚠
        </span>
        <div>
          <h3 className="text-sm font-semibold text-amber-200">
            Estado posiblemente dañado
          </h3>
          <p className="text-xs text-slate-400">
            Las 4 escaleras están en peldaño 0 sin historial, pero el mes
            registra actividad. Un rebalanceo prematuro borró apuestas y peldaños;
            por eso no aparece «Deshacer última resolución» en cada tarjeta.
            Importa un JSON corregido (p. ej. generado con{" "}
            <code className="text-amber-200/90">scripts/reparar.mjs</code>).
          </p>
        </div>
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => void handleImportar(e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn-glass btn-glass-ghost whitespace-nowrap font-semibold"
        >
          Importar JSON corregido
        </button>
      </div>
    </section>
  );
}
