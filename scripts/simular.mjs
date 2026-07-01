// Simulación de la estrategia "Árbol de Escaleras".
// Reglas fieles al motor: al ganar, el capital se trunca a euros enteros
// (Math.floor) y los céntimos van a la hucha (aquí se ignoran para el saldo
// de la escalera, ya que no se reapuestan).

const SEMILLA = 7; // capital inicial en euros
const META_TOTAL = 3000; // objetivo global
const NUM_ESCALERAS = 4;
const META_POR_ESCALERA = META_TOTAL / NUM_ESCALERAS; // 750 € por escalera

/** Nº de victorias para que `inicio` alcance `objetivo` reapostando todo a `cuota`. */
function victoriasHasta(inicio, objetivo, cuota) {
  let monto = inicio;
  let pasos = 0;
  const secuencia = [monto];
  while (monto < objetivo) {
    const siguiente = Math.floor(monto * cuota);
    if (siguiente <= monto) return { pasos: Infinity, secuencia }; // no progresa
    monto = siguiente;
    pasos += 1;
    secuencia.push(monto);
  }
  return { pasos, secuencia, final: monto };
}

/**
 * Flujo realista: el tronco crece desde la semilla hasta poder repartir una
 * base >= semilla a cada una de las 4 escaleras; luego cada escalera crece
 * hasta su meta (750 €).
 */
function simularArbol(cuota) {
  // Fase 1: tronco 7 € -> hasta >= 4 * semilla (para que cada rama parta de >= 7).
  const fase1 = victoriasHasta(SEMILLA, SEMILLA * NUM_ESCALERAS, cuota);
  if (!Number.isFinite(fase1.pasos)) return null;

  const baseTronco = fase1.final;
  const basePorRama = Math.floor(baseTronco / NUM_ESCALERAS);

  // Fase árbol: cada escalera basePorRama -> 750 €.
  const porRama = victoriasHasta(basePorRama, META_POR_ESCALERA, cuota);
  if (!Number.isFinite(porRama.pasos)) return null;

  const totalApuestas = fase1.pasos + NUM_ESCALERAS * porRama.pasos;
  const totalFinal = NUM_ESCALERAS * porRama.final;

  // Referencia: una sola escalera 7 € -> 3000 € (sin clonar).
  const directo = victoriasHasta(SEMILLA, META_TOTAL, cuota);

  return {
    cuota,
    troncoPasos: fase1.pasos,
    baseTronco,
    basePorRama,
    pasosPorEscalera: porRama.pasos,
    totalApuestas,
    totalFinal,
    secuenciaRama: porRama.secuencia,
    directoPasos: directo.pasos,
  };
}

const cuotas = [1.2, 1.3, 1.5, 1.75, 2.0, 2.16, 2.5, 3.0];

console.log(
  `Semilla ${SEMILLA} € · Meta ${META_TOTAL} € (${META_POR_ESCALERA} € x ${NUM_ESCALERAS} escaleras)\n`,
);

const cab =
  "Cuota | Tronco(pasos) | Base/escalera | Pasos POR escalera | Apuestas totales | Final aprox | 7->3000 directo";
console.log(cab);
console.log("-".repeat(cab.length));

for (const c of cuotas) {
  const r = simularArbol(c);
  if (!r) {
    console.log(`${c.toFixed(2)}  | (no progresa con truncado)`);
    continue;
  }
  console.log(
    `${r.cuota.toFixed(2)}  |      ${String(r.troncoPasos).padStart(2)}       |      ${String(
      r.basePorRama,
    ).padStart(3)} €     |        ${String(r.pasosPorEscalera).padStart(2)}          |        ${String(
      r.totalApuestas,
    ).padStart(3)}        |   ${String(r.totalFinal).padStart(5)} €  |       ${r.directoPasos}`,
  );
}

// Detalle de la progresión por escalera para cuota 2.00 (ejemplo).
const ej = simularArbol(2.0);
if (ej) {
  console.log(
    `\nEjemplo progresión de UNA escalera @ cuota 2.00 (de ${ej.basePorRama} € a 750 €):`,
  );
  console.log(ej.secuenciaRama.map((m) => `${m}€`).join(" -> "));
}
