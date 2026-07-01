"use client";

export type VistaApp = "escaleras" | "cuotas" | "mes";

interface MenuPrincipalProps {
  vista: VistaApp;
  onCambiar: (vista: VistaApp) => void;
  emailUsuario?: string | null;
  onCerrarSesion?: () => void;
}

const ENTRADAS: { id: VistaApp; etiqueta: string; corto: string }[] = [
  { id: "escaleras", etiqueta: "Escaleras", corto: "Escaleras" },
  { id: "cuotas", etiqueta: "Cuotas", corto: "Cuotas" },
  { id: "mes", etiqueta: "Análisis mensual", corto: "Mes" },
];

/** Navegación principal entre secciones de la app. */
export function MenuPrincipal({
  vista,
  onCambiar,
  emailUsuario,
  onCerrarSesion,
}: MenuPrincipalProps) {
  return (
    <header className="glass-card flex items-stretch gap-0 p-1 sm:gap-1 sm:p-1.5">
      <nav
        aria-label="Menú principal"
        className="flex min-w-0 flex-1 items-center gap-0.5 sm:gap-1"
      >
        {ENTRADAS.map(({ id, etiqueta, corto }) => {
          const activo = vista === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onCambiar(id)}
              aria-current={activo ? "page" : undefined}
              className={`min-w-0 flex-1 rounded-md px-1 py-1.5 text-center text-[11px] font-medium transition-colors sm:flex-none sm:px-4 sm:py-2 sm:text-sm ${
                activo
                  ? "bg-white/10 text-slate-50"
                  : "text-slate-500 hover:bg-white/[0.05] hover:text-slate-300"
              }`}
            >
              <span className="sm:hidden">{corto}</span>
              <span className="hidden sm:inline">{etiqueta}</span>
            </button>
          );
        })}
      </nav>

      {emailUsuario && onCerrarSesion ? (
        <div className="flex shrink-0 items-center border-l border-white/[0.08] pl-1 sm:gap-2 sm:pl-2">
          <span
            className="hidden max-w-[11rem] truncate text-xs text-slate-500 md:inline"
            title={emailUsuario}
          >
            {emailUsuario}
          </span>
          <button
            type="button"
            onClick={onCerrarSesion}
            className="rounded-md px-2 py-1.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-white/[0.05] hover:text-slate-300 sm:px-3 sm:text-xs"
          >
            Salir
          </button>
        </div>
      ) : null}
    </header>
  );
}
