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
  gestionCapital?: {
    fase: FaseArbol;
    onIngresar: (monto: number) => void;
    desgloseRetiro: DesgloseDisponibleRetiro;
    onRetirar: (monto: number) => void;
  };
}

function FilaStat({
  label,
  value,
  tone = "text-slate-200",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-medium uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p className={`truncate text-sm font-medium tabular-nums leading-tight ${tone}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * Cabecera con el balance global y progreso hacia la meta mensual.
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

  const metricas = useMemo(() => {
    const items: { label: string; value: string; tone: string }[] = [];

    if (apuestas.cantidad > 0) {
      items.push(
        {
          label: "En juego",
          value: formatearEuros(apuestas.enJuego),
          tone: "text-amber-200/90",
        },
        {
          label: "Si pierdes",
          value: formatearEuros(apuestas.saldoTrasPerderActivas),
          tone: "text-slate-300",
        },
        {
          label: "Esperado",
          value: `+${formatearEuros(apuestas.gananciaEsperada)}`,
          tone: "text-emerald-300/90",
        },
      );
    }

    items.push(
      { label: "Hucha", value: formatearEuros(hucha), tone: "text-sky-200/80" },
      {
        label: "Ganancias",
        value: `${enPositivo ? "+" : ""}${formatearEuros(bankroll.gananciasAcumuladas)}`,
        tone: enPositivo ? "text-emerald-300/90" : "text-rose-300/90",
      },
    );

    if (reserva > 0) {
      items.push({
        label: "Sin asignar",
        value: formatearEuros(reserva),
        tone: "text-violet-200/80",
      });
    }

    return items;
  }, [apuestas, hucha, reserva, enPositivo, bankroll.gananciasAcumuladas]);

  return (
    <>
      <header className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-slate-900/50 px-4 py-4 backdrop-blur-sm sm:px-5 sm:py-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-10 h-32 w-32 rounded-full bg-emerald-500/[0.07] blur-3xl"
        />

        {/* Saldo */}
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              {apuestas.cantidad > 0 ? "Disponible" : "Saldo"}
            </p>
            {gestionCapital ? (
              <button
                type="button"
                onClick={() => setModalRetiro(true)}
                disabled={gestionCapital.desgloseRetiro.saldoRetirable <= 0}
                title="Retirar capital"
                className="group mt-1 block max-w-full text-left disabled:opacity-40"
              >
                <span className="block truncate bg-gradient-to-r from-slate-50 to-slate-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent tabular-nums transition group-hover:from-emerald-100 group-hover:to-emerald-300 sm:text-4xl">
                  {formatearEuros(bankroll.balanceActual)}
                </span>
              </button>
            ) : (
              <p className="mt-1 truncate text-3xl font-semibold tracking-tight text-slate-50 tabular-nums sm:text-4xl">
                {formatearEuros(bankroll.balanceActual)}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {gestionCapital ? (
              <button
                type="button"
                onClick={() => setModalIngresar(true)}
                title="Ingresar capital"
                aria-label="Ingresar capital"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.06] text-lg font-light text-slate-300 transition hover:bg-emerald-500/15 hover:text-emerald-200"
              >
                +
              </button>
            ) : null}
            {onReiniciar ? (
              <button
                type="button"
                onClick={onReiniciar}
                title="Reiniciar mes"
                aria-label="Reiniciar"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.04] text-sm text-slate-500 transition hover:bg-white/[0.08] hover:text-slate-300"
              >
                ↺
              </button>
            ) : null}
          </div>
        </div>

        {/* Métricas en una sola rejilla */}
        <div
          className={`relative mt-3 grid gap-x-3 gap-y-2.5 sm:gap-x-4 ${
            metricas.length <= 2 ? "grid-cols-2" : "grid-cols-3"
          }`}
        >
          {metricas.map((m) => (
            <FilaStat key={m.label} label={m.label} value={m.value} tone={m.tone} />
          ))}
        </div>

        {/* Meta */}
        <div className="relative mt-3 border-t border-white/[0.05] pt-2.5">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
            <span className="text-slate-500">Meta mensual</span>
            <span className="tabular-nums text-slate-400">
              <span
                className={
                  metaAlcanzada ? "font-medium text-emerald-400" : "text-slate-300"
                }
              >
                {pct.toFixed(0)}%
              </span>
              <span className="text-slate-600">
                {" "}
                · {formatearEuros(bankroll.metaMensual)}
              </span>
            </span>
          </div>
          <div
            className="h-[3px] w-full overflow-hidden rounded-full bg-white/[0.05]"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso hacia la meta mensual"
          >
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                metaAlcanzada
                  ? "bg-gradient-to-r from-emerald-400 to-teal-300"
                  : "bg-gradient-to-r from-emerald-600/90 to-emerald-400/70"
              }`}
              style={{ width: `${Math.max(pct, 1.5)}%` }}
            />
          </div>
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
