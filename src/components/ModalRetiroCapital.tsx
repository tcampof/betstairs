"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import type { DesgloseDisponibleRetiro } from "@/lib/escaleras";
import { formatearEuros } from "@/lib/format";

interface ModalRetiroCapitalProps {
  abierto: boolean;
  desglose: DesgloseDisponibleRetiro;
  onCerrar: () => void;
  onRetirar: (monto: number) => void;
}

/** Modal para retirar del saldo (hucha, reserva y escaleras libres). */
export function ModalRetiroCapital({
  abierto,
  desglose,
  onCerrar,
  onRetirar,
}: ModalRetiroCapitalProps) {
  const tituloId = useId();
  const [montado, setMontado] = useState(false);
  const [montoTexto, setMontoTexto] = useState("");

  useEffect(() => setMontado(true), []);

  useEffect(() => {
    if (!abierto) setMontoTexto("");
  }, [abierto]);

  if (!montado || !abierto) return null;

  const maxRetiro = desglose.saldoRetirable;
  const montoNum = Number.parseFloat(montoTexto.replace(",", "."));
  const valido =
    Number.isFinite(montoNum) &&
    montoNum > 0 &&
    montoNum <= maxRetiro + Number.EPSILON;

  const confirmar = () => {
    if (!valido) return;
    if (
      window.confirm(
        `¿Retirar ${formatearEuros(montoNum)} del saldo? Las apuestas en curso no se modificarán.`,
      )
    ) {
      onRetirar(montoNum);
      onCerrar();
    }
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
        <h2 id={tituloId} className="text-base font-semibold text-slate-100">
          Retirar del saldo
        </h2>
        <p className="mt-1 text-xs text-slate-400">
          Saldo total{" "}
          <span className="text-slate-300">
            {formatearEuros(desglose.saldoTotal)}
          </span>
          {" · retirable "}
          <span className="font-semibold text-emerald-300/90">
            {formatearEuros(maxRetiro)}
          </span>
        </p>

        <dl className="mt-3 space-y-1.5 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Hucha (incluida en el retiro)</dt>
            <dd className="font-medium text-sky-300">
              {formatearEuros(desglose.hucha)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Reserva</dt>
            <dd className="font-medium text-violet-300">
              {formatearEuros(desglose.reserva)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Escaleras (sin lo apostado)</dt>
            <dd className="font-medium text-slate-300">
              {formatearEuros(desglose.enEscaleras)}
            </dd>
          </div>
          {desglose.bloqueadoEnJuego > 0 ? (
            <div className="flex justify-between gap-3 border-t border-white/[0.06] pt-1.5">
              <dt className="text-slate-600">Apostado en curso</dt>
              <dd className="text-amber-300/70">
                {formatearEuros(desglose.bloqueadoEnJuego)} (protegido)
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-4 flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={montoTexto}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "" || /^\d*(?:[.,]\d{0,2})?$/.test(v)) setMontoTexto(v);
            }}
            placeholder={`Máx. ${formatearEuros(maxRetiro)}`}
            className="input-glass min-w-0 flex-1 px-3 py-2 text-sm"
            autoFocus
          />
          <button
            type="button"
            disabled={maxRetiro <= 0}
            onClick={() =>
              setMontoTexto(maxRetiro.toFixed(2).replace(".", ","))
            }
            className="btn-glass btn-glass-ghost shrink-0 px-2 text-xs font-semibold"
          >
            Todo
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="btn-glass btn-glass-ghost flex-1 text-sm font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!valido}
            onClick={confirmar}
            className="btn-glass flex-1 border-emerald-400/30 bg-emerald-400/15 text-sm font-semibold text-emerald-50 hover:bg-emerald-400/25"
          >
            Retirar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
