"use client";

import { useState } from "react";

import type { EstadoRama, FaseArbol, OpcionesAvanzar, RamaEscalera } from "@/types";
import { obtenerApuestaPendiente, puedeDeshacerUltimaResolucion, pagoTeoricoApuesta, UMBRAL_RAMIFICACION, esCuotaValida, CUOTA_MIN, CUOTA_MAX } from "@/lib/escaleras";
import { formatearCuota, formatearEuros } from "@/lib/format";
import { HistorialTransacciones } from "@/components/HistorialTransacciones";
import { ModalConfirmarPago } from "@/components/ModalConfirmarPago";

interface TarjetaRamaProps {
  rama: RamaEscalera;
  fase: FaseArbol;
  /** Ramas que pueden ceder capital a esta (si está rota). */
  reinyectables: RamaEscalera[];
  onAvanzar: (ramaId: string, opciones?: OpcionesAvanzar) => void;
  onRomper: (ramaId: string) => void;
  /** Deshace la última apuesta marcada como ganada o rota. */
  onDeshacer?: (ramaId: string) => void;
  onReinyectar: (ramaOrigenId: string, ramaDestinoId: string) => void;
  /** Cuadra manualmente el capital con el importe exacto de la casa. */
  onAjustarCapital: (ramaId: string, nuevoMonto: number) => void;
  /** Renombra la rama (opcional; no disponible para el tronco de Fase 1). */
  onRenombrar?: (ramaId: string, nombre: string) => void;
  /** Elimina la rama devolviendo su capital a la hucha (opcional). */
  onEliminar?: (ramaId: string) => void;
}

const ESTILO_ACENTO: Record<EstadoRama, string> = {
  activa: "ring-1 ring-white/5 hover:ring-emerald-300/30",
  completada: "ring-1 ring-emerald-300/40",
  rotura: "ring-1 ring-rose-400/30",
};

const ESTILO_BADGE: Record<EstadoRama, string> = {
  activa: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
  completada: "bg-emerald-500/20 text-emerald-200 ring-emerald-400/40",
  rotura: "bg-rose-500/10 text-rose-300 ring-rose-500/30",
};

const ETIQUETA_ESTADO: Record<EstadoRama, string> = {
  activa: "Activa",
  completada: "Completada",
  rotura: "Rotura",
};

interface BotonAccionRedondoProps {
  titulo: string;
  onClick: () => void;
  disabled?: boolean;
  variante?: "emerald" | "rose" | "default";
  children: React.ReactNode;
}

/** Botón circular con icono y tooltip al hover/focus. */
function BotonAccionRedondo({
  titulo,
  onClick,
  disabled = false,
  variante = "default",
  children,
}: BotonAccionRedondoProps) {
  const estiloVariante =
    variante === "emerald"
      ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-50 hover:border-emerald-300/50 hover:bg-emerald-400/25"
      : variante === "rose"
        ? "border-rose-300/30 bg-rose-400/10 text-rose-100 hover:border-rose-300/50 hover:bg-rose-400/20"
        : "hover:text-slate-100";

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={titulo}
        className={`btn-glass-round ${estiloVariante}`}
      >
        {children}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-slate-900/95 px-2.5 py-1 text-xs font-medium text-slate-200 opacity-0 shadow-lg backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {titulo}
      </span>
    </div>
  );
}

