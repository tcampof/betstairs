import type {
  BankrollGlobal,
  DatosApuesta,
  EstadoArbol,
  RamaEscalera,
  RespaldoArbol,
  ResumenMensual,
  Transaccion,
} from "@/types";
import {
  claveMes,
  historialMensualDe,
  statsMesDe,
  STATS_MES_VACIO,
  UMBRAL_INICIO_MES_PREMIUM,
} from "@/lib/mes";

/** Meta de beneficio mensual objetivo, en euros. */
export const META_MENSUAL = 2000;

/** Número de ramas en las que se clona el tronco de la Fase 1. */
export const NUM_RAMAS = 4;

/** Cuota mínima y máxima permitida al colocar apuestas. */
export const CUOTA_MIN = 1.3;
export const CUOTA_MAX = 1.5;

/** ¿La cuota está dentro del rango operativo [1,30 – 1,50]? */
export function esCuotaValida(cuota: number): boolean {
  return (
    Number.isFinite(cuota) && cuota >= CUOTA_MIN && cuota <= CUOTA_MAX
  );
}

/**
 * Capital mínimo del tronco (Fase 1) para ramificar automáticamente en 4
 * escaleras. Al alcanzarlo, el árbol se crea sin intervención manual.
 */
export const UMBRAL_RAMIFICACION = 20;

/**
 * Peldaño mínimo que debe haber alcanzado una rama de origen para poder
 * reinyectar sus ganancias en una rama rota.
 */
export const PASO_MINIMO_REINYECCION = 3;

/**
 * Tramos del "Suelo de Emergencia Progresivo". Define, según el monto que cada
 * rama tendría tras un rebalanceo (`montoProyectado`), la barrera mínima de
 * capital por rama por debajo de la cual NO se rebalancea, para proteger el
 * interés compuesto de las ramas maduras. Los tramos se evalúan en orden.
 */
export const TRAMOS_SUELO_EMERGENCIA: ReadonlyArray<{
  /** Límite superior (exclusivo) del monto proyectado para este tramo. */
  hasta: number;
  /** Suelo mínimo de capital por rama aplicado en el tramo. */
  suelo: number;
}> = [
  { hasta: 15, suelo: 5 },
  { hasta: 30, suelo: 10 },
  { hasta: 60, suelo: 20 },
  { hasta: Number.POSITIVE_INFINITY, suelo: 40 },
];

/**
 * Devuelve el suelo mínimo dinámico según el monto proyectado por rama:
 *  - < 15 €            -> 5 €
 *  - [15, 30) €        -> 10 €
 *  - [30, 60) €        -> 20 €
 *  - >= 60 €           -> 40 €
 */
export function calcularSueloMinimo(montoProyectado: number): number {
  const tramo = TRAMOS_SUELO_EMERGENCIA.find((t) => montoProyectado < t.hasta);
  // El último tramo usa Infinity, por lo que `find` siempre encuentra uno.
  return tramo ? tramo.suelo : 0;
}

/* ------------------------------------------------------------------ */
/* Utilidades internas                                                 */
/* ------------------------------------------------------------------ */

/** Redondea a 2 decimales evitando los típicos errores de coma flotante. */
function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

/**
 * Separa un importe en su parte entera (euros "cerrados" que se quedan en la
 * rama) y la fracción de céntimos (,01–,99) que va a la hucha.
 */
function truncarEntero(valor: number): { entero: number; resto: number } {
  const seguro = redondear(valor);
  const entero = Math.floor(seguro);
  return { entero, resto: redondear(seguro - entero) };
}

/** Pago bruto teórico (stake × cuota) redondeado a céntimos. */
export function pagoTeoricoApuesta(stake: number, cuota: number): number {
  return redondear(stake * cuota);
}

/** Cuota efectiva a partir del pago bruto confirmado en la casa. */
export function cuotaEfectivaDesdePago(stake: number, pagoBruto: number): number {
  if (stake <= 0) return 0;
  return Math.round((pagoBruto / stake + Number.EPSILON) * 100000) / 100000;
}

/** Pago bruto usado al resolver o deshacer una apuesta ganada. */
export function pagoBrutoTransaccion(t: Transaccion): number {
  if (typeof t.pagoBruto === "number") return redondear(t.pagoBruto);
  return pagoTeoricoApuesta(t.stake, t.cuota);
}

/** Céntimos acumulados en la hucha (tolerante a estados antiguos sin el campo). */
function huchaDe(estado: EstadoArbol): number {
  return typeof estado.hucha === "number" ? estado.hucha : 0;
}

/** Capital inyectado pendiente de asignar a tronco o escaleras. */
function reservaDe(estado: EstadoArbol): number {
  return typeof estado.reservaInyectada === "number"
    ? redondear(estado.reservaInyectada)
    : 0;
}

/** ¿Es la escalera independiente financiada con la hucha? */
function esRamaHucha(rama: RamaEscalera): boolean {
  return rama.esHucha === true;
}

/** Escaleras principales del árbol (excluye la escalera de la hucha). */
function ramasPrincipales(estado: EstadoArbol): RamaEscalera[] {
  return estado.ramas.filter((r) => !esRamaHucha(r));
}

/** Identificador único. Sólo se invoca dentro de manejadores de eventos. */
function nuevoId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function ahora(): string {
  return new Date().toISOString();
}

/** Devuelve la última apuesta sin resolver de una rama, si existe. */
function apuestaPendiente(rama: RamaEscalera): Transaccion | undefined {
  const ultima = rama.historial[rama.historial.length - 1];
  return ultima && ultima.resultado === "pendiente" ? ultima : undefined;
}

/** Meta de beneficio que corresponde a cada rama individual. */
function metaPorRama(estado: EstadoArbol): number {
  const activas = ramasPrincipales(estado).filter(
    (r) => r.estado === "activa",
  ).length;
  const divisor = activas > 0 ? activas : NUM_RAMAS;
  return estado.bankroll.metaMensual / divisor;
}

/** Suma de stakes en apuestas pendientes (capital bloqueado en la casa). */
function totalStakesEnJuego(ramas: RamaEscalera[]): number {
  let total = 0;
  for (const rama of ramas) {
    const pendiente = apuestaPendiente(rama);
    if (pendiente) total = redondear(total + pendiente.stake);
  }
  return total;
}

/** Capital vivo en ramas que tienen apuesta pendiente. */
function capitalEnApuestasActivas(ramas: RamaEscalera[]): number {
  let total = 0;
  for (const rama of ramas) {
    if (apuestaPendiente(rama)) total = redondear(total + rama.montoActual);
  }
  return total;
}

/**
 * Recalcula el bankroll global. El balance mostrado excluye lo apostado en
 * curso (como el saldo disponible real en la casa de apuestas).
 */
