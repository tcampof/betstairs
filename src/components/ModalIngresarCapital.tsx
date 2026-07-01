"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import type { FaseArbol } from "@/types";
import { UMBRAL_RAMIFICACION } from "@/lib/escaleras";
import { formatearEuros } from "@/lib/format";

interface ModalIngresarCapitalProps {
  abierto: boolean;
  fase: FaseArbol;
  onCerrar: () => void;
  onIngresar: (monto: number) => void;
}

/** Modal para ingresar efectivo al bankroll (solo depósito). */
export function ModalIngresarCapital({
  abierto,
  fase,
  onCerrar,
  onIngresar,
}: ModalIngresarCapitalProps) {
  const tituloId = useId();
  const [montado, setMontado] = useState(false);
  const [montoTexto, setMontoTexto] = useState("");

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!abierto) setMontoTexto("");
  }, [abierto]);

  if (!montado || !abierto) return null;

  const montoNum = Number.parseFloat(montoTexto.replace(",", "."));
  const valido = Number.isFinite(montoNum) && montoNum > 0;

  const previewEntero = valido ? Math.floor(montoNum) : 0;
  const previewCentimos = valido
    ? Math.round((montoNum - previewEntero + Number.EPSILON) * 100) / 100
    : 0;
  const mostrarPreview =
    fase === "inicial" && valido && (previewEntero > 0 || previewCentimos > 0);

  const confirmar = () => {
    if (!valido) return;
    onIngresar(montoNum);
    setMontoTexto("");
    onCerrar();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="presentation"
      onClick={onCerrar}
    >
      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="glass-card relative w-full max-w-md p-5 shadow-2xl animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={tituloId} className="text-base font-semibold text-violet-100">
          Ingresar capital
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Añade efectivo a tu bankroll. La parte entera queda disponible para
          asignar; los céntimos van a la hucha.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={montoTexto}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d*(?:[.,]\d{0,2})?$/.test(v)) setMontoTexto(v);
            }}
            placeholder="Importe (€)"
            className="input-glass min-w-0 flex-1 px-3 py-2 text-sm"
            autoFocus
          />
          <button
            type="button"
            disabled={!valido}
            onClick={confirmar}
            className="btn-glass shrink-0 border-violet-300/30 bg-violet-400/15 px-4 font-semibold text-violet-50"
          >
            Ingresar
          </button>
        </div>

        {mostrarPreview ? (
          <p className="mt-2 text-xs text-slate-400">
            {previewEntero > 0 ? (
              <>
                <span className="text-violet-300">
                  {formatearEuros(previewEntero)} disponible
                </span>
                {previewCentimos > 0 ? " · " : null}
              </>
            ) : null}
            {previewCentimos > 0 ? (
              <span className="text-sky-300">
                {formatearEuros(previewCentimos)} → hucha
              </span>
            ) : null}
            {previewEntero > UMBRAL_RAMIFICACION ? (
              <span className="mt-1 block text-amber-300/90">
                Tras ingresar podrás elegir 4 escaleras o Fase 1 simple.
              </span>
            ) : null}
          </p>
        ) : null}

        <button
          type="button"
          onClick={onCerrar}
          className="btn-glass btn-glass-ghost mt-4 w-full text-sm font-semibold"
        >
          Cancelar
        </button>
      </div>
    </div>,
    document.body,
  );
}
