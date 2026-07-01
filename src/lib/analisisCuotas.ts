import type {
  EventoAnalizado,
  EventoCrudo,
  ResultadoAnalizado,
} from "@/types/cuotas";

/** Umbral mínimo de ventaja para considerar una cuota "de valor" (+EV). */
export const UMBRAL_VALOR = 0.02;

/** Tolerancia para considerar que una cuota "encaja" con el objetivo. */
const MARGEN_OBJETIVO_INFERIOR = 0.98; // admite cuotas un poco por debajo
const MARGEN_OBJETIVO_SUPERIOR = 1.25; // ...y hasta un 25% por encima

function redondear(valor: number, decimales = 4): number {
  const factor = 10 ** decimales;
  return Math.round((valor + Number.EPSILON) * factor) / factor;
}

/** Probabilidad implícita de una cuota decimal. */
export function probabilidadImplicita(cuota: number): number {
  return cuota > 0 ? 1 / cuota : 0;
}

/**
 * Analiza un evento crudo: calcula, por resultado, la mejor cuota disponible,
 * la probabilidad justa de consenso (sin margen) y el valor esperado (+EV).
 */
export function analizarEvento(crudo: EventoCrudo): EventoAnalizado {
  // Agrupa precios por resultado (Local / Empate / Visitante).
  const porResultado = new Map<string, number[]>();
  const mejorPorResultado = new Map<string, { precio: number; casa: string }>();

  for (const c of crudo.cuotas) {
    const lista = porResultado.get(c.resultado) ?? [];
    lista.push(c.precio);
    porResultado.set(c.resultado, lista);

    const mejor = mejorPorResultado.get(c.resultado);
    if (!mejor || c.precio > mejor.precio) {
      mejorPorResultado.set(c.resultado, { precio: c.precio, casa: c.casa });
    }
  }

  // Probabilidad implícita media (consenso) por resultado.
  const implicitaMedia = new Map<string, number>();
  for (const [resultado, precios] of porResultado) {
    const media =
      precios.reduce((s, p) => s + probabilidadImplicita(p), 0) / precios.length;
    implicitaMedia.set(resultado, media);
  }

  // Suma para normalizar y eliminar el margen agregado (no-vig).
  const sumaImplicita = [...implicitaMedia.values()].reduce((s, v) => s + v, 0);

  // Margen medio por casa (overround): sólo casas con todos los resultados.
  const margenMedio = calcularMargenMedio(crudo);

  const resultados: ResultadoAnalizado[] = [...mejorPorResultado.entries()].map(
    ([nombre, mejor]) => {
      const probJusta =
        sumaImplicita > 0
          ? (implicitaMedia.get(nombre) ?? 0) / sumaImplicita
          : 0;
      const cuotaJusta = probJusta > 0 ? 1 / probJusta : 0;
      const valor = mejor.precio * probJusta - 1;

      return {
        nombre,
        mejorCuota: redondear(mejor.precio, 2),
        mejorCasa: mejor.casa,
        probImplicita: redondear(probabilidadImplicita(mejor.precio)),
        probJusta: redondear(probJusta),
        cuotaJusta: redondear(cuotaJusta, 2),
        valor: redondear(valor),
        esValor: valor >= UMBRAL_VALOR,
        encajaObjetivo: false,
      };
    },
  );

  // Orden estable: Local, Empate, Visitante (si aplica), si no, alfabético.
  resultados.sort(
    (a, b) =>
      ordenResultado(a.nombre, crudo) - ordenResultado(b.nombre, crudo) ||
      a.nombre.localeCompare(b.nombre),
  );

  return {
    id: crudo.id,
    liga: crudo.liga,
    comienza: crudo.comienza,
    local: crudo.local,
    visitante: crudo.visitante,
    numCasas: contarCasas(crudo),
    margenMedio: redondear(margenMedio),
    resultados,
    encajaObjetivo: false,
    hayValor: resultados.some((r) => r.esValor),
  };
}

function ordenResultado(nombre: string, crudo: EventoCrudo): number {
  if (nombre === crudo.local) return 0;
  if (/^(draw|empate|tie)$/i.test(nombre)) return 1;
  if (nombre === crudo.visitante) return 2;
  return 3;
}

function contarCasas(crudo: EventoCrudo): number {
  return new Set(crudo.cuotas.map((c) => c.casa)).size;
}

function calcularMargenMedio(crudo: EventoCrudo): number {
  const porCasa = new Map<string, number[]>();
  for (const c of crudo.cuotas) {
    const lista = porCasa.get(c.casa) ?? [];
    lista.push(c.precio);
    porCasa.set(c.casa, lista);
  }

  const margenes: number[] = [];
  const numResultados = new Set(crudo.cuotas.map((c) => c.resultado)).size;
  for (const precios of porCasa.values()) {
    // Sólo casas que cotizan todos los resultados del evento.
    if (precios.length === numResultados && numResultados > 0) {
      const overround = precios.reduce((s, p) => s + probabilidadImplicita(p), 0);
      margenes.push(overround - 1);
    }
  }

  if (margenes.length === 0) return 0;
  return margenes.reduce((s, m) => s + m, 0) / margenes.length;
}

/**
 * Marca, según el objetivo de cuota del peldaño, qué resultados "encajan"
 * (cuota suficiente para alcanzar el objetivo sin asumir un riesgo excesivo).
 */
export function marcarEncajeObjetivo(
  evento: EventoAnalizado,
  objetivo: number | null,
): EventoAnalizado {
  if (!objetivo || objetivo <= 1) return evento;

  const minimo = objetivo * MARGEN_OBJETIVO_INFERIOR;
  const maximo = objetivo * MARGEN_OBJETIVO_SUPERIOR;

  const resultados = evento.resultados.map((r) => ({
    ...r,
    encajaObjetivo: r.mejorCuota >= minimo && r.mejorCuota <= maximo,
  }));

  return {
    ...evento,
    resultados,
    encajaObjetivo: resultados.some((r) => r.encajaObjetivo),
  };
}

/**
 * Ordena los eventos: primero los que encajan con el objetivo, luego los que
 * tienen valor, y dentro de cada grupo por hora de comienzo.
 */
export function ordenarEventos(eventos: EventoAnalizado[]): EventoAnalizado[] {
  return [...eventos].sort((a, b) => {
    if (a.encajaObjetivo !== b.encajaObjetivo) return a.encajaObjetivo ? -1 : 1;
    if (a.hayValor !== b.hayValor) return a.hayValor ? -1 : 1;
    return new Date(a.comienza).getTime() - new Date(b.comienza).getTime();
  });
}