function recalcularBankroll(estado: EstadoArbol): EstadoArbol {
  const hucha = redondear(huchaDe(estado));
  const reserva = reservaDe(estado);
  const bruto = redondear(
    estado.ramas.reduce((suma, rama) => suma + rama.montoActual, 0) +
      hucha +
      reserva,
  );
  const enJuego = totalStakesEnJuego(estado.ramas);
  const balanceActual = redondear(bruto - enJuego);
  const bankroll: BankrollGlobal = {
    ...estado.bankroll,
    balanceActual,
    gananciasAcumuladas: redondear(balanceActual - estado.capitalInicial),
  };
  return { ...estado, hucha, bankroll };
}

/* ------------------------------------------------------------------ */
/* Constructores                                                       */
/* ------------------------------------------------------------------ */

/**
 * Valida de forma defensiva un valor desconocido (p. ej. leído de la BD o del
 * cuerpo de una petición) como un `EstadoArbol`.
 */
export function esEstadoArbolValido(valor: unknown): valor is EstadoArbol {
  if (typeof valor !== "object" || valor === null) return false;
  const e = valor as Partial<EstadoArbol>;
  return (
    typeof e.fase === "string" &&
    typeof e.capitalInicial === "number" &&
    typeof e.bankroll === "object" &&
    e.bankroll !== null &&
    Array.isArray(e.ramas)
  );
}

/** Estado vacío y determinista (idéntico en servidor y cliente). */
export function crearEstadoInicial(): EstadoArbol {
  const mes = claveMes();
  return {
    fase: "inicial",
    capitalInicial: 0,
    hucha: 0,
    reservaInyectada: 0,
    mesActivo: mes,
    balanceAperturaMes: 0,
    statsMes: { ...STATS_MES_VACIO },
    historialMensual: [],
    bankroll: {
      balanceActual: 0,
      metaMensual: META_MENSUAL,
      gananciasAcumuladas: 0,
    },
    ramas: [],
  };
}

/** Asegura campos mensuales en estados antiguos o parciales. */
function normalizarCamposMes(estado: EstadoArbol): EstadoArbol {
  const mesActivo = estado.mesActivo ?? claveMes();
  return {
    ...estado,
    mesActivo,
    balanceAperturaMes: estado.balanceAperturaMes ?? estado.bankroll.balanceActual,
    statsMes: statsMesDe(estado.statsMes),
    historialMensual: historialMensualDe(estado.historialMensual),
  };
}

function incrementarApuesta(estado: EstadoArbol): EstadoArbol {
  const stats = statsMesDe(estado.statsMes);
  return {
    ...estado,
    statsMes: { ...stats, apuestasRealizadas: stats.apuestasRealizadas + 1 },
  };
}

function incrementarRotura(estado: EstadoArbol): EstadoArbol {
  const stats = statsMesDe(estado.statsMes);
  return {
    ...estado,
    statsMes: { ...stats, escalerasRotas: stats.escalerasRotas + 1 },
  };
}

/** ¿Alguna escalera (principal o hucha) tiene apuesta sin resolver? */
function hayApuestasPendientesEnArbol(estado: EstadoArbol): boolean {
  return estado.ramas.some((r) => apuestaPendiente(r) !== undefined);
}

/** El calendario avanzó pero el mes no se cierra hasta resolver todas las apuestas. */
export function cierreMesPendiente(estado: EstadoArbol): boolean {
  const base = normalizarCamposMes(estado);
  return base.mesActivo !== claveMes() && hayApuestasPendientesEnArbol(base);
}

/** Apuestas que bloquean el cierre del mes abierto. */
export function apuestasPendientesCierreMes(estado: EstadoArbol): number {
  return estado.ramas.filter((r) => apuestaPendiente(r) !== undefined).length;
}

/** Archiva el mes en curso y abre el nuevo conservando saldo, escaleras e historial. */
function archivarMesYAbrirNuevo(estado: EstadoArbol, mesNuevo: string): EstadoArbol {
  const base = normalizarCamposMes(estado);
  const balanceCierre = base.bankroll.balanceActual;
  const balanceApertura = base.balanceAperturaMes ?? base.capitalInicial;

  const resumen: ResumenMensual = {
    mes: base.mesActivo!,
    apuestasRealizadas: base.statsMes!.apuestasRealizadas,
    escalerasRotas: base.statsMes!.escalerasRotas,
    balanceApertura,
    balanceCierre,
    gananciasMes: redondear(balanceCierre - balanceApertura),
    huchaCierre: redondear(huchaDe(base)),
    activoInicioPremium: balanceCierre > UMBRAL_INICIO_MES_PREMIUM,
  };

  const historial = [...base.historialMensual!, resumen];

  return recalcularBankroll({
    ...base,
    mesActivo: mesNuevo,
    balanceAperturaMes: balanceCierre,
    capitalInicial: balanceCierre,
    statsMes: { ...STATS_MES_VACIO },
    historialMensual: historial,
    respaldoDeshacer: undefined,
  });
}

/**
 * Si el calendario cambió de mes, archiva el anterior cuando no queden apuestas
 * pendientes y abre el nuevo conservando el saldo de cierre.
 */
export function aplicarCicloMensualSiCorresponde(
  estado: EstadoArbol,
): EstadoArbol {
  const normalizado = normalizarCamposMes(estado);
  const mesActual = claveMes();
  if (normalizado.mesActivo === mesActual) {
    return normalizado;
  }
  if (hayApuestasPendientesEnArbol(normalizado)) {
    return normalizado;
  }
  return archivarMesYAbrirNuevo(normalizado, mesActual);
}

/** Cierra el pipeline de una mutación: normaliza mes y evalúa cambio de mes. */
function finalizarMutacion(estado: EstadoArbol): EstadoArbol {
  return aplicarCicloMensualSiCorresponde(estado);
}

function crearTransaccion(datos: DatosApuesta, stake: number): Transaccion {
  return {
    id: nuevoId(),
    partido: datos.partido.trim(),
    cuota: datos.cuota,
    tipo: datos.tipo,
    resultado: "pendiente",
    stake: redondear(stake),
    fecha: ahora(),
  };
}

/* ------------------------------------------------------------------ */
/* Acciones del dominio (funciones puras: estado -> estado)            */
/* ------------------------------------------------------------------ */

/**
 * Inicia la Fase 1 creando el tronco con su primera apuesta pendiente.
 * Reemplaza por completo cualquier estado anterior.
 */
