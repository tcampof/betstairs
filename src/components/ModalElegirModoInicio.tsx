"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import { NUM_RAMAS, UMBRAL_RAMIFICACION } from "@/lib/escaleras";
import { formatearEuros } from "@/lib/format";

export interface DatosModoInicio {
  enteroInyectado: number;
  centimosHucha: number;
}

interface ModalElegirModoInicioProps {
  datos: DatosModoInicio;
  onCuatroEscaleras: () => void;
  onFase1Simple: () => void;
}

/** Tras inyectar > umbral sin escaleras, elige 4 ramas o Fase 1 simple. */
export function ModalElegirModoInicio({
  datos,
  onCuatroEscaleras,
  onFase1Simple,
}: ModalElegirModoInicioProps) {
  const tituloId = useId();
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  if (!montado) return null;

  const { enteroInyectado, centimosHucha } = datos;
  const porRama = Math.floor(enteroInyectado / NUM_RAMAS);
  const sobranteReparto = enteroInyectado - porRama * NUM_RAMAS;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center"
      role="presentation"
    >
      <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="glass-card relative w-full max-w-md p-5 shadow-2xl animate-fade-in"
      >
        <h2 id={tituloId} className="text-base font-semibold text-slate-100">
          ¿Cómo quieres arrancar?
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Has inyectado{" "}
          <span className="font-medium text-violet-200">
            {formatearEuros(enteroInyectado + centimosHucha)}
          </span>
          :{" "}
          <span className="text-violet-300">
            {formatearEuros(enteroInyectado)} en reserva
          </span>
          {centimosHucha > 0 ? (
            <>
              {" "}
              y{" "}
              <span className="text-sky-300">
                {formatearEuros(centimosHucha)} en hucha
              </span>
            </>
          ) : null}
          . Al superar {UMBRAL_RAMIFICACION} € puedes clonar en 4 escaleras o
          empezar con una sola.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={onCuatroEscaleras}
            disabled={porRama < 1}
            className="btn-glass btn-glass-emerald w-full px-4 py-3 text-left font-semibold"
          >
            <span className="block">4 escaleras en paralelo</span>
            <span className="mt-0.5 block text-xs font-normal text-emerald-100/80">
              {porRama >= 1
                ? `${NUM_RAMAS} × ${formatearEuros(porRama)} desde la reserva${
                    sobranteReparto > 0
                      ? ` (${formatearEuros(sobranteReparto)} sobrante a hucha)`
                      : ""
                  }`
                : "Importe insuficiente para repartir en 4"}
            </span>
          </button>

          <button
            type="button"
            onClick={onFase1Simple}
            className="btn-glass btn-glass-ghost w-full px-4 py-3 text-left font-semibold"
          >
            <span className="block">Una escalera (Fase 1)</span>
            <span className="mt-0.5 block text-xs font-normal text-slate-400">
              Mantener {formatearEuros(enteroInyectado)} en reserva y plantar el
              tronco con tu primera apuesta
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
