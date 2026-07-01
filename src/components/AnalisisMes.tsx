"use client";

import {
  formatearMes,
  UMBRAL_INICIO_MES_PREMIUM,
} from "@/lib/mes";
import { formatearEuros } from "@/lib/format";
import type { BankrollGlobal, ResumenMensual, StatsMesActual } from "@/types";

interface AnalisisMesProps {
  mesActivo: string;
  statsMes: StatsMesActual;
  historialMensual: ResumenMensual[];
  bankroll: BankrollGlobal;
  hucha: number;
  balanceAperturaMes: number;
}

function TarjetaStat({
  etiqueta,
  valor,
  acento,
}: {
  etiqueta: string;
  valor: string;
  acento?: "emerald" | "rose" | "sky" | "amber";
}) {
  const color =
    acento === "emerald"
      ? "text-emerald-400"
      : acento === "rose"
        ? "text-rose-400"
        : acento === "sky"
          ? "text-sky-300"
          : acento === "amber"
            ? "text-amber-300"
            : "text-slate-50";

  return (
    <div className="glass-inset p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">
        {etiqueta}
      </p>
      <p className={`mt-1 text-xl font-bold ${color}`}>{valor}</p>
    </div>
  );
}

/** Vista de estadísticas del mes en curso e historial archivado. */
export function AnalisisMes({
  mesActivo,
  statsMes,
  historialMensual,
  bankroll,
  hucha,
  balanceAperturaMes,
}: AnalisisMesProps) {
  const gananciaMes = bankroll.balanceActual - balanceAperturaMes;
  const historialOrdenado = [...historialMensual].reverse();

  return (
    <div className="space-y-5">
      <section className="glass-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold capitalize text-slate-100">
              {formatearMes(mesActivo)}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Resumen en vivo del mes operativo actual.
            </p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
            En curso
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TarjetaStat
            etiqueta="Apuestas realizadas"
            valor={String(statsMes.apuestasRealizadas)}
          />
          <TarjetaStat
            etiqueta="Escaleras rotas"
            valor={String(statsMes.escalerasRotas)}
            acento={statsMes.escalerasRotas > 0 ? "rose" : undefined}
          />
          <TarjetaStat
            etiqueta="Balance actual"
            valor={formatearEuros(bankroll.balanceActual)}
            acento="sky"
          />
          <TarjetaStat
            etiqueta="Ganancia del mes"
            valor={`${gananciaMes >= 0 ? "+" : ""}${formatearEuros(gananciaMes)}`}
            acento={gananciaMes >= 0 ? "emerald" : "rose"}
          />
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <TarjetaStat
            etiqueta="Hucha (mes actual)"
            valor={formatearEuros(hucha)}
            acento="sky"
          />
          <TarjetaStat
            etiqueta="Balance al abrir mes"
            valor={formatearEuros(balanceAperturaMes)}
          />
        </div>
      </section>

      <section className="glass-card border-white/10 p-5">
        <h3 className="text-sm font-semibold text-slate-200">
          Regla de inicio de mes
        </h3>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Al cambiar de mes, el anterior se archiva cuando{" "}
          <span className="text-amber-300">no queden apuestas activas</span>. El
          nuevo mes conserva el{" "}
          <span className="text-emerald-300">saldo de cierre</span>, las
          escaleras y su historial; solo se reinician los contadores del mes. Si
          el cierre supera{" "}
          <span className="text-emerald-300">
            {formatearEuros(UMBRAL_INICIO_MES_PREMIUM)}
          </span>
          , queda marcado como mes premium en el historial.
        </p>
      </section>

      <section className="glass-card p-5">
        <h3 className="text-base font-semibold text-slate-100">
          Historial mensual
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Meses cerrados con sus métricas archivadas.
        </p>

        {historialOrdenado.length === 0 ? (
          <p className="mt-4 rounded-md border border-white/[0.06] bg-white/[0.02] p-6 text-center text-sm text-slate-400">
            Aún no hay meses archivados. El primer cierre se registrará cuando
            cambie el calendario.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Mes</th>
                  <th className="pb-3 pr-4 font-medium">Apuestas</th>
                  <th className="pb-3 pr-4 font-medium">Roturas</th>
                  <th className="pb-3 pr-4 font-medium">Cierre</th>
                  <th className="pb-3 pr-4 font-medium">Ganancia</th>
                  <th className="pb-3 pr-4 font-medium">Hucha</th>
                  <th className="pb-3 font-medium">Siguiente mes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {historialOrdenado.map((fila) => (
                  <tr key={fila.mes} className="text-slate-300">
                    <td className="py-3 pr-4 capitalize text-slate-100">
                      {formatearMes(fila.mes)}
                    </td>
                    <td className="py-3 pr-4">{fila.apuestasRealizadas}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          fila.escalerasRotas > 0
                            ? "text-rose-400"
                            : undefined
                        }
                      >
                        {fila.escalerasRotas}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-100">
                      {formatearEuros(fila.balanceCierre)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          fila.gananciasMes >= 0
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }
                      >
                        {fila.gananciasMes >= 0 ? "+" : ""}
                        {formatearEuros(fila.gananciasMes)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">{formatearEuros(fila.huchaCierre)}</td>
                    <td className="py-3">
                      {fila.activoInicioPremium ? (
                        <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300 ring-1 ring-inset ring-emerald-400/30">
                          Premium
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">
                          Saldo conservado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
