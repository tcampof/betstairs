"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ajustarCapitalRama as ajustarCapitalEngine,
  aplicarCicloMensualSiCorresponde,
  cierreMesPendiente,
  apuestasPendientesCierreMes,
  avanzarPaso as avanzarPasoEngine,
  completarEscaleras as completarEscalerasEngine,
  crearEstadoInicial,
  crearRamaDesdeHucha as crearRamaDesdeHuchaEngine,
  declararRotura as declararRoturaEngine,
  deshacerUltimaResolucion as deshacerUltimaResolucionEngine,
  deshacerRebalanceo as deshacerRebalanceoEngine,
  detectarEstadoSospechosoRebalanceo,
  eliminarRama as eliminarRamaEngine,
  esEstadoArbolValido,
  huchaDisponible,
  importarEstadoCorregido,
  iniciarFase1 as iniciarFase1Engine,
  inyectarCapitalGlobal as inyectarCapitalGlobalEngine,
  arrancarCuatroEscalerasDesdeReserva as arrancarCuatroEscalerasEngine,
  asignarReservaARama as asignarReservaARamaEngine,
  asignarReservaATronco as asignarReservaATroncoEngine,
  repartirReservaEnPrincipales as repartirReservaEnPrincipalesEngine,
  reservaDisponible,
  desgloseDisponibleRetiro,
  retirarCapital as retirarCapitalEngine,
  reponerEscaleraRota as reponerEscaleraRotaEngine,
  continuarSinEscaleraRota as continuarSinEscaleraRotaEngine,
  eleccionRoturaPendiente,
  puedeCompletarEscaleras,
  ramasReinyectables,
  reinyectarCapital as reinyectarEngine,
  renombrarRama as renombrarRamaEngine,
  tieneEscaleraHucha,
} from "@/lib/escaleras";
import { claveMes, historialMensualDe, statsMesDe } from "@/lib/mes";
import type { DatosModoInicio } from "@/components/ModalElegirModoInicio";
import type { PendienteEleccionRotura } from "@/lib/escaleras";
import type { EstadoArbol, OpcionesAvanzar, TipoApuesta } from "@/types";

const API_URL = "/api/estado";
const DEBOUNCE_GUARDADO_MS = 400;

/**
 * Hook central de la operativa "Árbol de Escaleras".
 *
 * Persistencia en base de datos (SQLite vía `/api/estado`), no en localStorage.
 *
 * Estrategia anti-hydration-mismatch: tanto el servidor como el primer render
 * del cliente parten SIEMPRE del estado inicial determinista. La carga del
 * estado real ocurre en un `useEffect` (sólo cliente, tras el montaje), lo que
 * evita cualquier discrepancia de HTML durante la hidratación. El flag
 * `hydrated` permite a la UI mostrar un esqueleto hasta que el estado esté
 * disponible.
 */