export function iniciarFase1(
  _estado: EstadoArbol,
  monto: number,
  datos: DatosApuesta,
  opciones?: { usarReserva?: boolean },
): EstadoArbol {
  if (
    monto <= 0 ||
    !esCuotaValida(datos.cuota) ||
    datos.partido.trim() === ""
  ) {
    return _estado;
  }

  const importe = redondear(monto);
  const usarReserva = opciones?.usarReserva ?? false;
  if (usarReserva && importe > reservaDe(_estado)) {
    return _estado;
  }

  const tronco: RamaEscalera = {
    id: nuevoId(),
    nombre: "Fase 1 · Tronco",
    montoInicial: importe,
    montoActual: importe,
    pasoActual: 0,
    estado: "activa",
    historial: [crearTransaccion(datos, importe)],
  };

  const capitalInicial = usarReserva
    ? _estado.capitalInicial
    : redondear(_estado.capitalInicial + importe);
  const reservaInyectada = usarReserva
    ? redondear(reservaDe(_estado) - importe)
    : reservaDe(_estado);

  const nuevo: EstadoArbol = {
    fase: "fase1",
    capitalInicial,
    hucha: huchaDe(_estado),
    reservaInyectada,
    mesActivo: _estado.mesActivo ?? claveMes(),
    balanceAperturaMes: redondear(
      _estado.balanceAperturaMes ?? capitalInicial,
    ),
    statsMes: statsMesDe(_estado.statsMes),
    historialMensual: historialMensualDe(_estado.historialMensual),
    bankroll: {
      balanceActual: 0,
      metaMensual: META_MENSUAL,
      gananciasAcumuladas: 0,
    },
    ramas: [tronco],
  };

  return finalizarMutacion(
    incrementarApuesta(recalcularBankroll(nuevo)),
  );
}

/**
 * Clona el tronco de la Fase 1 en 4 ramas equitativas, repartiendo el capital
 * vivo actual a partes iguales (importes enteros). El sobrante en céntimos del
 * reparto va a la hucha. Cada rama nace sin apuesta pendiente.
 */
export function clonarA4Escaleras(estado: EstadoArbol): EstadoArbol {
  if (estado.fase !== "fase1" || estado.ramas.length === 0) {
    return estado;
  }

  const tronco = estado.ramas[0];
  if (!tronco) return estado;

  // Reparto en importes enteros; el resto (incluidos céntimos) va a la hucha.
  const porRama = Math.floor(tronco.montoActual / NUM_RAMAS);
  if (porRama <= 0) return estado;

  const sobrante = redondear(tronco.montoActual - porRama * NUM_RAMAS);

  const ramas: RamaEscalera[] = Array.from({ length: NUM_RAMAS }, (_, i) => ({
    id: nuevoId(),
    nombre: `Escalera ${i + 1}`,
    montoInicial: porRama,
    montoActual: porRama,
    pasoActual: 0,
    estado: "activa" as const,
    historial: [],
    esHucha: false,
  }));

  return recalcularBankroll({
    ...estado,
    fase: "arbol",
    ramas,
    hucha: redondear(huchaDe(estado) + sobrante),
  });
}

/**
 * Si el tronco de Fase 1 alcanza `UMBRAL_RAMIFICACION`, clona a 4 escaleras.
 * Se invoca tras operaciones que puedan elevar el capital del tronco.
 */
function intentarRamificacionAutomatica(estado: EstadoArbol): EstadoArbol {
  if (estado.fase !== "fase1" || estado.ramas.length === 0) {
    return estado;
  }
  const tronco = estado.ramas[0];
  if (!tronco || tronco.montoActual < UMBRAL_RAMIFICACION) {
    return estado;
  }
  return clonarA4Escaleras(estado);
}

/**
 * Avanza un peldaño en una rama:
 *  1. Si hay una apuesta pendiente, la resuelve como GANADA y reinvierte por
 *     completo las ganancias (montoActual = montoActual * cuota), subiendo el
 *     contador de pasos.
 *  2. En fase "arbol", si se alcanza la meta de la rama, se marca "completada".
 *  3. Si se aportan datos de una nueva apuesta, la coloca como pendiente.
 *  4. En Fase 1, si el tronco alcanza `UMBRAL_RAMIFICACION`, ramifica solo.
 */
export function avanzarPaso(
  estado: EstadoArbol,
  ramaId: string,
  datos?: DatosApuesta,
  pagoReal?: number,
): ResultadoRotura {
  let aHucha = 0;
  let apuestaColocada = false;
  const colocarNueva =
    datos !== undefined &&
    datos.partido.trim() !== "" &&
    esCuotaValida(datos.cuota);

  const ramas = estado.ramas.map((rama) => {
    if (rama.id !== ramaId || rama.estado !== "activa") return rama;

    let historial = rama.historial;
    let montoActual = rama.montoActual;
    let pasoActual = rama.pasoActual;

    const pendiente = apuestaPendiente(rama);
    if (pendiente) {
      const stake = pendiente.stake;
      const cuotaDeclarada = pendiente.cuota;
      const bruto =
        pagoReal !== undefined &&
        Number.isFinite(pagoReal) &&
        pagoReal > stake
          ? redondear(pagoReal)
          : pagoTeoricoApuesta(stake, cuotaDeclarada);
      const teorico = pagoTeoricoApuesta(stake, cuotaDeclarada);
      const cuotaRegistrada =
        Math.abs(bruto - teorico) < 0.005
          ? cuotaDeclarada
          : cuotaEfectivaDesdePago(stake, bruto);
      const { entero, resto } = truncarEntero(bruto);

      historial = historial.map((t) =>
        t.id === pendiente.id
          ? {
              ...t,
              resultado: "ganado" as const,
              cuota: cuotaRegistrada,
              pagoBruto: bruto,
              cuotaDeclarada,
            }
          : t,
      );
      montoActual = entero;
      aHucha = redondear(aHucha + resto);
      pasoActual += 1;
    }

    if (estado.fase === "arbol" && montoActual >= metaPorRama(estado)) {
      return {
        ...rama,
        montoActual,
        pasoActual,
        estado: "completada" as const,
        historial,
      };
    }

    const colocarEnRama =
      colocarNueva && rama.id === ramaId && rama.estado === "activa";
    if (colocarEnRama) {
      historial = [...historial, crearTransaccion(datos!, montoActual)];
      apuestaColocada = true;
    }

    return { ...rama, montoActual, pasoActual, historial };
  });

  let siguiente = intentarRamificacionAutomatica(
    recalcularBankroll({
      ...estado,
      ramas,
      hucha: redondear(huchaDe(estado) + aHucha),
    }),
  );

  if (apuestaColocada) {
    siguiente = incrementarApuesta(siguiente);
  }

  const post = procesarPostResolucionPrincipales(siguiente);
  return {
    estado: finalizarMutacion(post.estado),
    alertaSuelo: post.alertaSuelo,
    eleccionRotura: post.eleccionRotura,
  };
}

/**
 * Marca una rama como rota: su apuesta pendiente (si la hay) pasa a PERDIDA y su
 * capital vivo cae a 0. No recalcula el bankroll (lo hace quien la invoca).
 */
function marcarRamaRota(estado: EstadoArbol, ramaId: string): EstadoArbol {
  const ramas = estado.ramas.map((rama) => {
    if (rama.id !== ramaId) return rama;

    const pendiente = apuestaPendiente(rama);
    const historial = pendiente
      ? rama.historial.map((t) =>
          t.id === pendiente.id ? { ...t, resultado: "perdido" as const } : t,
        )
      : rama.historial;

    return { ...rama, estado: "rotura" as const, montoActual: 0, historial };
  });

  return { ...estado, ramas };
}

/**
 * Reparte el capital vivo entre escaleras principales indicadas (parte entera
 * por escalera; céntimos del reparto a la hucha). Conserva historial y peldaño.
 */
