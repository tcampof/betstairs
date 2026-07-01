"use client";

import { useMemo, useState } from "react";

import type { BankrollGlobal, FaseArbol, RamaEscalera } from "@/types";
import { porcentajeMeta, resumenApuestasActivas } from "@/lib/escaleras";
import { formatearEuros } from "@/lib/format";
import { ModalIngresarCapital } from "@/components/ModalIngresarCapital";
import { ModalRetiroCapital } from "@/components/ModalRetiroCapital";
import type { DesgloseDisponibleRetiro } from "@/lib/escaleras";

interface BankrollHeaderProps {
  bankroll: BankrollGlobal;
  ramas?: RamaEscalera[];
  hucha?: number;
  reserva?: number;
  onReiniciar?: () => void;
  /** Ingresar / retirar capital. */
  gestionCapital?: {
    fase: FaseArbol;
    onIngresar: (monto: number) => void;
    desgloseRetiro: DesgloseDisponibleRetiro;
    onRetirar: (monto: number) => void;
  };
}

/**
 * Cabecera con el balance global y una barra de progreso hacia la meta mensual.
 */
export function BankrollHeader({
  bankroll,
  ramas = [],
  hucha = 0,
  reserva = 0,
  onReiniciar,
  gestionCapital,
}: BankrollHeaderProps) {
  const [modalIngresar, setModalIngresar] = useState(false);
  const [modalRetiro, setModalRetiro] = useState(false);
  const pct = porcentajeMeta(bankroll);
  const enPositivo = bankroll.gananciasAcumuladas >= 0;
  const metaAlcanzada = pct >= 100;

  const apuestas = useMemo(
    () => resumenApuestasActivas(bankroll.balanceActual, ramas),
    [bankroll.balanceActual, ramas],
  );

  return (
    <>
      <header className="glass-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-slate-400">
              Árbol de Escaleras
            </p>
            <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0">
              {gestionCapital ? (
                <button
                  type="button"
                  onClick={() => setModalRetiro(true)}
                  disabled={gestionCapital.desgloseRetiro.saldoRetirable <= 0}
                  title="Retirar del saldo"
                  className="group flex items-baseline gap-x-2 rounded-md border border-transparent px-1 -mx-1 transition hover:border-emerald-400/25 hover:bg-emerald-400/[0.04] disabled:opacity-50 disabled:hover:border-transparent disabled:hover:bg-transparent"
                >
                  <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl group-hover:text-emerald-50">
                    {formatearEuros(bankroll.balanceActual)}
                  </h1>
                  <span
                    aria-hidden
                    className="text-sm text-emerald-400/60 group-hover:text-emerald-300"
                  >
                    ↓
                  </span>
                </button>
              ) : (
                <h1 className="text-2xl font-bold tracking-tight text-slate-50 sm:text-3xl">
                  {formatearEuros(bankroll.balanceActual)}
                </h1>
              )}
              <span className="text-xs font-medium text-slate-500">
                {apuestas.cantidad > 0 ? "disponible" : "total"}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.06] pt-2 text-[11px] text-slate-500 sm:text-xs">
              {apuestas.cantidad > 0 ? (
                <>
                  <span>
                    En juego{" "}
                    <span className="font-medium text-amber-300/85">
                      {formatearEuros(apuestas.enJuego)}
                    </span>
                    <span className="text-slate-600">
                      {" "}
                      · {apuestas.cantidad}{" "}
                      {apuestas.cantidad === 1 ? "apuesta" : "apuestas"}
                    </span>
                  </span>
                  <span className="hidden text-slate-600 sm:inline" aria-hidden>
                    |
                  </span>
                  <span>
                    Tras perder{" "}
                    <span className="font-medium text-slate-400">
                      {formatearEuros(apuestas.saldoTrasPerderActivas)}
                    </span>
                  </span>
                  <span className="hidden text-slate-600 sm:inline" aria-hidden>
                    |
                  </span>
                  <span>
                    Ganancia esp.{" "}
                    <span className="font-medium text-emerald-400/90">
                      +{formatearEuros(apuestas.gananciaEsperada)}
                    </span>
                  </span>
                </>
              ) : (
                <span className="text-slate-600">Sin apuestas activas</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {gestionCapital ? (
              <button
                type="button"
                onClick={() => setModalIngresar(true)}
                title="Ingresar dinero"
                className="group flex items-center gap-1 rounded-md border border-violet-400/20 bg-violet-400/5 px-2.5 py-1.5 text-sm font-semibold text-violet-200 transition hover:border-violet-400/40 hover:bg-violet-400/10"
              >
                Ingresar
                <span aria-hidden className="text-violet-400 group-hover:text-violet-300">
                  +
                </span>
              </button>
            ) : null}

            {reserva > 0 ? (
              <div className="text-right">
                <p className="text-xs text-slate-500">Sin asignar</p>
                <p className="font-semibold text-violet-300/90">
                  {formatearEuros(reserva)}
                </p>
              </div>
            ) : null}

            <div>
              <p className="text-xs text-slate-500">Hucha</p>
              <p className="font-semibold text-sky-300">
                {formatearEuros(hucha)}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-500">Ganancias</p>
              <p
                className={`font-semibold ${
                  enPositivo ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {enPositivo ? "+" : ""}
                {formatearEuros(bankroll.gananciasAcumuladas)}
              </p>
            </div>

            {onReiniciar ? (
              <button
                type="button"
                onClick={onReiniciar}
                className="btn-glass btn-glass-ghost px-2.5 py-1.5 text-xs hover:border-rose-400/40 hover:text-rose-200"
              >
                Reiniciar
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1.5 flex items-center justify-between text-xs sm:text-sm">
            <span className="text-slate-400">
              Meta ·{" "}
              <span className="font-medium text-slate-200">
                {formatearEuros(bankroll.metaMensual)}
              </span>
            </span>
            <span
              className={`font-semibold ${
                metaAlcanzada ? "text-emerald-400" : "text-slate-300"
              }`}
            >
              {pct.toFixed(1)}%
            </span>
          </div>

          <div
            className="h-2 w-full overflow-hidden rounded-full border border-white/10 bg-white/[0.04]"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso hacia la meta mensual"
          >
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                metaAlcanzada
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-300"
                  : "bg-gradient-to-r from-emerald-600 to-teal-400"
              }`}
              style={{ width: `${Math.max(pct, 2)}%` }}
            />
          </div>

          {metaAlcanzada ? (
            <p className="mt-1.5 text-xs font-medium text-emerald-400">
              Meta mensual alcanzada
            </p>
          ) : null}
        </div>
      </header>

      {gestionCapital ? (
        <>
          <ModalIngresarCapital
            abierto={modalIngresar}
            fase={gestionCapital.fase}
            onCerrar={() => setModalIngresar(false)}
            onIngresar={gestionCapital.onIngresar}
          />
          <ModalRetiroCapital
            abierto={modalRetiro}
            desglose={gestionCapital.desgloseRetiro}
            onCerrar={() => setModalRetiro(false)}
            onRetirar={gestionCapital.onRetirar}
          />
        </>
      ) : null}
    </>
  );
}