export function useArbolEscaleras() {
  const [estado, setEstado] = useState<EstadoArbol>(crearEstadoInicial);
  const [hydrated, setHydrated] = useState(false);
  // Flag transitorio de UI: el Suelo de Emergencia bloqueó el último rebalanceo.
  const [alertaSuelo, setAlertaSuelo] = useState(false);
  const [pendienteModoInicio, setPendienteModoInicio] =
    useState<DatosModoInicio | null>(null);
  const [pendienteEleccionRotura, setPendienteEleccionRotura] =
    useState<PendienteEleccionRotura | null>(null);
  const temporizadorGuardado = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Carga inicial desde la base de datos (sólo en el cliente).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const respuesta = await fetch(API_URL, { cache: "no-store" });
        if (respuesta.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (respuesta.ok) {
          const datos: unknown = await respuesta.json();
          if (!cancelado && esEstadoArbolValido(datos)) {
            setEstado(aplicarCicloMensualSiCorresponde(datos));
          }
        }
      } catch (error) {
        console.error("No se pudo cargar el estado.", error);
      } finally {
        if (!cancelado) setHydrated(true);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setPendienteEleccionRotura((prev) => {
      if (prev) return prev;
      return eleccionRoturaPendiente(estado);
    });
  }, [hydrated, estado]);

  // Persistencia: guarda (con debounce) en cada cambio, pero sólo después de
  // hidratar, para no sobrescribir la BD con el estado inicial vacío.
  useEffect(() => {
    if (!hydrated) return;

    if (temporizadorGuardado.current) {
      clearTimeout(temporizadorGuardado.current);
    }
    temporizadorGuardado.current = setTimeout(() => {
      fetch(API_URL, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(estado),
      })
        .then((respuesta) => {
          if (respuesta.status === 401) {
            window.location.href = "/login";
          }
        })
        .catch((error) => console.error("No se pudo guardar el estado.", error));
    }, DEBOUNCE_GUARDADO_MS);

    return () => {
      if (temporizadorGuardado.current) {
        clearTimeout(temporizadorGuardado.current);
      }
    };
  }, [estado, hydrated]);

  /* ----------------------------- Acciones ----------------------------- */

  const iniciarFase1 = useCallback(
    (
      monto: number,
      cuota: number,
      partido: string,
      tipo: TipoApuesta = "tiros_libres",
      usarReserva = false,
    ) => {
      setEstado((prev) =>
        iniciarFase1Engine(prev, monto, { partido, cuota, tipo }, { usarReserva }),
      );
    },
    [],
  );

  const inyectarCapital = useCallback((monto: number) => {
    setEstado((prev) => {
      const resultado = inyectarCapitalGlobalEngine(prev, monto);
      if (resultado.elegirModoInicio) {
        setPendienteModoInicio({
          enteroInyectado: resultado.enteroInyectado,
          centimosHucha: resultado.centimosHucha,
        });
      }
      return resultado.estado;
    });
  }, []);

  const arrancarCuatroEscaleras = useCallback(() => {
    setEstado((prev) => arrancarCuatroEscalerasEngine(prev));
    setPendienteModoInicio(null);
  }, []);

  const descartarModoInicio = useCallback(() => {
    setPendienteModoInicio(null);
  }, []);

  const asignarReservaTronco = useCallback((monto?: number) => {
    setEstado((prev) => asignarReservaATroncoEngine(prev, monto));
  }, []);

  const asignarReservaRama = useCallback((ramaId: string, monto?: number) => {
    setEstado((prev) => asignarReservaARamaEngine(prev, ramaId, monto));
  }, []);

  const repartirReservaPrincipales = useCallback((monto?: number) => {
    setEstado((prev) => repartirReservaEnPrincipalesEngine(prev, monto));
  }, []);

  const avanzarPaso = useCallback(
    (ramaId: string, opciones?: OpcionesAvanzar) => {
      const datos =
        opciones?.cuota !== undefined && opciones?.partido !== undefined
          ? {
              partido: opciones.partido,
              cuota: opciones.cuota,
              tipo: opciones.tipo ?? ("tiros_libres" as TipoApuesta),
            }
          : undefined;
      setEstado((prev) => {
        const {
          estado: siguiente,
          alertaSuelo: alerta,
          eleccionRotura,
        } = avanzarPasoEngine(prev, ramaId, datos, opciones?.pagoReal);
        setAlertaSuelo(alerta);
        if (eleccionRotura) {
          setPendienteEleccionRotura(eleccionRotura);
        }
        return siguiente;
      });
    },
    [],
  );

  const declararRotura = useCallback((ramaId: string) => {
    setEstado((prev) => {
      const {
        estado: siguiente,
        alertaSuelo: alerta,
        eleccionRotura,
      } = declararRoturaEngine(prev, ramaId);
      setAlertaSuelo(alerta);
      if (eleccionRotura) {
        setPendienteEleccionRotura(eleccionRotura);
      }
      return siguiente;
    });
  }, []);

  const reponerEscaleraRota = useCallback((ramaId: string) => {
    setEstado((prev) => {
      const resultado = reponerEscaleraRotaEngine(prev, ramaId);
      setAlertaSuelo(resultado.alertaSuelo);
      setPendienteEleccionRotura(
        eleccionRoturaPendiente(resultado.estado) ?? null,
      );
      return resultado.estado;
    });
  }, []);

  const continuarSinEscaleraRota = useCallback((ramaId: string) => {
    setEstado((prev) => {
      const resultado = continuarSinEscaleraRotaEngine(prev, ramaId);
      setAlertaSuelo(resultado.alertaSuelo);
      setPendienteEleccionRotura(
        eleccionRoturaPendiente(resultado.estado) ?? null,
      );
      return resultado.estado;
    });
  }, []);

  const deshacerUltimaResolucion = useCallback((ramaId: string) => {
    setEstado((prev) => deshacerUltimaResolucionEngine(prev, ramaId));
    setAlertaSuelo(false);
  }, []);

  const deshacerRebalanceo = useCallback(() => {
    setEstado((prev) => deshacerRebalanceoEngine(prev));
    setAlertaSuelo(false);
  }, []);

  const importarEstado = useCallback((importado: unknown): boolean => {
    let ok = false;
    setEstado((prev) => {
      const corregido = importarEstadoCorregido(prev, importado);
      if (corregido) {
        ok = true;
        return aplicarCicloMensualSiCorresponde(corregido);
      }
      return prev;
    });
    if (ok) setAlertaSuelo(false);
    return ok;
  }, []);

  const descartarAlertaSuelo = useCallback(() => setAlertaSuelo(false), []);

  const reinyectarCapital = useCallback(
    (ramaOrigenId: string, ramaDestinoId: string) => {
      setEstado((prev) =>
        reinyectarEngine(prev, ramaOrigenId, ramaDestinoId),
      );
    },
    [],
  );

  const ajustarCapital = useCallback((ramaId: string, nuevoMonto: number) => {
    setEstado((prev) => ajustarCapitalEngine(prev, ramaId, nuevoMonto));
  }, []);

  const crearRamaDesdeHucha = useCallback(() => {
    setEstado((prev) => crearRamaDesdeHuchaEngine(prev));
  }, []);

  const completarEscaleras = useCallback(() => {
    setEstado((prev) => completarEscalerasEngine(prev));
    setAlertaSuelo(false);
  }, []);

  const renombrarRama = useCallback((ramaId: string, nombre: string) => {
    setEstado((prev) => renombrarRamaEngine(prev, ramaId, nombre));
  }, []);

  const eliminarRama = useCallback((ramaId: string) => {
    setEstado((prev) => eliminarRamaEngine(prev, ramaId));
  }, []);

  const retirarCapital = useCallback((monto: number) => {
    setEstado((prev) => retirarCapitalEngine(prev, monto));
  }, []);

  const reiniciar = useCallback(() => {
    setEstado((prev) => ({
      ...crearEstadoInicial(),
      historialMensual: historialMensualDe(prev.historialMensual),
    }));
    setAlertaSuelo(false);
  }, []);

  /* ---------------------------- Derivados ----------------------------- */

  const reinyectables = useMemo(() => ramasReinyectables(estado), [estado]);
  const huchaParaRama = useMemo(() => huchaDisponible(estado), [estado]);
  const faltaEscalera = useMemo(
    () => puedeCompletarEscaleras(estado),
    [estado],
  );
  const existeEscaleraHucha = useMemo(
    () => tieneEscaleraHucha(estado),
    [estado],
  );

  const mesActivo = estado.mesActivo ?? claveMes();
  const statsMes = useMemo(() => statsMesDe(estado.statsMes), [estado.statsMes]);
  const historialMensual = useMemo(
    () => historialMensualDe(estado.historialMensual),
    [estado.historialMensual],
  );
  const balanceAperturaMes = estado.balanceAperturaMes ?? 0;
  const reserva = useMemo(() => reservaDisponible(estado), [estado]);
  const desgloseRetiro = useMemo(
    () => desgloseDisponibleRetiro(estado),
    [estado],
  );
  const estadoSospechoso = useMemo(
    () => detectarEstadoSospechosoRebalanceo(estado),
    [estado],
  );
  const cierreMesBloqueado = useMemo(
    () => cierreMesPendiente(estado),
    [estado],
  );
  const apuestasBloqueandoCierre = useMemo(
    () => apuestasPendientesCierreMes(estado),
    [estado],
  );

  return {
    hydrated,
    estado,
    fase: estado.fase,
    bankroll: estado.bankroll,
    ramas: estado.ramas,
    hucha: estado.hucha ?? 0,
    reserva,
    desgloseRetiro,
    huchaParaRama,
    faltaEscalera,
    existeEscaleraHucha,
    alertaSuelo,
    descartarAlertaSuelo,
    mesActivo,
    statsMes,
    historialMensual,
    balanceAperturaMes,
    estadoSospechoso,
    cierreMesBloqueado,
    apuestasBloqueandoCierre,
    respaldoDeshacer: estado.respaldoDeshacer,
    reinyectables,
    iniciarFase1,
    inyectarCapital,
    arrancarCuatroEscaleras,
    pendienteModoInicio,
    pendienteEleccionRotura,
    descartarModoInicio,
    asignarReservaTronco,
    asignarReservaRama,
    repartirReservaPrincipales,
    retirarCapital,
    reponerEscaleraRota,
    continuarSinEscaleraRota,
    avanzarPaso,
    declararRotura,
    deshacerUltimaResolucion,
    deshacerRebalanceo,
    importarEstado,
    reinyectarCapital,
    ajustarCapital,
    crearRamaDesdeHucha,
    completarEscaleras,
    renombrarRama,
    eliminarRama,
    reiniciar,
  };
}

export type ArbolEscalerasApi = ReturnType<typeof useArbolEscaleras>;