function repartirCapitalEnPrincipales(
  estado: EstadoArbol,
  idsIncluidos: Set<string>,
  motivoRespaldo: RespaldoArbol["motivo"] = "rebalanceo",
): ResultadoRotura {
  const principales = ramasPrincipales(estado);
  const objetivos = principales.filter((r) => idsIncluidos.has(r.id));
  const total = objetivos.reduce((suma, r) => suma + r.montoActual, 0);
  const count = objetivos.length;

  if (count < 1) return { estado, alertaSuelo: false };

  const porRama = Math.floor(total / count);
  if (porRama < 1) {
    return { estado: recalcularBankroll(estado), alertaSuelo: true };
  }

  const sueloMinimo = calcularSueloMinimo(porRama);
  if (porRama < sueloMinimo) {
    return { estado: recalcularBankroll(estado), alertaSuelo: true };
  }

  const sobrante = redondear(total - porRama * count);
  const respaldo = crearRespaldoDeshacer(estado, motivoRespaldo);

  const ramas = estado.ramas.map((rama) => {
    if (!idsIncluidos.has(rama.id) || esRamaHucha(rama)) return rama;
    return {
      ...rama,
      montoActual: porRama,
      montoInicial: porRama,
      estado: "activa" as const,
    };
  });

  return {
    estado: recalcularBankroll({
      ...estado,
      respaldoDeshacer: respaldo,
      ramas,
      hucha: redondear(huchaDe(estado) + sobrante),
    }),
    alertaSuelo: false,
  };
}

function ultimaApuestaGanada(rama: RamaEscalera): boolean {
  const ultima = rama.historial[rama.historial.length - 1];
  return ultima?.resultado === "ganado";
}

function montosPrincipalesDesiguales(ramas: RamaEscalera[]): boolean {
  if (ramas.length < 2) return false;
  const primero = ramas[0]?.montoActual;
  return ramas.some((r) => r.montoActual !== primero);
}

/** Tras ganar todas las apuestas activas, iguala capital entre escaleras. */
function intentarRepartoTrasTodasGanadas(
  estado: EstadoArbol,
): ResultadoRotura {
  const principales = ramasPrincipales(estado);
  const activas = principales.filter((r) => r.estado === "activa");

  if (activas.length < 2) return { estado, alertaSuelo: false };
  if (!activas.every(ultimaApuestaGanada)) return { estado, alertaSuelo: false };
  if (!montosPrincipalesDesiguales(activas)) return { estado, alertaSuelo: false };

  const ids = new Set(activas.map((r) => r.id));
  return repartirCapitalEnPrincipales(estado, ids, "rebalanceo");
}

/** Datos para que el usuario elija reponer o continuar sin la escalera rota. */
export interface PendienteEleccionRotura {
  ramaId: string;
  nombreRama: string;
  capitalRemanente: number;
  escalerasSiReponer: number;
  escalerasSiContinuar: number;
  porRamaSiReponer: number;
  porRamaSiContinuar: number;
  sobranteSiReponer: number;
  sobranteSiContinuar: number;
}

function construirEleccionRotura(
  estado: EstadoArbol,
  rota: RamaEscalera,
): PendienteEleccionRotura {
  const activas = ramasPrincipales(estado).filter((r) => r.estado === "activa");
  const remanente = activas.reduce((suma, r) => suma + r.montoActual, 0);
  const escalerasSiReponer = activas.length + 1;
  const escalerasSiContinuar = activas.length;
  const porRamaSiReponer =
    escalerasSiReponer > 0 ? Math.floor(remanente / escalerasSiReponer) : 0;
  const porRamaSiContinuar =
    escalerasSiContinuar > 0 ? Math.floor(remanente / escalerasSiContinuar) : 0;

  return {
    ramaId: rota.id,
    nombreRama: rota.nombre,
    capitalRemanente: remanente,
    escalerasSiReponer,
    escalerasSiContinuar,
    porRamaSiReponer,
    porRamaSiContinuar,
    sobranteSiReponer: redondear(
      remanente - porRamaSiReponer * escalerasSiReponer,
    ),
    sobranteSiContinuar: redondear(
      remanente - porRamaSiContinuar * escalerasSiContinuar,
    ),
  };
}

function procesarPostResolucionPrincipales(
  estado: EstadoArbol,
): ResultadoRotura {
  if (estado.fase !== "arbol" || hayApuestasPendientesPrincipales(estado)) {
    return { estado, alertaSuelo: false };
  }

  const rotas = ramasPrincipales(estado).filter((r) => r.estado === "rotura");
  if (rotas.length > 0) {
    return {
      estado,
      alertaSuelo: false,
      eleccionRotura: construirEleccionRotura(estado, rotas[0]!),
    };
  }

  return intentarRepartoTrasTodasGanadas(estado);
}

/**
 * Repone una escalera rota: revive la misma rama y reparte entre todas las
 * principales activas (incluida la reponida).
 */
export function reponerEscaleraRota(
  estado: EstadoArbol,
  ramaId: string,
): ResultadoRotura {
  const rota = ramasPrincipales(estado).find(
    (r) => r.id === ramaId && r.estado === "rotura",
  );
  if (!rota) return { estado, alertaSuelo: false };

  const activas = ramasPrincipales(estado).filter((r) => r.estado === "activa");
  const ids = new Set([...activas.map((r) => r.id), ramaId]);

  const ramas = estado.ramas.map((rama) =>
    rama.id === ramaId ? { ...rama, estado: "activa" as const } : rama,
  );

  return repartirCapitalEnPrincipales(
    { ...estado, ramas },
    ids,
    "rebalanceo",
  );
}

/**
 * Continúa sin la escalera rota: la elimina y reparte entre las restantes.
 */
export function continuarSinEscaleraRota(
  estado: EstadoArbol,
  ramaId: string,
): ResultadoRotura {
  const principales = ramasPrincipales(estado);
  if (!principales.some((r) => r.id === ramaId)) {
    return { estado, alertaSuelo: false };
  }

  const activas = principales.filter(
    (r) => r.estado === "activa" && r.id !== ramaId,
  );
  if (activas.length < 1) return { estado, alertaSuelo: false };

  const ids = new Set(activas.map((r) => r.id));
  const sinRota: EstadoArbol = {
    ...estado,
    ramas: estado.ramas.filter((r) => r.id !== ramaId),
  };

  return repartirCapitalEnPrincipales(sinRota, ids, "rebalanceo");
}

/** Si hay roturas y no quedan apuestas pendientes, devuelve datos para el modal. */
export function eleccionRoturaPendiente(
  estado: EstadoArbol,
): PendienteEleccionRotura | null {
  if (estado.fase !== "arbol" || hayApuestasPendientesPrincipales(estado)) {
    return null;
  }
  const rotas = ramasPrincipales(estado).filter((r) => r.estado === "rotura");
  if (rotas.length === 0) return null;
  return construirEleccionRotura(estado, rotas[0]!);
}

function clonarProfundo<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T;
}

