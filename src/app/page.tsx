import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Destellos de color difuminados que dan vida al fondo de cristal. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-sky-500/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-[120px]"
      />

      <div className="relative z-10">
        <Dashboard />
      </div>
    </div>
  );
}
