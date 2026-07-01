"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import type { PendienteEleccionRotura } from "@/lib/escaleras";
import { formatearEuros } from "@/lib/format";

interface ModalEleccionRoturaProps {
  datos: PendienteEleccionRotura;
  onReponer: (ramaId: string) => void;
  onContinuar: (ramaId: string) => void;
}

/** Tras una rotura con todas las apuestas resueltas: reponer o seguir con menos escaleras. */
export function ModalEleccionRotura({
  datos,
  onReponer,
  onContinuar,
}: ModalEleccionRoturaProps) {
  const tituloId = useId();
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  if (!montado) return null;

  const {
    ramaId,
    nombreRama,
    capitalRemanente,
    escalerasSiReponer,
    escalerasSiContinuar,
    porRamaSiReponer,
    porRamaSiContinuar,
    sobranteSiReponer,
    sobranteSiContinuar,
  } = datos;

  const puedeReponer = porRamaSiReponer >= 1;
  const puedeContinuar = porRamaSiContinuar >= 1 && escalerasSiContinuar >= 1;

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
          Escalera rota
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          <span className="font-medium text-rose-200">{nombreRama}</span> ha
          roto. Capital vivo en las demás:{" "}
          <span className="text-slate-200">
            {formatearEuros(capitalRemanente)}
          </span>
          . ¿Qué quieres hacer?
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onReponer(ramaId)}
            disabled={!puedeReponer}
            className="btn-glass btn-glass-emerald w-full px-4 py-3 text-left font-semibold disabled:opacity-40"
          >
            <span className="block">Reponer la escalera</span>
            <span className="mt-0.5 block text-xs font-normal text-emerald-100/80">
              {puedeReponer
                ? `${escalerasSiReponer} × ${formatearEuros(porRamaSiReponer)}${
                    sobranteSiReponer > 0
                      ? ` (${formatearEuros(sobranteSiReponer)} a hucha)`
                      : ""
                  }`
                : "Capital insuficiente para repartir"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onContinuar(ramaId)}
            disabled={!puedeContinuar}
            className="btn-glass btn-glass-ghost w-full px-4 py-3 text-left font-semibold disabled:opacity-40"
          >
            <span className="block">
              Continuar con {escalerasSiContinuar}{" "}
              {escalerasSiContinuar === 1 ? "escalera" : "escaleras"}
            </span>
            <span className="mt-0.5 block text-xs font-normal text-slate-400">
              {puedeContinuar
                ? `${escalerasSiContinuar} × ${formatearEuros(porRamaSiContinuar)}${
                    sobranteSiContinuar > 0
                      ? ` (${formatearEuros(sobranteSiContinuar)} a hucha)`
                      : ""
                  }`
                : "No quedan escaleras suficientes"}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