/** Panel individual de una escalera, con sus acciones (avanzar / romper). */
export function TarjetaRama({
  rama,
  fase,
  reinyectables,
  onAvanzar,
  onRomper,
  onDeshacer,
  onReinyectar,
  onAjustarCapital,
  onRenombrar,
  onEliminar,
}: TarjetaRamaProps) {
  const [partido, setPartido] = useState("");
  const [cuota, setCuota] = useState("");
  const [origenSeleccionado, setOrigenSeleccionado] = useState("");
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [editandoCapital, setEditandoCapital] = useState(false);
  const [capitalEditado, setCapitalEditado] = useState("");
  const [colapsada, setColapsada] = useState(false);
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreEditado, setNombreEditado] = useState("");
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false);

  const pendiente = obtenerApuestaPendiente(rama);
  const puedeDeshacer =
    onDeshacer !== undefined && puedeDeshacerUltimaResolucion(rama);
  const ganancia = rama.montoActual - rama.montoInicial;
  const cuotaNum = Number.parseFloat(cuota.replace(",", "."));
  const cuotaEnRango = esCuotaValida(cuotaNum);
  const apuestaValida = partido.trim() !== "" && cuotaEnRango;

  // Pago y ganancia esperados de la apuesta ya colocada (la que está en juego).
  const pagoEsperado = pendiente
    ? pagoTeoricoApuesta(pendiente.stake, pendiente.cuota)
    : 0;
  const gananciaEsperada = pendiente ? pagoEsperado - pendiente.stake : 0;

  const limpiarFormulario = () => {
    setPartido("");
    setCuota("");
  };

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

  const handleAvanzar = () => {
    if (apuestaValida) {
      onAvanzar(rama.id, { cuota: cuotaNum, partido: partido.trim() });
      limpiarFormulario();
    }
  };

  const abrirModalGanada = () => {
    if (pendiente) setModalPagoAbierto(true);
  };

  const confirmarGanada = (pagoReal: number) => {
    onAvanzar(rama.id, { pagoReal });
    setModalPagoAbierto(false);
    limpiarFormulario();
  };

  const handleReinyectar = () => {
    if (origenSeleccionado) {
      onReinyectar(origenSeleccionado, rama.id);
      setOrigenSeleccionado("");
    }
  };

  const iniciarEdicionCapital = () => {
    setCapitalEditado(rama.montoActual.toFixed(2));
    setEditandoCapital(true);
  };

  const handleCapitalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    if (valor === "" || /^\d*(?:[.,]\d{0,5})?$/.test(valor)) {
      setCapitalEditado(valor);
    }
  };

  const guardarCapital = () => {
    const n = Number.parseFloat(capitalEditado.replace(",", "."));
    if (!Number.isNaN(n) && n >= 0) {
      onAjustarCapital(rama.id, n);
    }
    setEditandoCapital(false);
  };

  const cancelarEdicionCapital = () => {
    setEditandoCapital(false);
  };

  const iniciarEdicionNombre = () => {
    setNombreEditado(rama.nombre);
    setEditandoNombre(true);
  };

  const guardarNombre = () => {
    if (onRenombrar && nombreEditado.trim() !== "") {
      onRenombrar(rama.id, nombreEditado);
    }
    setEditandoNombre(false);
  };

  const cancelarEdicionNombre = () => {
    setEditandoNombre(false);
  };

  const confirmarEliminar = () => {
    onEliminar?.(rama.id);
    setConfirmandoEliminar(false);
  };

  const handleDeshacer = () => {
    if (!onDeshacer || !puedeDeshacer) return;
    const ultima = rama.historial[rama.historial.length - 1];
    if (!ultima) return;
    const etiqueta = ultima.resultado === "ganado" ? "ganada" : "rota";
    if (
      window.confirm(
        `¿Deshacer la apuesta marcada como ${etiqueta}? Volverá a estar en juego con ${formatearEuros(ultima.stake)}.`,
      )
    ) {
      onDeshacer(rama.id);
      setMostrarHistorial(true);
    }
  };

  const esRota = rama.estado === "rotura";
  const esCompletada = rama.estado === "completada";
  const esActiva = rama.estado === "activa";
  const esHuchaRama = rama.esHucha === true;

  return (
    <article
      className={`glass-card flex flex-col gap-3 p-4 transition-all duration-200 animate-fade-in ${
        esHuchaRama
          ? "bg-gradient-to-br from-sky-400/[0.10] to-sky-500/[0.03] ring-1 ring-sky-300/40"
          : ESTILO_ACENTO[rama.estado]
      }`}
    >
      {/* Cabecera (clic en el título para contraer / expandir) */}
      <div className="flex items-start justify-between gap-3">
        {editandoNombre ? (
          <div className="flex flex-1 items-center gap-1">
            <input
              type="text"
              value={nombreEditado}
              onChange={(e) => setNombreEditado(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") guardarNombre();
                if (e.key === "Escape") cancelarEdicionNombre();
              }}
              autoFocus
              maxLength={60}
              className="input-glass w-full px-2 py-1 text-sm font-semibold"
            />
            <button
              type="button"
              onClick={guardarNombre}
              aria-label="Guardar nombre"
              className="btn-glass-icon border-emerald-300/30 bg-emerald-400/20 px-2 py-1 text-xs font-bold text-emerald-50 hover:bg-emerald-400/30"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={cancelarEdicionNombre}
              aria-label="Cancelar"
              className="btn-glass-icon px-2 py-1 text-xs text-slate-300"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setColapsada((v) => !v)}
            aria-expanded={!colapsada}
            className="flex flex-1 flex-col items-start gap-0.5 text-left"
          >
            <h3 className="flex items-center gap-2 text-base font-semibold text-slate-100">
              {rama.nombre}
              {esHuchaRama ? (
                <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-sky-300 ring-1 ring-inset ring-sky-400/30">
                  Independiente
                </span>
              ) : null}
            </h3>
            <p className="text-xs text-slate-500">
              Peldaño actual ·{" "}
              <span className="font-medium text-slate-300">
                {rama.pasoActual}
              </span>
            </p>
          </button>
        )}

        {!editandoNombre ? (
          <div className="flex shrink-0 items-center gap-1.5">
            {colapsada ? (
              <span
                className="text-base font-bold text-slate-50"
                title={pendiente ? "Pago esperado" : "Capital"}
              >
                {formatearEuros(pendiente ? pagoEsperado : rama.montoActual)}
              </span>
            ) : (
              <>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${ESTILO_BADGE[rama.estado]}`}
                >
                  {ETIQUETA_ESTADO[rama.estado]}
                </span>

                {confirmandoEliminar ? (
                  <>
                    <button
                      type="button"
                      onClick={confirmarEliminar}
                      title="Confirmar eliminación (su capital vuelve a la hucha)"
                      aria-label="Confirmar eliminación"
                      className="btn-glass-icon border-rose-300/40 bg-rose-400/20 px-2 py-1 text-xs font-bold text-rose-100 hover:bg-rose-400/30"
                    >
                      Eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoEliminar(false)}
                      aria-label="Cancelar"
                      className="btn-glass-icon px-2 py-1 text-xs text-slate-300"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <>
                    {onRenombrar ? (
                      <button
                        type="button"
                        onClick={iniciarEdicionNombre}
                        title="Renombrar escalera"
                        aria-label="Renombrar"
                        className="btn-glass-icon px-2 py-1 text-xs text-slate-400 hover:text-emerald-300"
                      >
                        ✎
                      </button>
                    ) : null}
                    {onEliminar ? (
                      <button
                        type="button"
                        onClick={() => setConfirmandoEliminar(true)}
                        title="Eliminar escalera"
                        aria-label="Eliminar"
                        className="btn-glass-icon px-2 py-1 text-xs text-slate-400 hover:text-rose-300"
                      >
                        🗑
                      </button>
                    ) : null}
                  </>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => setColapsada((v) => !v)}
              aria-label={colapsada ? "Expandir" : "Contraer"}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              {colapsada ? "▼" : "▲"}
            </button>
          </div>
        ) : null}
      </div>

      {/* Cifras */}
      {!colapsada ? (
      <>
      <div className="grid grid-cols-2 gap-2">
        <div className="glass-inset p-2.5">
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Capital
            </p>
            {!esRota && !editandoCapital ? (
              <button
                type="button"
                onClick={iniciarEdicionCapital}
                title="Ajustar al importe exacto de la casa"
                aria-label="Ajustar capital"
                className="text-xs text-slate-500 transition hover:text-emerald-300"
              >
                ✎
              </button>
            ) : null}
          </div>

          {editandoCapital ? (
            <div className="mt-1 flex items-center gap-1">
              <input
                type="text"
                inputMode="decimal"
                value={capitalEditado}
                onChange={handleCapitalChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") guardarCapital();
                  if (e.key === "Escape") cancelarEdicionCapital();
                }}
                autoFocus
                className="input-glass w-full px-2 py-1 text-sm font-semibold"
              />
              <button
                type="button"
                onClick={guardarCapital}
                aria-label="Guardar capital"
                className="btn-glass-icon border-emerald-300/30 bg-emerald-400/20 px-2 py-1 text-xs font-bold text-emerald-50 hover:bg-emerald-400/30"
              >
                ✓
              </button>
              <button
                type="button"
                onClick={cancelarEdicionCapital}
                aria-label="Cancelar"
                className="btn-glass-icon px-2 py-1 text-xs text-slate-300"
              >
                ✕
              </button>
            </div>
          ) : (
            <p
              className={`mt-0.5 text-lg font-bold ${
                esRota ? "text-rose-400" : "text-slate-50"
              }`}
            >
              {formatearEuros(rama.montoActual)}
            </p>
          )}
        </div>
        <div className="glass-inset p-2.5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Ganancia
          </p>
          <p
            className={`mt-0.5 text-lg font-bold ${
              ganancia >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {ganancia >= 0 ? "+" : ""}
            {formatearEuros(ganancia)}
          </p>
        </div>
      </div>

      {/* Apuesta pendiente + acciones compactas */}
      {pendiente ? (
        <div className="rounded-md border border-amber-300/25 bg-amber-400/[0.07] p-3 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-300/80">
                Apuesta en juego
              </p>
              <p className="mt-1 truncate text-sm font-medium text-slate-100">
                {pendiente.partido}
              </p>
              <p className="text-xs text-slate-400">
                Cuota {formatearCuota(pendiente.cuota)} ·{" "}
                {formatearEuros(pendiente.stake)} en riesgo
              </p>
            </div>

            {esActiva ? (
              <div className="flex shrink-0 items-center gap-2">
                <BotonAccionRedondo
                  titulo="Marcar ganada"
                  onClick={abrirModalGanada}
                  variante="emerald"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-5 w-5"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                      clipRule="evenodd"
                    />
                  </svg>
                </BotonAccionRedondo>
                <BotonAccionRedondo
                  titulo="Romper escalera"
                  onClick={() => onRomper(rama.id)}
                  variante="rose"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-5 w-5"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                      clipRule="evenodd"
                    />
                  </svg>
                </BotonAccionRedondo>
              </div>
            ) : null}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-amber-300/20 pt-2">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-slate-500">
                Pago esperado
              </p>
              <p className="text-sm font-semibold text-slate-100">
                {formatearEuros(pagoEsperado)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-slate-500">
                Ganancia esperada
              </p>
              <p className="text-sm font-semibold text-emerald-400">
                +{formatearEuros(gananciaEsperada)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Ganada reciente sin nueva apuesta colocada */}
      {puedeDeshacer && !pendiente && esActiva ? (
        <button
          type="button"
          onClick={handleDeshacer}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-500/25 bg-slate-500/[0.06] px-3 py-2 text-xs font-medium text-slate-400 transition hover:border-slate-400/40 hover:text-slate-200"
        >
          ↩ Deshacer última resolución
        </button>
      ) : null}

      {/* Colocar nueva apuesta (sólo si no hay apuesta en curso) */}
      {esActiva && !pendiente ? (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={partido}
            onChange={(e) => setPartido(e.target.value.toUpperCase())}
            placeholder="Partido / evento"
            className="input-glass w-full px-3 py-2 text-sm"
          />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <input
                type="text"
                inputMode="decimal"
                value={cuota}
                onChange={handleCuotaChange}
                onBlur={handleCuotaBlur}
                placeholder={`${CUOTA_MIN.toFixed(2)}–${CUOTA_MAX.toFixed(2)}`}
                className="input-glass w-full px-3 py-2 text-sm"
              />
              {cuota.trim() !== "" && !cuotaEnRango ? (
                <p className="mt-1 text-[10px] text-rose-400">
                  Cuota entre {CUOTA_MIN.toFixed(2)} y {CUOTA_MAX.toFixed(2)}
                </p>
              ) : null}
            </div>
            <BotonAccionRedondo
              titulo="Colocar apuesta"
              onClick={handleAvanzar}
              disabled={!apuestaValida}
              variante="emerald"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
                aria-hidden
              >
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
                <path
                  fillRule="evenodd"
                  d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h6a1 1 0 100-2H9z"
                  clipRule="evenodd"
                />
              </svg>
            </BotonAccionRedondo>
          </div>
        </div>
      ) : null}

      {/* Estado: completada */}
      {esCompletada ? (
        <div className="rounded-md border border-emerald-300/20 bg-emerald-400/[0.06] p-3 text-sm text-emerald-200 backdrop-blur-md">
          <p>Escalera completada. Objetivo de la rama alcanzado.</p>
          {puedeDeshacer ? (
            <button
              type="button"
              onClick={handleDeshacer}
              className="btn-glass btn-glass-ghost mt-3 text-xs font-semibold"
            >
              ↩ Deshacer última ganada
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Estado: rotura -> reinyección de capital */}
      {esRota ? (
        <div className="rounded-md border border-rose-400/25 bg-rose-500/[0.06] p-3 backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-medium text-rose-300">Rama rota</p>
            {puedeDeshacer ? (
              <button
                type="button"
                onClick={handleDeshacer}
                className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-slate-400/50 hover:bg-slate-500/20 hover:text-slate-100"
              >
                ↩ Deshacer rotura
              </button>
            ) : null}
          </div>
          {reinyectables.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2">
              <p className="text-xs text-slate-400">
                Renacer reinyectando ganancias de otra escalera:
              </p>
              <div className="flex gap-2">
                <select
                  value={origenSeleccionado}
                  onChange={(e) => setOrigenSeleccionado(e.target.value)}
                  className="input-glass flex-1 px-3 py-2 text-sm"
                >
                  <option value="">Elige rama de origen…</option>
                  {reinyectables.map((origen) => (
                    <option key={origen.id} value={origen.id}>
                      {origen.nombre} (+
                      {formatearEuros(origen.montoActual - origen.montoInicial)})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleReinyectar}
                  disabled={!origenSeleccionado}
                  className="btn-glass btn-glass-emerald px-3 font-semibold"
                >
                  Renacer
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-500">
              Aún no hay ramas con ganancias suficientes (peldaño &gt; 3) para
              reinyectar capital.
            </p>
          )}
        </div>
      ) : null}

      {/* Historial colapsable */}
      {rama.historial.length > 0 ? (
        <div className="border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => setMostrarHistorial((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-medium text-slate-400 transition hover:text-slate-200"
          >
            <span>Historial ({rama.historial.length})</span>
            <span aria-hidden>{mostrarHistorial ? "▲" : "▼"}</span>
          </button>
          {mostrarHistorial ? (
            <div className="mt-3">
              <HistorialTransacciones
                historial={rama.historial}
                puedeDeshacerUltima={puedeDeshacer}
                onDeshacerUltima={handleDeshacer}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {pendiente ? (
        <ModalConfirmarPago
          abierto={modalPagoAbierto}
          stake={pendiente.stake}
          cuota={pendiente.cuota}
          partido={pendiente.partido}
          onCerrar={() => setModalPagoAbierto(false)}
          onConfirmar={confirmarGanada}
        />
      ) : null}

      {fase === "fase1" ? (
        <p className="text-center text-xs text-slate-500">
          Tronco · ramificación automática al llegar a {UMBRAL_RAMIFICACION} €
        </p>
      ) : null}
      </>
      ) : null}
    </article>
  );
}