function crearRespaldoDeshacer(
  estado: EstadoArbol,
  motivo: RespaldoArbol["motivo"],
): RespaldoArbol {
  return {
    motivo,
    fecha: ahora(),
    fase: estado.fase,
    capitalInicial: estado.capitalInicial,
    hucha: huchaDe(estado),
    reservaInyectada: reservaDe(estado),
    bankroll: { ...estado.bankroll },
    ramas: clonarProfundo(estado.ramas),
    mesActivo: estado.mesActivo,
    balanceAperturaMes: estado.balanceAperturaMes,
    statsMes: statsMesDe(estado.statsMes),
  };
}

/** ¿Alguna escalera principal tiene apuesta sin resolver? */
function hayApuestasPendientesPrincipales(estado: EstadoArbol): boolean {
  return ramasPrincipales(estado).some(
    (r) => apuestaPendiente(r) !== undefined,
  );
}

/** Resultado de mutaciones que pueden activar el suelo de emergencia. */
export interface ResultadoRotura {
  estado: EstadoArbol;
  /** `true` si el Suelo de Emergencia bloqueó el reparto (Comportamiento B). */
  alertaSuelo: boolean;
  /** Elección pendiente tras rotura (reponer vs continuar). */
  eleccionRotura?: PendienteEleccionRotura;
}

/**
 * Declara la rotura de una rama. El reparto automático ya no crea escaleras
 * nuevas: cuando todas las apuestas están resueltas, se pide al usuario si
 * reponer la rota o continuar con las restantes.
 */
export function declararRotura(
  estado: EstadoArbol,
  ramaId: string,
): ResultadoRotura {
  const objetivo = estado.ramas.find((r) => r.id === ramaId);
  if (!objetivo) {
    return { estado, alertaSuelo: false };
  }

  const estadoRoto = marcarRamaRota(estado, ramaId);

  if (esRamaHucha(objetivo)) {
    return {
      estado: finalizarMutacion(
        incrementarRotura(recalcularBankroll(estadoRoto)),
      ),
      alertaSuelo: false,
    };
  }

  const base = incrementarRotura(recalcularBankroll(estadoRoto));

  if (hayApuestasPendientesPrincipales(base)) {
    return { estado: finalizarMutacion(base), alertaSuelo: false };
  }

  const post = procesarPostResolucionPrincipales(base);
  return {
    estado: finalizarMutacion(post.estado),
    alertaSuelo: post.alertaSuelo,
    eleccionRotura: post.eleccionRotura,
  };
}

/**
 * Reinyecta el capital de una rama próspera (paso > PASO_MINIMO_REINYECCION) en
 * una rama rota para hacerla "renacer". Sólo se traspasan las ganancias de la
 * rama de origen (montoActual - montoInicial), que vuelve así a su base.
 */
export function reinyectarCapital(
  estado: EstadoArbol,
  ramaOrigenId: string,
  ramaDestinoId: string,
): EstadoArbol {
  if (ramaOrigenId === ramaDestinoId) return estado;

  const origen = estado.ramas.find((r) => r.id === ramaOrigenId);
  const destino = estado.ramas.find((r) => r.id === ramaDestinoId);
  if (!origen || !destino) return estado;
  if (origen.pasoActual <= PASO_MINIMO_REINYECCION) return estado;
  if (destino.estado !== "rotura") return estado;

  // Se traspasa la ganancia en importe entero; los céntimos sobrantes a la hucha.
  const { entero: ganancias, resto } = truncarEntero(
    origen.montoActual - origen.montoInicial,
  );
  if (ganancias <= 0) return estado;

  const ramas = estado.ramas.map((rama) => {
    if (rama.id === ramaOrigenId) {
      return { ...rama, montoActual: rama.montoInicial };
    }
    if (rama.id === ramaDestinoId) {
      return {
        ...rama,
        estado: "activa" as const,
        montoInicial: ganancias,
        montoActual: ganancias,
        pasoActual: 0,
        historial: [],
      };
    }
    return rama;
  });

  return finalizarMutacion(
    recalcularBankroll({
      ...estado,
      ramas,
      hucha: redondear(huchaDe(estado) + resto),
    }),
  );
}

/**
 * Ajusta manualmente el capital vivo de una rama para cuadrarlo exactamente con
 * el importe que muestra la casa de apuestas (corrige desviaciones de redondeo).
 * Si la rama tiene una apuesta pendiente, su `stake` en juego se actualiza al
 * nuevo capital, de modo que el siguiente peldaño parta del valor correcto.
 */
export function ajustarCapitalRama(
  estado: EstadoArbol,
  ramaId: string,
  nuevoMonto: number,
): EstadoArbol {
  if (!Number.isFinite(nuevoMonto) || nuevoMonto < 0) return estado;

  const monto = redondear(nuevoMonto);
  const ramas = estado.ramas.map((rama) => {
    if (rama.id !== ramaId) return rama;

    const pendiente = apuestaPendiente(rama);
    const historial = pendiente
      ? rama.historial.map((t) =>
          t.id === pendiente.id ? { ...t, stake: monto } : t,
        )
      : rama.historial;

    return { ...rama, montoActual: monto, historial };
  });

  return finalizarMutacion(
    intentarRamificacionAutomatica(
      recalcularBankroll({ ...estado, ramas }),
    ),
  );
}

/**
 * Inyecta capital nuevo al bankroll global sin asignarlo aún a ninguna escalera.
 * La parte entera va a `reservaInyectada`; los céntimos (,01–,99) a la hucha.
 */
export interface ResultadoInyeccion {
  estado: EstadoArbol;
  enteroInyectado: number;
  centimosHucha: number;
  /** Si no hay escaleras y la parte entera supera el umbral de ramificación. */
  elegirModoInicio: boolean;
}

/** ¿Aún no hay tronco ni escaleras creadas? */
export function sinEscalerasCreadas(estado: EstadoArbol): boolean {
  return estado.ramas.length === 0;
}

export function inyectarCapitalGlobal(
  estado: EstadoArbol,
  monto: number,
): ResultadoInyeccion {
  const vacio: ResultadoInyeccion = {
    estado,
    enteroInyectado: 0,
    centimosHucha: 0,
    elegirModoInicio: false,
  };

  if (!Number.isFinite(monto) || monto <= 0) return vacio;

  const bruto = redondear(monto);
  const { entero, resto: centimosHucha } = truncarEntero(bruto);
  if (entero < 1 && centimosHucha <= 0) return vacio;

  const siguiente = finalizarMutacion(
    recalcularBankroll({
      ...estado,
      capitalInicial: redondear(estado.capitalInicial + bruto),
      hucha: redondear(huchaDe(estado) + centimosHucha),
      reservaInyectada: redondear(reservaDe(estado) + entero),
    }),
  );

  const elegirModoInicio =
    sinEscalerasCreadas(estado) && entero > UMBRAL_RAMIFICACION;

  return {
    estado: siguiente,
    enteroInyectado: entero,
    centimosHucha,
    elegirModoInicio,
  };
}

/**
 * Arranca directamente en fase árbol con 4 escaleras iguales usando la reserva.
 * Solo aplica cuando aún no hay ramas creadas.
 */
