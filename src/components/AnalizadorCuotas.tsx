"use client";

import { useCallback, useState } from "react";

import { LIGAS_FUTBOL, LIGA_POR_DEFECTO } from "@/lib/ligas";

const SOLO_UNA_COMPETICION = LIGAS_FUTBOL.length === 1;
const NOMBRE_COMPETICION = LIGAS_FUTBOL[0]?.nombre ?? "Competición";
import { formatearCuota, formatearFecha } from "@/lib/format";
import type {
  EventoAnalizado,
  RespuestaCuotas,
  ResultadoAnalizado,
} from "@/types/cuotas";

function porcentaje(valor: number): string {
  return `${(valor * 100).toFixed(1)}%`;
}

/** Fila de un resultado (Local / Empate / Visitante) con su análisis. */
function FilaResultado({ r }: { r: ResultadoAnalizado }) {
  return (
    <div
      className={`flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
        r.encajaObjetivo
          ? "border-emerald-300/40 bg-emerald-400/10"
          : "border-white/[0.06] bg-white/[0.02]"
      }`}
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-100">{r.nombre}</p>
        <p className="text-xs text-slate-500">
          Prob. {porcentaje(r.probImplicita)} · justa{" "}
          {porcentaje(r.probJusta)} ({formatearCuota(r.cuotaJusta)})
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {r.esValor ? (
          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
            +{porcentaje(r.valor)}
          </span>
        ) : null}
        <div className="text-right">
          <p className="text-base font-bold text-slate-50">
            {formatearCuota(r.mejorCuota)}
          </p>
          <p className="max-w-[7rem] truncate text-[11px] text-slate-500">
            {r.mejorCasa}
          </p>
        </div>
      </div>
    </div>
  );
}

function TarjetaEvento({ evento }: { evento: EventoAnalizado }) {
  return (
    <article className="glass-inset flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">
            {evento.local} <span className="text-slate-500">vs</span>{" "}
            {evento.visitante}
          </p>
          <p className="text-xs text-slate-500">
            {formatearFecha(evento.comienza)} · {evento.numCasas} casas · margen{" "}
            {porcentaje(evento.margenMedio)}
          </p>
        </div>
        {evento.encajaObjetivo ? (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
            Encaja
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        {evento.resultados.map((r) => (
          <FilaResultado key={r.nombre} r={r} />
        ))}
      </div>
    </article>
  );
}

/** Módulo de análisis de cuotas (1X2) consumiendo The Odds API vía /api/cuotas. */
export function AnalizadorCuotas() {
  const [liga, setLiga] = useState(LIGA_POR_DEFECTO);
  const [objetivo, setObjetivo] = useState("");
  const [datos, setDatos] = useState<RespuestaCuotas | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analizar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams({ liga });
      const obj = Number.parseFloat(objetivo.replace(",", "."));
      if (Number.isFinite(obj) && obj > 1) params.set("objetivo", String(obj));

      const res = await fetch(`/api/cuotas?${params.toString()}`, {
        cache: "no-store",
      });
      const cuerpo = await res.json();

      if (!res.ok) {
        setError(cuerpo?.error ?? "No se pudieron obtener las cuotas.");
        setDatos(null);
      } else {
        setDatos(cuerpo as RespuestaCuotas);
      }
    } catch {
      setError("Error de red al consultar las cuotas.");
      setDatos(null);
    } finally {
      setCargando(false);
    }
  }, [liga, objetivo]);

  return (
    <section className="glass-card p-4 sm:p-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Competición
          </span>
          {SOLO_UNA_COMPETICION ? (
            <span className="input-glass flex items-center px-3 py-2 text-sm font-medium text-slate-100">
              {NOMBRE_COMPETICION}
            </span>
          ) : (
            <select
              value={liga}
              onChange={(e) => setLiga(e.target.value)}
              className="input-glass px-3 py-2 text-sm"
            >
              {LIGAS_FUTBOL.map((l) => (
                <option key={l.clave} value={l.clave}>
                  {l.nombre}
                </option>
              ))}
            </select>
          )}
        </label>

        <label className="flex w-32 flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Cuota objetivo
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            placeholder="Ej. 1.85"
            className="input-glass px-3 py-2 text-sm"
          />
        </label>

        <button
          type="button"
          onClick={analizar}
          disabled={cargando}
          className="btn-glass btn-glass-emerald font-semibold"
        >
          {cargando ? "Analizando…" : "Analizar cuotas"}
        </button>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        La <span className="text-emerald-300">cuota objetivo</span> resalta los
        partidos cuya mejor cuota encaja con el peldaño que quieres dar. El
        análisis usa cuotas con ~1 min de retardo y se cachea 10 min.
      </p>

      {error ? (
        <div className="mt-4 rounded-md border border-rose-400/30 bg-rose-500/[0.08] p-3 text-sm text-rose-200 backdrop-blur-md">
          {error}
        </div>
      ) : null}

      {datos ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              {datos.eventos.length} partidos · {datos.enCache ? "caché" : "en vivo"}
            </span>
            {datos.creditosRestantes !== null ? (
              <span>Créditos restantes: {datos.creditosRestantes}</span>
            ) : null}
          </div>

          {datos.eventos.length === 0 ? (
            <p className="rounded-md border border-white/[0.06] bg-white/[0.02] p-4 text-center text-sm text-slate-400">
              No hay partidos próximos con cuotas en este momento.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {datos.eventos.map((evento) => (
                <TarjetaEvento key={evento.id} evento={evento} />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
