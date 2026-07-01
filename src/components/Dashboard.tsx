"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useArbolEscaleras } from "@/hooks/useArbolEscaleras";
import { AnalisisMes } from "@/components/AnalisisMes";
import { AnalizadorCuotas } from "@/components/AnalizadorCuotas";
import { BankrollHeader } from "@/components/BankrollHeader";
import { FormInicioFase1 } from "@/components/FormInicioFase1";
import { MenuPrincipal, type VistaApp } from "@/components/MenuPrincipal";
import { TarjetaRama } from "@/components/TarjetaRama";
import { RecuperacionEstado } from "@/components/RecuperacionEstado";
import { ModalElegirModoInicio } from "@/components/ModalElegirModoInicio";
import { ModalEleccionRotura } from "@/components/ModalEleccionRotura";
import { formatearMes, claveMes } from "@/lib/mes";

/** Esqueleto mostrado mientras se hidrata el estado desde la base de datos. */
function Esqueleto() {
  return (
    <div className="animate-pulse-soft space-y-6">
      <div className="glass h-12 rounded-2xl" />
      <div className="glass h-40 rounded-2xl" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

/** Componente raíz de la aplicación: conecta el hook con la UI. */
export function Dashboard() {
  const {
    hydrated,
    fase,
    bankroll,
    ramas,
    hucha,
    reserva,
    huchaParaRama,
    existeEscaleraHucha,
    alertaSuelo,
    descartarAlertaSuelo,
    mesActivo,
    statsMes,
    historialMensual,
    balanceAperturaMes,
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
    desgloseRetiro,
    retirarCapital,
    reponerEscaleraRota,
    continuarSinEscaleraRota,
    avanzarPaso,
    declararRotura,
    deshacerUltimaResolucion,
    deshacerRebalanceo,
    importarEstado,
    respaldoDeshacer,
    estadoSospechoso,
    cierreMesBloqueado,
    apuestasBloqueandoCierre,
    reinyectarCapital,
    ajustarCapital,
    crearRamaDesdeHucha,
    renombrarRama,
    eliminarRama,
    reiniciar,
  } = useArbolEscaleras();

  const [vista, setVista] = useState<VistaApp>("escaleras");
  const [emailUsuario, setEmailUsuario] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const respuesta = await fetch("/api/auth/me", { cache: "no-store" });
        if (respuesta.ok) {
          const datos = (await respuesta.json()) as { email: string };
          if (!cancelado) setEmailUsuario(datos.email);
        }
      } catch {
        /* sesión no disponible */
      }
    })();
    return () => {
      cancelado = true;
    };
  }, []);

  const cerrarSesion = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }, [router]);

  const handleReiniciar = () => {
    if (
      window.confirm(
        "¿Seguro que quieres reiniciar? Se borrará el progreso del mes actual (el historial mensual se conserva).",
      )
    ) {
      reiniciar();
    }
  };

  const tronco = ramas[0];

  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 py-5 sm:px-6 lg:px-8">
      {!hydrated ? (
        <Esqueleto />
      ) : (
        <div className="space-y-5">
          <MenuPrincipal
            vista={vista}
            onCambiar={setVista}
            emailUsuario={emailUsuario}
            onCerrarSesion={cerrarSesion}
          />

          {vista === "escaleras" ? (
            <>
              {pendienteModoInicio ? (
                <ModalElegirModoInicio
                  datos={pendienteModoInicio}
                  onCuatroEscaleras={arrancarCuatroEscaleras}
                  onFase1Simple={descartarModoInicio}
                />
              ) : null}

              {pendienteEleccionRotura ? (
                <ModalEleccionRotura
                  datos={pendienteEleccionRotura}
                  onReponer={reponerEscaleraRota}
                  onContinuar={continuarSinEscaleraRota}
                />
              ) : null}

              {cierreMesBloqueado ? (
                <section
                  role="status"
                  className="glass-card border-amber-300/30 bg-amber-400/[0.06] p-4"
                >
                  <h3 className="text-sm font-semibold text-amber-200">
                    Cierre de mes pendiente
                  </h3>
                  <p className="mt-1 text-xs text-slate-400">
                    El mes de{" "}
                    <span className="font-medium text-amber-100/90">
                      {formatearMes(mesActivo)}
                    </span>{" "}
                    sigue abierto hasta resolver{" "}
                    {apuestasBloqueandoCierre === 1
                      ? "la apuesta activa"
                      : `las ${apuestasBloqueandoCierre} apuestas activas`}
                    . Después se archivará y el saldo de cierre pasará a{" "}
                    <span className="text-slate-300">
                      {formatearMes(claveMes())}
                    </span>
                    .
                  </p>
                </section>
              ) : null}

              <BankrollHeader
                bankroll={bankroll}
                ramas={ramas}
                hucha={hucha}
                reserva={reserva}
                onReiniciar={fase === "inicial" ? undefined : handleReiniciar}
                gestionCapital={{
                  fase,
                  onIngresar: inyectarCapital,
                  desgloseRetiro,
                  onRetirar: retirarCapital,
                }}
              />

              {fase === "inicial" ? (
                <FormInicioFase1
                  reservaDisponible={reserva}
                  onIniciar={iniciarFase1}
                />
              ) : null}

              {fase === "fase1" && tronco ? (
                <section className="mx-auto max-w-md">
                  <TarjetaRama
                    rama={tronco}
                    fase={fase}
                    reinyectables={reinyectables}
                    onAvanzar={avanzarPaso}
                    onRomper={declararRotura}
                    onDeshacer={deshacerUltimaResolucion}
                    onReinyectar={reinyectarCapital}
                    onAjustarCapital={ajustarCapital}
                  />
                </section>
              ) : null}

              {fase === "arbol" && alertaSuelo ? (
                <section
                  role="alert"
                  className="glass-card flex flex-wrap items-center justify-between gap-3 border-amber-300/40 bg-amber-400/[0.08] p-4"
                >
                  <div className="flex items-start gap-3">
                    <span aria-hidden className="text-xl text-amber-300">
                      ⚠
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-amber-200">
                        Suelo de emergencia activado
                      </h3>
                      <p className="text-xs text-slate-400">
                        El rebalanceo se canceló para proteger el interés
                        compuesto de las ramas maduras. La rama rota queda
                        congelada en 0 €.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={descartarAlertaSuelo}
                    className="btn-glass btn-glass-ghost font-semibold"
                  >
                    Entendido
                  </button>
                </section>
              ) : null}

              {fase === "arbol" ? (
                <RecuperacionEstado
                  respaldo={respaldoDeshacer}
                  estadoSospechoso={estadoSospechoso}
                  onDeshacerRebalanceo={deshacerRebalanceo}
                  onImportarEstado={importarEstado}
                />
              ) : null}

              {fase === "arbol" ? (
                <section className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {ramas.map((rama) => (
                    <TarjetaRama
                      key={rama.id}
                      rama={rama}
                      fase={fase}
                      reinyectables={
                        rama.esHucha
                          ? []
                          : reinyectables.filter((r) => r.id !== rama.id)
                      }
                      onAvanzar={avanzarPaso}
                      onRomper={declararRotura}
                      onDeshacer={deshacerUltimaResolucion}
                      onReinyectar={reinyectarCapital}
                      onAjustarCapital={ajustarCapital}
                      onRenombrar={renombrarRama}
                      onEliminar={eliminarRama}
                    />
                  ))}
                </section>
              ) : null}

              {fase === "arbol" ? (
                <section className="glass-card flex flex-wrap items-center justify-between gap-3 border-sky-300/20 p-4">
                  <div>
                    <h3 className="text-sm font-semibold text-sky-200">
                      Hucha de céntimos
                    </h3>
                    <p className="text-xs text-slate-400">
                      {huchaParaRama >= 1
                        ? `Tienes ${huchaParaRama} € enteros para ${
                            existeEscaleraHucha
                              ? "añadir a tu escalera independiente"
                              : "crear tu escalera independiente"
                          }.`
                        : "Acumulando céntimos de cada apuesta ganada."}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={crearRamaDesdeHucha}
                    disabled={huchaParaRama < 1}
                    className="btn-glass font-semibold border-sky-300/30 bg-sky-400/15 text-sky-50 hover:border-sky-300/50 hover:bg-sky-400/25"
                  >
                    {existeEscaleraHucha
                      ? `Añadir ${huchaParaRama} € a la escalera hucha`
                      : `Crear escalera hucha con ${huchaParaRama} €`}
                  </button>
                </section>
              ) : null}
            </>
          ) : null}

          {vista === "cuotas" ? (
            <section>
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-slate-100">
                  Análisis de cuotas
                </h2>
                <p className="text-sm text-slate-400">
                  Mundial FIFA · mercado 1X2 · cuotas en tiempo casi real.
                </p>
              </div>
              <AnalizadorCuotas />
            </section>
          ) : null}

          {vista === "mes" ? (
            <AnalisisMes
              mesActivo={mesActivo}
              statsMes={statsMes}
              historialMensual={historialMensual}
              bankroll={bankroll}
              hucha={hucha}
              balanceAperturaMes={balanceAperturaMes}
            />
          ) : null}
        </div>
      )}
    </main>
  );
}