export function arrancarCuatroEscalerasDesdeReserva(
  estado: EstadoArbol,
  monto?: number,
): EstadoArbol {
  if (!sinEscalerasCreadas(estado)) return estado;

  const reserva = reservaDe(estado);
  const total = Math.floor(monto ?? reserva);
  if (total <= 0 || total > reserva) return estado;

  const porRama = Math.floor(total / NUM_RAMAS);
  if (porRama < 1) return estado;

  const asignado = porRama * NUM_RAMAS;
  const sobranteReparto = total - asignado;

  const ramas: RamaEscalera[] = Array.from({ length: NUM_RAMAS }, (_, i) => ({
    id: nuevoId(),
    nombre: `Escalera ${i + 1}`,
    montoInicial: porRama,
    montoActual: porRama,
    pasoActual: 0,
    estado: "activa" as const,
    historial: [],
    esHucha: false,
  }));

  const base = recalcularBankroll({
    ...estado,
    fase: "arbol",
    ramas,
    reservaInyectada: redondear(reserva - total),
    hucha: redondear(huchaDe(estado) + sobranteReparto),
    statsMes: statsMesDe(estado.statsMes),
    historialMensual: historialMensualDe(estado.historialMensual),
    mesActivo: estado.mesActivo ?? claveMes(),
  });

  return finalizarMutacion({
    ...base,
    balanceAperturaMes: base.bankroll.balanceActual,
  });
}

function aplicarReservaARama(
  rama: RamaEscalera,
  importe: number,
): RamaEscalera {
  if (rama.estado === "rotura") {
    return {
      ...rama,
      estado: "activa" as const,
      montoInicial: importe,
      montoActual: importe,
      pasoActual: 0,
      historial: [],
    };
  }

  const monto = redondear(rama.montoActual + importe);
  const pendiente = apuestaPendiente(rama);
  const historial = pendiente
    ? rama.historial.map((t) =>
        t.id === pendiente.id ? { ...t, stake: monto } : t,
      )
    : rama.historial;

  return { ...rama, montoActual: monto, historial };
}

/**
 * Mueve capital de la reserva a una escalera concreta. Si la rama estaba rota,
 * renace con ese importe como nueva base.
 */
export function asignarReservaARama(
  estado: EstadoArbol,
  ramaId: string,
  monto?: number,
): EstadoArbol {
  const reserva = reservaDe(estado);
  const importe = redondear(monto ?? reserva);
  if (importe <= 0 || importe > reserva) return estado;
  if (!estado.ramas.some((r) => r.id === ramaId)) return estado;

  const ramas = estado.ramas.map((r) =>
    r.id === ramaId ? aplicarReservaARama(r, importe) : r,
  );

  return finalizarMutacion(
    intentarRamificacionAutomatica(
      recalcularBankroll({
        ...estado,
        ramas,
        reservaInyectada: redondear(reserva - importe),
      }),
    ),
  );
}

/** Añade reserva al tronco de Fase 1 (si existe). */
export function asignarReservaATronco(
  estado: EstadoArbol,
  monto?: number,
): EstadoArbol {
  if (estado.fase !== "fase1" || estado.ramas.length === 0) return estado;
  const tronco = estado.ramas[0];
  if (!tronco) return estado;
  return asignarReservaARama(estado, tronco.id, monto);
}

/**
 * Reparte la reserva (o parte) a partes iguales entre las escaleras principales.
 * Solo importes enteros por rama; el sobrante permanece en reserva.
 */
export function repartirReservaEnPrincipales(
  estado: EstadoArbol,
  monto?: number,
): EstadoArbol {
  if (estado.fase !== "arbol") return estado;
  const reserva = reservaDe(estado);
  const total = redondear(monto ?? reserva);
  if (total <= 0 || total > reserva) return estado;

  const principales = ramasPrincipales(estado);
  if (principales.length === 0) return estado;

  const porRama = Math.floor(total / principales.length);
  if (porRama < 1) return estado;

  const asignado = porRama * principales.length;
  const ids = new Set(principales.map((p) => p.id));

  const ramas = estado.ramas.map((r) =>
    ids.has(r.id) ? aplicarReservaARama(r, porRama) : r,
  );

  return finalizarMutacion(
    recalcularBankroll({
      ...estado,
      ramas,
      reservaInyectada: redondear(reserva - asignado),
    }),
  );
}

/** Importe disponible en la reserva global sin asignar. */
export function reservaDisponible(estado: EstadoArbol): number {
  return reservaDe(estado);
}

/** Desglose del capital que se puede retirar a la casa de apuestas. */
export interface DesgloseDisponibleRetiro {
  /** Saldo disponible (excluye lo apostado en curso). */
  saldoTotal: number;
  /** Saldo retirable a la casa de apuestas. */
  saldoRetirable: number;
  hucha: number;
  reserva: number;
  /** Capital en escaleras sin apuesta activa. */
  enEscaleras: number;
  /** Capital bloqueado en apuestas en juego. */
  bloqueadoEnJuego: number;
}

/** Stake de la apuesta pendiente en una rama (0 si no hay). */
function stakeEnJuegoRama(rama: RamaEscalera): number {
  const pendiente = apuestaPendiente(rama);
  return pendiente ? redondear(pendiente.stake) : 0;
}

/** Capital de una rama que se puede retirar sin tocar lo apostado. */
function capitalRetirableRama(rama: RamaEscalera): number {
  if (rama.montoActual <= 0) return 0;
  const stake = stakeEnJuegoRama(rama);
  return redondear(Math.max(0, rama.montoActual - stake));
}

export function desgloseDisponibleRetiro(
  estado: EstadoArbol,
): DesgloseDisponibleRetiro {
  const hucha = huchaDe(estado);
  const reserva = reservaDe(estado);
  const saldoTotal = estado.bankroll.balanceActual;
  let enEscaleras = 0;
  let bloqueadoEnJuego = 0;

  for (const rama of estado.ramas) {
    const stake = stakeEnJuegoRama(rama);
    if (stake > 0) {
      bloqueadoEnJuego = redondear(bloqueadoEnJuego + stake);
    }
    enEscaleras = redondear(enEscaleras + capitalRetirableRama(rama));
  }

  const saldoRetirable = redondear(hucha + reserva + enEscaleras);

  return {
    saldoTotal,
    saldoRetirable,
    hucha,
    reserva,
    enEscaleras,
    bloqueadoEnJuego,
  };
}

function descontarCapitalRama(
  rama: RamaEscalera,
  importe: number,
): RamaEscalera {
  const minimo = stakeEnJuegoRama(rama);
  const montoActual = redondear(
    Math.max(minimo, rama.montoActual - importe),
  );
  return {
    ...rama,
    montoActual,
    montoInicial: Math.min(rama.montoInicial, montoActual),
  };
}

/**
 * Retira efectivo del saldo (hucha → reserva → escaleras).
 * No reduce el stake de apuestas en curso; solo el excedente de cada rama.
 */
