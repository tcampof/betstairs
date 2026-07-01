"use client";

import { useState } from "react";

import type { TipoApuesta } from "@/types";
import { esCuotaValida, CUOTA_MIN, CUOTA_MAX } from "@/lib/escaleras";

interface FormInicioFase1Props {
  reservaDisponible?: number;
  onIniciar: (
    monto: number,
    cuota: number,
    partido: string,
    tipo: TipoApuesta,
    usarReserva?: boolean,
  ) => void;
}

/** Formulario para arrancar la Fase 1 (el tronco del árbol). */
export function FormInicioFase1({
  reservaDisponible = 0,
  onIniciar,
}: FormInicioFase1Props) {
  const [monto, setMonto] = useState("");
  const [cuota, setCuota] = useState("");
  const [partido, setPartido] = useState("");
  const [tipo, setTipo] = useState<TipoApuesta>("tiros_libres");
  const [usarReserva, setUsarReserva] = useState(reservaDisponible > 0);

  const montoNum = Number.parseFloat(monto.replace(",", "."));
  const cuotaNum = Number.parseFloat(cuota.replace(",", "."));
  const reservaOk = !usarReserva || (montoNum > 0 && montoNum <= reservaDisponible);
  const valido =
    montoNum > 0 &&
    esCuotaValida(cuotaNum) &&
    partido.trim() !== "" &&
    reservaOk;

  // Permite hasta 5 decimales mientras se escribe (coma o punto).
  const handleCuotaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    if (valor === "" || /^\d*(?:[.,]\d{0,5})?$/.test(valor)) {
      setCuota(valor);
    }
  };

  // Al perder el foco, normaliza la visualización a 2 decimales.
  const handleCuotaBlur = () => {
    const n = Number.parseFloat(cuota.replace(",", "."));
    if (!Number.isNaN(n)) {
      setCuota(n.toFixed(2));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valido) return;
    onIniciar(montoNum, cuotaNum, partido.trim(), tipo, usarReserva);
  };

  return (
    <div className="mx-auto max-w-md animate-fade-in">
      <div className="glass-card p-6">
        <h2 className="text-xl font-semibold text-slate-100">
          Iniciar Fase 1
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Define el capital del tronco y la primera apuesta. Puedes usar la
          reserva inyectada o capital nuevo.
        </p>

        {reservaDisponible > 0 ? (
          <p className="mt-2 text-xs text-violet-300">
            Reserva disponible: {reservaDisponible.toFixed(2).replace(".", ",")} €
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
          {reservaDisponible > 0 ? (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={usarReserva}
                onChange={(e) => setUsarReserva(e.target.checked)}
                className="rounded border-white/20 bg-white/5"
              />
              Usar reserva (máx. {reservaDisponible.toFixed(2).replace(".", ",")} €)
            </label>
          ) : null}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              {usarReserva && reservaDisponible > 0
                ? "Capital desde reserva (€)"
                : "Capital inicial (€)"}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="Ej. 50"
              className="input-glass px-3 py-2.5"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Partido / evento
            </span>
            <input
              type="text"
              value={partido}
              onChange={(e) => setPartido(e.target.value.toUpperCase())}
              placeholder="Ej. Real Madrid - Barcelona"
              className="input-glass px-3 py-2.5"
            />
          </label>

          <div className="flex gap-3">
            <label className="flex w-28 flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Cuota
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={cuota}
                onChange={handleCuotaChange}
                onBlur={handleCuotaBlur}
                placeholder={`${CUOTA_MIN.toFixed(2)}–${CUOTA_MAX.toFixed(2)}`}
                className="input-glass px-3 py-2.5"
              />
              {cuota.trim() !== "" && !esCuotaValida(cuotaNum) ? (
                <span className="text-[10px] text-rose-400">
                  Entre {CUOTA_MIN.toFixed(2)} y {CUOTA_MAX.toFixed(2)}
                </span>
              ) : null}
            </label>

            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Tipo
              </span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as TipoApuesta)}
                className="input-glass px-3 py-2.5"
              >
                <option value="tiros_libres">Tiros libres</option>
                <option value="otros">Otros</option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            disabled={!valido}
            className="btn-glass btn-glass-emerald mt-2 w-full px-4 py-3 font-semibold"
          >
            Plantar el tronco
          </button>
        </form>
      </div>
    </div>
  );
}
