"use client";

export type VistaApp = "escaleras" | "cuotas" | "mes";

interface MenuPrincipalProps {
  vista: VistaApp;
  onCambiar: (vista: VistaApp) => void;
  emailUsuario?: string | null;
  onCerrarSesion?: () => void;
}

const ENTRADAS: { id: VistaApp; etiqueta: string }[] = [
  { id: "escaleras", etiqueta: "Escaleras" },
  { id: "cuotas", etiqueta: "Cuotas" },
  { id: "mes", etiqueta: "Análisis mensual" },
];

/** Navegación principal entre secciones de la app. */
export function MenuPrincipal({
  vista,
  onCambiar,
  emailUsuario,
  onCerrarSesion,
}: MenuPrincipalProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav
        aria-label="Menú principal"
        className="glass-card flex flex-wrap gap-1 p-1.5"
      >
        {ENTRADAS.map(({ id, etiqueta }) => {
          const activo = vista === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onCambiar(id)}
              aria-current={activo ? "page" : undefined}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-all duration-200 ${
                activo
                  ? "bg-white/12 text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] ring-1 ring-white/15"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200"
              }`}
            >
              {etiqueta}
            </button>
          );
        })}
      </nav>

      {emailUsuario ? (
        <div className="glass-card flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <span className="max-w-[14rem] truncate text-slate-400" title={emailUsuario}>
            {emailUsuario}
          </span>
          {onCerrarSesion ? (
            <button
              type="button"
              onClick={onCerrarSesion}
              className="btn-glass btn-glass-ghost px-3 py-1 text-xs font-medium"
            >
              Salir
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
