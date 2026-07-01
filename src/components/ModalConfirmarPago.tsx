"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import {
  cuotaEfectivaDesdePago,
  pagoTeoricoApuesta,
} from "@/lib/escaleras";
import { formatearCuota, formatearEuros } from "@/lib/format";

interface ModalConfirmarPagoProps {
  abierto: boolean;
  stake: number;
  cuota: number;
  partido: string;
  onCerrar: () => void;
  onConfirmar: (pagoReal: number) => void;
}

/** Modal para confirmar el pago bruto de la casa antes de marcar ganada. */
export function ModalConfirmarPago({
  abierto,
  stake,
  cuota,
  partido,
  onCerrar,
  onConfirmar,
}: ModalConfirmarPagoProps) {
  const tituloId = useId();
  const [pagoTexto, setPagoTexto] = useState("");
  const [montado, setMontado] = useState(false);

  const pagoCalculado = useMemo(
    () => pagoTeoricoApuesta(stake, cuota),
    [stake, cuota],
  );

  useEffect(() => {
    setMontado(true);
  }, []);

  useEffect(() => {
    if (abierto) {
      setPagoTexto(pagoCalculado.toFixed(2).replace(".", ","));
    }
  }, [abierto, pagoCalculado]);

  if (!montado || !abierto) return null;

  const pagoNum = Number.parseFloat(pagoTexto.replace(",", "."));
  const pagoValido = Number.isFinite(pagoNum) && pagoNum > stake;
  const capitalEscalera = pagoValido ? Math.floor(redondearLocal(pagoNum)) : 0;
  const aHucha = pagoValido
    ? redondearLocal(pagoNum - capitalEscalera)
    : 0;
  const cuotaEfectiva = pagoValido
    ? cuotaEfectivaDesdePago(stake, pagoNum)
    : cuota;
  const difiere =
    pagoValido && Math.abs(pagoNum - pagoCalculado) >= 0.005;

  const confirmar = () => {
    if (!pagoValido) return;
    onConfirmar(redondearLocal(pagoNum));
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
          Confirmar pago de la casa
        </h2>
        <p className="mt-1 truncate text-sm text-slate-400">{partido}</p>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Apostado</dt>
            <dd className="font-medium text-slate-200">
              {formatearEuros(stake)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Cuota declarada</dt>
            <dd className="font-medium text-slate-200">
              {formatearCuota(cuota)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-slate-500">Pago calculado</dt>
            <dd className="text-slate-300">{formatearEuros(pagoCalculado)}</dd>
          </div>
        </dl>

        <label className="mt-4 block">
          <span className="text-xs font-medium uppercase tracking-wider text-emerald-300/90">
            Pago real en la casa
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={pagoTexto}
            onChange={(e) => {
              const valor = e.target.value;
              if (valor === "" || /^\d*(?:[.,]\d{0,2})?$/.test(valor)) {
                setPagoTexto(valor);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmar();
              if (e.key === "Escape") onCerrar();
            }}
            autoFocus
            className="input-glass mt-1.5 w-full px-3 py-2.5 text-lg font-semibold"
          />
        </label>

        {pagoValido ? (
          <div className="glass-inset mt-3 space-y-1.5 p-3 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Capital escalera (entero)</span>
              <span className="font-semibold text-slate-100">
                {formatearEuros(capitalEscalera)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">A la hucha (céntimos)</span>
              <span className="font-semibold text-sky-300">
                {formatearEuros(aHucha)}
              </span>
            </div>
            {difiere ? (
              <div className="flex justify-between border-t border-white/10 pt-1.5">
                <span className="text-slate-500">Cuota efectiva en historial</span>
                <span className="font-semibold text-emerald-300">
                  {formatearCuota(cuotaEfectiva)}
                </span>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-2 text-xs text-rose-300">
            El pago debe ser mayor que lo apostado ({formatearEuros(stake)}).
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="btn-glass btn-glass-ghost flex-1 font-semibold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!pagoValido}
            className="btn-glass btn-glass-emerald flex-1 font-semibold"
          >
            Confirmar ganada
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function redondearLocal(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
