#!/usr/bin/env node
/**
 * Herramienta de reparación del estado en producción (SQLite / JSON).
 *
 * Uso típico:
 *   1. Exportar estado actual desde el servidor
 *      curl https://tu-dominio/api/estado -o estado-actual.json
 *
 *   2. Inspeccionar
 *      node scripts/reparar.mjs inspect --input estado-actual.json
 *
 *   3a. Si aún hay historial (no hubo rebalanceo destructivo), deshacer resoluciones:
 *      node scripts/reparar.mjs deshacer --input estado-actual.json --rama todas
 *      node scripts/reparar.mjs deshacer --input estado-actual.json --rama 1 --apply --output estado-fixed.json
 *
 *   3b. Si el rebalanceo borró historiales, reconstruir desde manifiesto:
 *      node scripts/reparar.mjs reconstruir --input estado-actual.json --manifiesto scripts/ejemplo-manifiesto.json --apply
 *
 *   3c. Restaurar snapshot completo (backup previo):
 *      node scripts/reparar.mjs restaurar --snapshot backup.json --apply --db ./data/arbol.db
 *
 *   4. Escribir en la BD local o subir con PUT /api/estado
 *      node scripts/reparar.mjs aplicar --input estado-fixed.json --db ./data/arbol.db
 *
 * Variables de entorno:
 *   ARBOL_DB_PATH  Ruta a arbol.db (por defecto ./data/arbol.db)
 */

