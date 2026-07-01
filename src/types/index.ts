/**
 * Tipos del dominio "Árbol de Escaleras".
 *
 * El modelo representa una estrategia de bankroll donde el capital "escala"
 * reinvirtiendo por completo las ganancias de cada apuesta ganada. El tronco
 * inicial (Fase 1) se clona en 4 ramas independientes que escalan en paralelo.
 */

/** Naturaleza de la apuesta registrada en una transacción. */
export type TipoApuesta = "tiros_libres" | "otros";

/** Estado de resolución de una apuesta concreta. */
export type ResultadoApuesta = "pendiente" | "ganado" | "perdido";

/** Estado del ciclo de vida de una rama de la escalera. */
export type EstadoRama = "activa" | "completada" | "rotura";

/** Fase global de la operativa. */
export type FaseArbol = "inicial" | "fase1" | "arbol";

/**
 * Una apuesta individual (un "peldaño") dentro del historial de una rama.
 * `stake` es el importe arriesgado en el momento de colocarla.
 */
export interface Transaccion {
  id: string;
  partido: string;
  cuota: number;
  tipo: TipoApuesta;
  resultado: ResultadoApuesta;
  stake: number;
  fecha: string;
  /** Pago bruto confirmado en la casa (apuestas ganadas con importe real). */
  pagoBruto?: number;
  /** Cuota declarada al colocar (conservada al ajustar la cuota efectiva). */
  cuotaDeclarada?: number;
}

/**
 * Una rama de la escalera. `montoActual` representa el capital realizado
 * (la base que se arriesga en el siguiente peldaño). `pasoActual` cuenta
 * los peldaños ganados de forma consecutiva.
 */
export interface RamaEscalera {
  id: string;
  nombre: string;
  montoInicial: number;
  montoActual: number;
  pasoActual: number;
  estado: EstadoRama;
  historial: Transaccion[];
  /**
   * Marca la escalera independiente financiada con la hucha. No forma parte del
   * árbol de 4 escaleras principales ni de su lógica de reparto/reinyección.
   */
  esHucha?: boolean;
}

/** Visión agregada del bankroll global de la operativa. */
export interface BankrollGlobal {
  balanceActual: number;
  metaMensual: number;
  gananciasAcumuladas: number;
}

/** Contadores acumulados del mes en curso. */
export interface StatsMesActual {
  apuestasRealizadas: number;
  escalerasRotas: number;
}

/** Resumen archivado al cerrar un mes. */
export interface ResumenMensual {
  /** Clave `YYYY-MM`. */
  mes: string;
  apuestasRealizadas: number;
  escalerasRotas: number;
  balanceApertura: number;
  balanceCierre: number;
  gananciasMes: number;
  huchaCierre: number;
  /** Si el mes siguiente arrancó con 80 € (cierre > 1000 €). */
  activoInicioPremium: boolean;
}

/** Estado raíz persistido en la base de datos. */
export interface EstadoArbol {
  fase: FaseArbol;
  /** Capital realmente inyectado por el usuario (base para calcular ganancias). */
  capitalInicial: number;
  /**
   * Hucha de céntimos: como solo se apuestan importes enteros, al ganar se
   * trunca la rama al euro y la fracción (,01–,99) se acumula aquí. Sirve de
   * respaldo y puede usarse para crear nuevas ramas.
   */
  hucha: number;
  bankroll: BankrollGlobal;
  ramas: RamaEscalera[];
  /**
   * Capital inyectado aún sin asignar a tronco o escaleras. Forma parte del
   * balance global hasta que se reparta.
   */
  reservaInyectada?: number;
  /** Mes operativo actual (`YYYY-MM`). */
  mesActivo?: string;
  /** Balance al abrir el mes (para calcular ganancia mensual). */
  balanceAperturaMes?: number;
  /** Contadores del mes en curso. */
  statsMes?: StatsMesActual;
  /** Meses cerrados archivados. */
  historialMensual?: ResumenMensual[];
  /**
   * Copia del estado inmediatamente anterior a una operación destructiva
   * (rebalanceo, completar escaleras). Permite deshacer desde la UI.
   */
  respaldoDeshacer?: RespaldoArbol;
}

/** Instantánea parcial del árbol antes de un rebalanceo u operación similar. */
export interface RespaldoArbol {
  motivo: "rebalanceo" | "completar_escaleras";
  fecha: string;
  fase: FaseArbol;
  capitalInicial: number;
  hucha: number;
  reservaInyectada?: number;
  bankroll: BankrollGlobal;
  ramas: RamaEscalera[];
  mesActivo?: string;
  balanceAperturaMes?: number;
  statsMes?: StatsMesActual;
}

/** Datos necesarios para colocar una apuesta (un peldaño nuevo). */
export interface DatosApuesta {
  partido: string;
  cuota: number;
  tipo: TipoApuesta;
}

/** Opciones al avanzar un peldaño o colocar/resolver una apuesta. */
export interface OpcionesAvanzar {
  cuota?: number;
  partido?: string;
  tipo?: TipoApuesta;
  /** Pago bruto confirmado en la casa al marcar ganada. */
  pagoReal?: number;
}