export function retirarCapital(
  estado: EstadoArbol,
  monto: number,
): EstadoArbol {
  if (!Number.isFinite(monto) || monto <= 0) return estado;

  const bruto = redondear(monto);
  const disponible = desgloseDisponibleRetiro(estado);
  if (bruto > disponible.saldoRetirable) return estado;

  let restante = bruto;
  let hucha = huchaDe(estado);
  let reserva = reservaDe(estado);

  const deHucha = Math.min(restante, hucha);
  hucha = redondear(hucha - deHucha);
  restante = redondear(restante - deHucha);

  const deReserva = Math.min(restante, reserva);
  reserva = redondear(reserva - deReserva);
  restante = redondear(restante - deReserva);

  let ramas = estado.ramas.map((rama) => {
    if (restante <= 0) return rama;
    const retirable = capitalRetirableRama(rama);
    if (retirable <= 0) return rama;
    const toma = Math.min(restante, retirable);
    restante = redondear(restante - toma);
    return descontarCapitalRama(rama, toma);
  });

  const balancePrevio = estado.bankroll.balanceActual;
  const excesoGanancia = Math.max(
    0,
    redondear(balancePrevio - estado.capitalInicial),
  );
  const retiroDeGanancia = Math.min(bruto, excesoGanancia);
  const retiroDeCapital = redondear(bruto - retiroDeGanancia);
  const capitalInicial = redondear(
    Math.max(0, estado.capitalInicial - retiroDeCapital),
  );

  if (
    ramas.every((r) => r.montoActual <= 0) &&
    reserva <= 0 &&
    hucha <= 0
  ) {
    ramas = [];
  }

  const base = recalcularBankroll({
    ...estado,
    hucha,
    reservaInyectada: reserva,
    ramas,
    capitalInicial,
    fase:
      ramas.length === 0 && reserva <= 0 && hucha <= 0
        ? "inicial"
        : estado.fase,
  });

  return finalizarMutacion(intentarRamificacionAutomatica(base));
}

/** Renombra una rama. No afecta a ningún cálculo monetario. */
export function renombrarRama(
  estado: EstadoArbol,
  ramaId: string,
  nombre: string,
): EstadoArbol {
  const limpio = nombre.trim();
  if (limpio === "") return estado;

  const ramas = estado.ramas.map((rama) =>
    rama.id === ramaId ? { ...rama, nombre: limpio.slice(0, 60) } : rama,
  );
  return { ...estado, ramas };
}

/**
 * Elimina una rama. Su capital vivo no se pierde: se devuelve a la hucha
 * (respaldo). Si no quedan ramas, se vuelve a la fase inicial conservando la
 * hucha y el capital inyectado.
 */
export function eliminarRama(estado: EstadoArbol, ramaId: string): EstadoArbol {
  const rama = estado.ramas.find((r) => r.id === ramaId);
  if (!rama) return estado;

  const ramas = estado.ramas.filter((r) => r.id !== ramaId);
  const hucha = redondear(huchaDe(estado) + rama.montoActual);

  if (ramas.length === 0) {
    return finalizarMutacion(
      recalcularBankroll({ ...estado, fase: "inicial", ramas, hucha }),
    );
  }

  return finalizarMutacion(recalcularBankroll({ ...estado, ramas, hucha }));
}

/**
 * Vuelca el importe entero de la hucha en la escalera independiente de la hucha.
 * Si aún no existe, la crea; si ya existe, le añade el capital (aumentando su
 * base para que su "ganancia" refleje sólo su propia operativa). Los céntimos
 * restantes permanecen en la hucha. No inyecta capital nuevo.
 */
export function crearRamaDesdeHucha(estado: EstadoArbol): EstadoArbol {
  const disponible = Math.floor(huchaDe(estado));
  if (disponible < 1) return estado;

  const existente = estado.ramas.find(esRamaHucha);

  let ramas: RamaEscalera[];
  if (existente) {
    ramas = estado.ramas.map((rama) =>
      esRamaHucha(rama)
        ? {
            ...rama,
            estado: rama.estado === "rotura" ? "activa" : rama.estado,
            montoInicial: redondear(rama.montoInicial + disponible),
            montoActual: redondear(rama.montoActual + disponible),
          }
        : rama,
    );
  } else {
    const nueva: RamaEscalera = {
      id: nuevoId(),
      nombre: "Escalera Hucha",
      montoInicial: disponible,
      montoActual: disponible,
      pasoActual: 0,
      estado: "activa",
      historial: [],
      esHucha: true,
    };
    ramas = [...estado.ramas, nueva];
  }

  return finalizarMutacion(
    recalcularBankroll({
      ...estado,
      ramas,
      hucha: redondear(huchaDe(estado) - disponible),
    }),
  );
}

/**
 * Rehace el árbol de 4 escaleras principales repartiendo a partes iguales el
 * capital vivo de las principales existentes (importes enteros; el sobrante va
 * a la hucha). La escalera independiente de la hucha no se toca. Las 4 quedan
 * con el mismo capital y reinician su progreso (peldaño 0, sin apuestas).
 */
export function completarEscaleras(estado: EstadoArbol): EstadoArbol {
  if (estado.fase !== "arbol") return estado;
  const activas = ramasPrincipales(estado).filter((r) => r.estado === "activa");
  if (activas.length < 2) return estado;
  const ids = new Set(activas.map((r) => r.id));
  return finalizarMutacion(
    repartirCapitalEnPrincipales(estado, ids, "completar_escaleras").estado,
  );
}

/* ------------------------------------------------------------------ */
/* Selectores derivados                                                */
/* ------------------------------------------------------------------ */

/** Importe entero de la hucha disponible para crear una nueva rama. */
export function huchaDisponible(estado: EstadoArbol): number {
  return Math.floor(huchaDe(estado));
}

/** Número de escaleras principales sanas (activas o completadas, no rotas). */
export function escalerasPrincipalesSanas(estado: EstadoArbol): number {
  return ramasPrincipales(estado).filter((r) => r.estado !== "rotura").length;
}

/**
 * ¿Falta alguna de las 4 principales (rota o eliminada) y hay capital entero
 * suficiente para rehacerlas a 4 iguales? Sólo aplica en fase árbol.
 */
export function puedeCompletarEscaleras(estado: EstadoArbol): boolean {
  if (estado.fase !== "arbol") return false;
  if (escalerasPrincipalesSanas(estado) >= NUM_RAMAS) return false;
  const total = ramasPrincipales(estado).reduce(
    (suma, r) => suma + r.montoActual,
    0,
  );
  return Math.floor(total / NUM_RAMAS) >= 1;
}

/** ¿Existe ya la escalera independiente de la hucha? */
export function tieneEscaleraHucha(estado: EstadoArbol): boolean {
  return estado.ramas.some(esRamaHucha);
}

/** Porcentaje de avance hacia la meta mensual (0-100, acotado). */
export function porcentajeMeta(bankroll: BankrollGlobal): number {
  if (bankroll.metaMensual <= 0) return 0;
  const pct = (bankroll.gananciasAcumuladas / bankroll.metaMensual) * 100;
  return Math.max(0, Math.min(100, redondear(pct)));
}