import { mkdirSync, readFileSync, writeFileSync, copyFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

/* ------------------------------------------------------------------ */
/* Utilidades de dominio (espejo de src/lib/escaleras.ts)              */
/* ------------------------------------------------------------------ */

function redondear(valor) {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function truncarEntero(valor) {
  const seguro = redondear(valor);
  const entero = Math.floor(seguro);
  return { entero, resto: redondear(seguro - entero) };
}

function huchaDe(estado) {
  return typeof estado.hucha === "number" ? estado.hucha : 0;
}

function esRamaHucha(rama) {
  return rama.esHucha === true;
}

function ramasPrincipales(estado) {
  return estado.ramas.filter((r) => !esRamaHucha(r));
}

function statsMesDe(stats) {
  return {
    apuestasRealizadas: stats?.apuestasRealizadas ?? 0,
    escalerasRotas: stats?.escalerasRotas ?? 0,
  };
}

function recalcularBankroll(estado) {
  const hucha = redondear(huchaDe(estado));
  const balanceActual = redondear(
    estado.ramas.reduce((s, r) => s + r.montoActual, 0) + hucha,
  );
  return {
    ...estado,
    hucha,
    bankroll: {
      ...estado.bankroll,
      balanceActual,
      gananciasAcumuladas: redondear(balanceActual - estado.capitalInicial),
    },
  };
}

function esEstadoValido(valor) {
  if (typeof valor !== "object" || valor === null) return false;
  return (
    typeof valor.fase === "string" &&
    typeof valor.capitalInicial === "number" &&
    typeof valor.bankroll === "object" &&
    valor.bankroll !== null &&
    Array.isArray(valor.ramas)
  );
}

function nuevoId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Última transacción resuelta (ganado o perdido), empezando por el final. */
function ultimaTransaccionResuelta(rama) {
  for (let i = rama.historial.length - 1; i >= 0; i--) {
    const t = rama.historial[i];
    if (t.resultado === "ganado" || t.resultado === "perdido") {
      return { transaccion: t, indice: i };
    }
  }
  return null;
}

/**
 * Deshace la última resolución (ganada o rota) de una rama.
 * Devuelve null si no hay nada que deshacer.
 */
function deshacerUltimaResolucionRama(rama) {
  const resuelta = ultimaTransaccionResuelta(rama);
  if (!resuelta) return null;

  const { transaccion: t, indice } = resuelta;
  let deltaHucha = 0;
  let deltaRoturas = 0;
  let historial = [...rama.historial];
  let montoActual = rama.montoActual;
  let pasoActual = rama.pasoActual;
  let estadoRama = rama.estado;

  if (t.resultado === "ganado") {
    const { resto } = truncarEntero(t.stake * t.cuota);
    montoActual = t.stake;
    pasoActual = Math.max(0, pasoActual - 1);
    deltaHucha = -resto;
    if (estadoRama === "completada") estadoRama = "activa";
    historial = historial.map((tx, i) =>
      i === indice ? { ...tx, resultado: "pendiente" } : tx,
    );
  } else if (t.resultado === "perdido") {
    if (estadoRama !== "rotura") {
      // Apuesta perdida sin rotura de rama (caso raro): restaurar stake.
      montoActual = t.stake;
    } else {
      montoActual = t.stake;
      estadoRama = "activa";
      deltaRoturas = -1;
    }
    historial = historial.map((tx, i) =>
      i === indice ? { ...tx, resultado: "pendiente" } : tx,
    );
  }

  return {
    rama: { ...rama, montoActual, pasoActual, estado: estadoRama, historial },
    deltaHucha,
    deltaRoturas,
    accion:
      t.resultado === "ganado"
        ? `ganada → pendiente (${t.partido}, cuota ${t.cuota})`
        : `rota → pendiente (${t.partido}, cuota ${t.cuota})`,
  };
}

function deshacerResolucionEnEstado(estado, selector) {
  const principales = ramasPrincipales(estado);
  const objetivos = resolverSelectorRamas(principales, selector);
  if (objetivos.length === 0) {
    throw new Error(`Ninguna rama coincide con "${selector}".`);
  }

  let deltaHucha = 0;
  let deltaRoturas = 0;
  const cambios = [];
  const idsObjetivo = new Set(objetivos.map((r) => r.id));

  const ramas = estado.ramas.map((rama) => {
    if (!idsObjetivo.has(rama.id)) return rama;
    const resultado = deshacerUltimaResolucionRama(rama);
    if (!resultado) {
      cambios.push({ rama: rama.nombre, ok: false, detalle: "sin resolución que deshacer" });
      return rama;
    }
    deltaHucha += resultado.deltaHucha;
    deltaRoturas += resultado.deltaRoturas;
    cambios.push({ rama: rama.nombre, ok: true, detalle: resultado.accion });
    return resultado.rama;
  });

  const stats = statsMesDe(estado.statsMes);
  const siguiente = recalcularBankroll({
    ...estado,
    ramas,
    hucha: redondear(huchaDe(estado) + deltaHucha),
    statsMes: {
      ...stats,
      escalerasRotas: Math.max(0, stats.escalerasRotas + deltaRoturas),
    },
  });

  return { estado: siguiente, cambios };
}

function resolverSelectorRamas(principales, selector) {
  const s = String(selector).trim().toLowerCase();
  if (s === "todas" || s === "all" || s === "principales") {
    return principales;
  }
  const porIndice = /^([1-4])$/.exec(s);
  if (porIndice) {
    const idx = Number(porIndice[1]) - 1;
    return principales[idx] ? [principales[idx]] : [];
  }
  return principales.filter(
    (r) =>
      r.id === selector ||
      r.nombre.toLowerCase() === s ||
      r.nombre.toLowerCase() === `escalera ${s}`,
  );
}

/** Detecta síntomas de rebalanceo destructivo (historial borrado). */
function detectarRebalanceoDestructivo(estado) {
  const principales = ramasPrincipales(estado);
  if (principales.length !== 4) return null;

  const sinHistorial = principales.every((r) => r.historial.length === 0);
  const pasoCero = principales.every((r) => r.pasoActual === 0);
  const montosIguales =
    new Set(principales.map((r) => r.montoActual)).size === 1;
  const stats = statsMesDe(estado.statsMes);
  const actividadMes =
    stats.apuestasRealizadas > 0 || stats.escalerasRotas > 0;

  if (sinHistorial && pasoCero && montosIguales && actividadMes) {
    return {
      sospecha: true,
      monto: principales[0].montoActual,
      mensaje:
        "Las 4 principales están en paso 0, sin historial y con el mismo importe, " +
        "pero el mes registra actividad. Probable rebalanceo prematuro: usa " +
        "`reconstruir --manifiesto` o `restaurar --snapshot`.",
    };
  }
  return { sospecha: false };
}

/**
 * Reconstruye las 4 escaleras principales desde un manifiesto JSON,
 * preservando la escalera de hucha si existía.
 */
function reconstruirDesdeManifiesto(estado, manifiesto) {
  if (!Array.isArray(manifiesto.ramas) || manifiesto.ramas.length !== 4) {
    throw new Error("El manifiesto debe incluir exactamente 4 entradas en `ramas`.");
  }

  const huchaRamas = estado.ramas.filter(esRamaHucha);
  const nuevasPrincipales = manifiesto.ramas.map((spec, i) => {
    const historial = [];
    if (spec.apuestaPendiente) {
      const ap = spec.apuestaPendiente;
      historial.push({
        id: nuevoId(),
        partido: ap.partido ?? "Apuesta pendiente",
        cuota: Number(ap.cuota),
        tipo: ap.tipo ?? "tiros_libres",
        resultado: "pendiente",
        stake: ap.stake ?? spec.montoActual,
        fecha: ap.fecha ?? new Date().toISOString(),
      });
    }

    return {
      id: spec.id ?? nuevoId(),
      nombre: spec.nombre ?? `Escalera ${i + 1}`,
      montoInicial: Number(spec.montoInicial),
      montoActual: Number(spec.montoActual),
      pasoActual: Number(spec.pasoActual ?? 0),
      estado: spec.estado ?? "activa",
      historial,
      esHucha: false,
    };
  });

  let siguiente = {
    ...estado,
    fase: manifiesto.fase ?? estado.fase,
    hucha: manifiesto.hucha ?? huchaDe(estado),
    statsMes: manifiesto.statsMes ?? estado.statsMes,
    ramas: [...nuevasPrincipales, ...huchaRamas],
  };

  return recalcularBankroll(siguiente);
}

/* ------------------------------------------------------------------ */
/* Persistencia                                                        */
/* ------------------------------------------------------------------ */

function rutaDbPorDefecto() {
  return resolve(process.cwd(), process.env.ARBOL_DB_PATH ?? "./data/arbol.db");
}

function leerDesdeDb(rutaDb) {
  mkdirSync(dirname(rutaDb), { recursive: true });
  const db = new DatabaseSync(rutaDb);
  db.exec("PRAGMA journal_mode = WAL;");
  const fila = db.prepare("SELECT data FROM estado WHERE id = 1").get();
  db.close();
  if (!fila) throw new Error(`No hay estado en ${rutaDb}`);
  const estado = JSON.parse(fila.data);
  if (!esEstadoValido(estado)) throw new Error("Estado en BD con formato inválido");
  return estado;
}

function guardarEnDb(rutaDb, estado) {
  mkdirSync(dirname(rutaDb), { recursive: true });
  const db = new DatabaseSync(rutaDb);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec(`
    CREATE TABLE IF NOT EXISTS estado (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  db.prepare(
    `INSERT INTO estado (id, data, updated_at) VALUES (1, :data, :updated)
     ON CONFLICT(id) DO UPDATE SET data = :data, updated_at = :updated`,
  ).run({
    data: JSON.stringify(estado),
    updated: new Date().toISOString(),
  });
  db.close();
}

function leerJson(ruta) {
  const raw = readFileSync(ruta, "utf8");
  const estado = JSON.parse(raw);
  if (!esEstadoValido(estado)) throw new Error(`JSON inválido: ${ruta}`);
  return estado;
}

function escribirJson(ruta, estado) {
  writeFileSync(ruta, JSON.stringify(estado, null, 2), "utf8");
}

function backupAntesDeAplicar(rutaDestino, estado) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = rutaDestino.replace(/(\.\w+)?$/, `.backup-${stamp}$1`);
  escribirJson(backup, estado);
  console.log(`Copia de seguridad: ${backup}`);
  return backup;
}

/* ------------------------------------------------------------------ */
/* Inspección                                                          */
/* ------------------------------------------------------------------ */

function formatearTransaccion(t) {
  const icono =
    t.resultado === "pendiente" ? "⏳" : t.resultado === "ganado" ? "✓" : "✗";
  return `    ${icono} ${t.partido} @ ${t.cuota} · stake ${t.stake}€ · ${t.resultado}`;
}

function inspectar(estado) {
  console.log("\n=== ESTADO DEL ÁRBOL ===\n");
  console.log(`Fase:           ${estado.fase}`);
  console.log(`Capital inicial: ${estado.capitalInicial}€`);
  console.log(`Hucha:          ${huchaDe(estado)}€`);
  console.log(`Balance:        ${estado.bankroll.balanceActual}€`);
  console.log(`Ganancias:      ${estado.bankroll.gananciasAcumuladas}€`);
  console.log(`Mes activo:     ${estado.mesActivo ?? "(sin dato)"}`);

  const stats = statsMesDe(estado.statsMes);
  console.log(
    `Stats mes:      ${stats.apuestasRealizadas} apuestas, ${stats.escalerasRotas} roturas`,
  );

  const alerta = detectarRebalanceoDestructivo(estado);
  if (alerta?.sospecha) {
    console.log(`\n⚠️  ${alerta.mensaje}`);
  }

  console.log("\n--- Ramas ---\n");
  for (const rama of estado.ramas) {
    const tag = esRamaHucha(rama) ? " [HUCHA]" : "";
    console.log(
      `${rama.nombre}${tag}  id=${rama.id.slice(0, 8)}…`,
    );
    console.log(
      `  ${rama.estado} · paso ${rama.pasoActual} · ${rama.montoActual}€ (base ${rama.montoInicial}€)`,
    );
    if (rama.historial.length === 0) {
      console.log("  (sin historial)");
    } else {
      for (const t of rama.historial) console.log(formatearTransaccion(t));
    }
    console.log("");
  }
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

function ayuda() {
  console.log(`
Reparación del estado — Árbol de Escaleras

Comandos:
  inspect     Muestra resumen del estado
  export      Lee la BD y escribe JSON
  deshacer    Deshace la última resolución (ganada/rota) en una o todas las ramas
  reconstruir Reemplaza las 4 principales según un manifiesto JSON
  restaurar   Sustituye el estado completo por un snapshot
  aplicar     Escribe un JSON en la BD (con backup previo)

Opciones comunes:
  --db PATH         Base SQLite (default: ARBOL_DB_PATH o ./data/arbol.db)
  --input PATH      JSON de entrada
  --output PATH     JSON de salida (default: stdout en dry-run)
  --apply           Aplica cambios (sin --apply solo simula / inspecciona)
  --rama SELECTOR   1|2|3|4|nombre|id|todas  (comando deshacer)
  --manifiesto PATH JSON con las 4 escaleras a reconstruir
  --snapshot PATH   JSON de estado completo (comando restaurar)

Ejemplos:
  node scripts/reparar.mjs export --db ./data/arbol.db -o estado.json
  node scripts/reparar.mjs inspect --input estado.json
  node scripts/reparar.mjs deshacer --input estado.json --rama todas --output fixed.json
  node scripts/reparar.mjs reconstruir --input estado.json --manifiesto scripts/ejemplo-manifiesto.json --apply --output fixed.json
  node scripts/reparar.mjs aplicar --input fixed.json --db ./data/arbol.db
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--db") args.db = argv[++i];
    else if (a === "--input" || a === "-i") args.input = argv[++i];
    else if (a === "--output" || a === "-o") args.output = argv[++i];
    else if (a === "--manifiesto") args.manifiesto = argv[++i];
    else if (a === "--snapshot") args.snapshot = argv[++i];
    else if (a === "--rama") args.rama = argv[++i];
    else if (a === "--apply") args.apply = true;
    else if (a === "--help" || a === "-h") args.help = true;
    else args._.push(a);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args._.length === 0) {
    ayuda();
    process.exit(args.help ? 0 : 1);
  }

  const comando = args._[0];
  const rutaDb = resolve(args.db ?? rutaDbPorDefecto());

  function cargarEstado() {
    if (args.input) return leerJson(resolve(args.input));
    if (existsSync(rutaDb)) return leerDesdeDb(rutaDb);
    throw new Error("Indica --input JSON o una --db existente.");
  }

  function persistir(estado, estadoPrevio) {
    if (!args.apply) {
      console.log("\n(dry-run: usa --apply para guardar)");
      if (args.output) {
        escribirJson(resolve(args.output), estado);
        console.log(`Escrito: ${args.output}`);
      } else {
        console.log("\nEstado resultante (JSON):");
        console.log(JSON.stringify(estado, null, 2));
      }
      return;
    }

    if (estadoPrevio && args.output) {
      backupAntesDeAplicar(resolve(args.output), estadoPrevio);
    }

    if (args.output) {
      escribirJson(resolve(args.output), estado);
      console.log(`Guardado: ${args.output}`);
    }

    if (args.db || existsSync(rutaDb)) {
      if (estadoPrevio) {
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupDb = `${rutaDb}.backup-${stamp}`;
        try {
          copyFileSync(rutaDb, backupDb);
          console.log(`Backup BD: ${backupDb}`);
        } catch {
          /* BD nueva */
        }
      }
      guardarEnDb(rutaDb, estado);
      console.log(`BD actualizada: ${rutaDb}`);
    }
  }

  switch (comando) {
    case "inspect": {
      inspectar(cargarEstado());
      break;
    }

    case "export": {
      const estado = leerDesdeDb(rutaDb);
      const dest = args.output ?? "estado-export.json";
      escribirJson(resolve(dest), estado);
      console.log(`Exportado → ${dest}`);
      inspectar(estado);
      break;
    }

    case "deshacer": {
      const previo = cargarEstado();
      const selector = args.rama ?? "todas";
      inspectar(previo);
      const { estado, cambios } = deshacerResolucionEnEstado(previo, selector);
      console.log("\n=== CAMBIOS ===\n");
      for (const c of cambios) {
        console.log(
          c.ok ? `✓ ${c.rama}: ${c.detalle}` : `- ${c.rama}: ${c.detalle}`,
        );
      }
      console.log("");
      inspectar(estado);
      persistir(estado, previo);
      break;
    }

    case "reconstruir": {
      if (!args.manifiesto) {
        throw new Error("Indica --manifiesto con la definición de las 4 escaleras.");
      }
      const previo = cargarEstado();
      const manifiesto = JSON.parse(readFileSync(resolve(args.manifiesto), "utf8"));
      inspectar(previo);
      const estado = reconstruirDesdeManifiesto(previo, manifiesto);
      console.log("\n=== TRAS RECONSTRUCCIÓN ===\n");
      inspectar(estado);
      persistir(estado, previo);
      break;
    }

    case "restaurar": {
      if (!args.snapshot) {
        throw new Error("Indica --snapshot con el JSON de backup completo.");
      }
      const snapshot = leerJson(resolve(args.snapshot));
      let previo = null;
      try {
        previo = cargarEstado();
        console.log("\n--- Estado actual (será reemplazado) ---");
        inspectar(previo);
      } catch {
        console.log("No hay estado previo; se aplicará el snapshot directamente.");
      }
      console.log("\n--- Snapshot a restaurar ---");
      inspectar(snapshot);
      persistir(snapshot, previo);
      break;
    }

    case "aplicar": {
      if (!args.input) throw new Error("Indica --input con el JSON a aplicar.");
      const estado = leerJson(resolve(args.input));
      let previo = null;
      try {
        previo = cargarEstado();
      } catch {
        /* ok */
      }
      inspectar(estado);
      persistir(estado, previo);
      break;
    }

    default:
      console.error(`Comando desconocido: ${comando}`);
      ayuda();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
