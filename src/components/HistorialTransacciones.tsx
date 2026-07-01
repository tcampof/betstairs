"use client";

import type { ResultadoApuesta, Transaccion } from "@/types";
import { formatearCuota, formatearEuros, formatearFecha } from "@/lib/format";

interface HistorialTransaccionesProps {
  historial: Transaccion[];
  /** Si true, muestra botón de deshacer en la última entrada resuelta. */
  puedeDeshacerUltima?: boolean;
  onDeshacerUltima?: () => void;
}

const ESTILO_RESULTADO: Record<ResultadoApuesta, string> = {
  pendiente: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
  ganado: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  perdido: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
};

const ETIQUETA_RESULTADO: Record<ResultadoApuesta, string> = {
  pendiente: "Pendiente",
  ganado: "Ganada",
  perdido: "Perdida",
};

/** Lista cronológica de las apuestas (peldaños) de una rama. */
export function HistorialTransacciones({
  historial,
  puedeDeshacerUltima = false,
  onDeshacerUltima,
}: HistorialTransaccionesProps) {
  if (historial.length === 0) {
    return (
      <p className="px-1 py-3 text-center text-xs text-slate-500">
        Sin apuestas registradas todavía.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {historial.map((t, indice) => {
        const esUltima = indice === historial.length - 1;
        const mostrarDeshacer =
          esUltima && puedeDeshacerUltima && onDeshacerUltima;

        return (
          <li
            key={t.id}
            className="glass-inset flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">
                  #{indice + 1}
                </span>
                <span className="truncate text-sm text-slate-200">
                  {t.partido || "Sin partido"}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
                <span>Cuota {formatearCuota(t.cuota)}</span>
                <span aria-hidden>·</span>
                <span>{formatearEuros(t.stake)}</span>
                <span aria-hidden>·</span>
                <span>
                  {t.tipo === "tiros_libres" ? "Tiros libres" : "Otros"}
                </span>
                {t.fecha ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{formatearFecha(t.fecha)}</span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
              {mostrarDeshacer ? (
                <button
                  type="button"
                  onClick={onDeshacerUltima}
                  title="Deshacer esta resolución"
                  className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-400/50 hover:bg-slate-500/20 hover:text-slate-100"
                >
                  ↩ Deshacer
                </button>
              ) : null}
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                  ESTILO_RESULTADO[t.resultado]
                }`}
              >
                {ETIQUETA_RESULTADO[t.resultado]}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