/**
 * Ramas que pueden actuar como origen de una reinyección de capital. Excluye la
 * escalera de la hucha, que es independiente del árbol.
 */
export function ramasReinyectables(estado: EstadoArbol): RamaEscalera[] {
  return estado.ramas.filter(
    (r) =>
      !esRamaHucha(r) &&
      r.pasoActual > PASO_MINIMO_REINYECCION &&
      r.montoActual - r.montoInicial > 0,
  );
}

/** Resumen agregado de apuestas pendientes en todas las ramas. */
export interface ResumenApuestasActivas {
  cantidad: number;
  /** Capital en riesgo (stakes de apuestas activas). */
  enJuego: number;
  /** Balance si todas las activas perdieran. */
  saldoTrasPerderActivas: number;
  /** Suma de ganancias esperadas (pago − stake) si ganan todas. */
  gananciaEsperada: number;
}

/** Agrega apuestas en juego para la cabecera del bankroll. */
export function resumenApuestasActivas(
  balanceActual: number,
  ramas: RamaEscalera[],
): ResumenApuestasActivas {
  let cantidad = 0;
  let enJuego = 0;
  let gananciaEsperada = 0;

  for (const rama of ramas) {
    const pendiente = apuestaPendiente(rama);
    if (!pendiente) continue;
    cantidad += 1;
    const stake = pendiente.stake;
    const pago = pagoTeoricoApuesta(stake, pendiente.cuota);
    enJuego = redondear(enJuego + stake);
    gananciaEsperada = redondear(gananciaEsperada + (pago - stake));
  }

  return {
    cantidad,
    enJuego,
    saldoTrasPerderActivas: redondear(
      balanceActual + enJuego - capitalEnApuestasActivas(ramas),
    ),
    gananciaEsperada,
  };
}

/** Apuesta pendiente de una rama (o `undefined`). Reexpuesto para la UI. */
export function obtenerApuestaPendiente(
  rama: RamaEscalera,
): Transaccion | undefined {
  return apuestaPendiente(rama);
}

/**
 * ¿Se puede deshacer la última resolución de esta rama?
 * Solo si la última transacción del historial está marcada como ganada o rota
 * (no hay una apuesta posterior en juego).
 */
export function puedeDeshacerUltimaResolucion(rama: RamaEscalera): boolean {
  if (rama.historial.length === 0) return false;
  const ultima = rama.historial[rama.historial.length - 1];
  if (!ultima) return false;
  return ultima.resultado === "ganado" || ultima.resultado === "perdido";
}

/**
 * Deshace la última apuesta marcada como ganada o rota. La devuelve a
 * "pendiente" y restaura capital, peldaño y contadores. No evalúa rebalanceo.
 */
export function deshacerUltimaResolucion(
  estado: EstadoArbol,
  ramaId: string,
): EstadoArbol {
  const objetivo = estado.ramas.find((r) => r.id === ramaId);
  if (!objetivo || !puedeDeshacerUltimaResolucion(objetivo)) {
    return estado;
  }

  const ultima = objetivo.historial[objetivo.historial.length - 1];
  if (!ultima) return estado;
  const indiceUltima = objetivo.historial.length - 1;
  let deltaHucha = 0;
  let deltaRoturas = 0;

  const ramas = estado.ramas.map((rama) => {
    if (rama.id !== ramaId) return rama;

    let montoActual = rama.montoActual;
    let pasoActual = rama.pasoActual;
    let estadoRama = rama.estado;

    if (ultima.resultado === "ganado") {
      const { resto } = truncarEntero(pagoBrutoTransaccion(ultima));
      montoActual = ultima.stake;
      pasoActual = Math.max(0, pasoActual - 1);
      deltaHucha = -resto;
      if (estadoRama === "completada") estadoRama = "activa";
    } else {
      montoActual = ultima.stake;
      if (estadoRama === "rotura") {
        estadoRama = "activa";
        deltaRoturas = -1;
      }
    }

    const historial = rama.historial.map((t, i) =>
      i === indiceUltima
        ? {
            ...t,
            resultado: "pendiente" as const,
            cuota: t.cuotaDeclarada ?? t.cuota,
            pagoBruto: undefined,
            cuotaDeclarada: undefined,
          }
        : t,
    );

    return { ...rama, montoActual, pasoActual, estado: estadoRama, historial };
  });

  const stats = statsMesDe(estado.statsMes);
  return finalizarMutacion(
    recalcularBankroll({
      ...estado,
      ramas,
      hucha: redondear(huchaDe(estado) + deltaHucha),
      statsMes: {
        ...stats,
        escalerasRotas: Math.max(0, stats.escalerasRotas + deltaRoturas),
      },
    }),
  );
}

/** ¿Hay un respaldo guardado antes del último rebalanceo? */
export function tieneRespaldoDeshacer(estado: EstadoArbol): boolean {
  return estado.respaldoDeshacer != null;
}

/**
 * Detecta un estado probablemente dañado por un rebalanceo prematuro: las 4
 * principales en peldaño 0, sin historial, con actividad registrada en el mes.
 */
export function detectarEstadoSospechosoRebalanceo(
  estado: EstadoArbol,
): boolean {
  if (estado.fase !== "arbol") return false;
  const principales = ramasPrincipales(estado);
  if (principales.length !== NUM_RAMAS) return false;

  const sinHistorial = principales.every((r) => r.historial.length === 0);
  const pasoCero = principales.every((r) => r.pasoActual === 0);
  const montosIguales =
    new Set(principales.map((r) => r.montoActual)).size === 1;
  const stats = statsMesDe(estado.statsMes);
  const actividadMes =
    stats.apuestasRealizadas > 0 || stats.escalerasRotas > 0;

  return sinHistorial && pasoCero && montosIguales && actividadMes;
}

/** Restaura el árbol al instante anterior al último rebalanceo guardado. */
export function deshacerRebalanceo(estado: EstadoArbol): EstadoArbol {
  const respaldo = estado.respaldoDeshacer;
  if (!respaldo) return estado;

  return finalizarMutacion(
    recalcularBankroll({
      ...estado,
      fase: respaldo.fase,
      capitalInicial: respaldo.capitalInicial,
      hucha: respaldo.hucha,
      reservaInyectada: respaldo.reservaInyectada ?? 0,
      bankroll: { ...respaldo.bankroll },
      ramas: clonarProfundo(respaldo.ramas),
      mesActivo: respaldo.mesActivo,
      balanceAperturaMes: respaldo.balanceAperturaMes,
      statsMes: respaldo.statsMes,
      respaldoDeshacer: undefined,
    }),
  );
}

/** Reemplaza el estado completo (p. ej. JSON corregido importado desde archivo). */
export function importarEstadoCorregido(
  _estado: EstadoArbol,
  importado: unknown,
): EstadoArbol | null {
  if (!esEstadoArbolValido(importado)) return null;
  return finalizarMutacion(importado);
}
