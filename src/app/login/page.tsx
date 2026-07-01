import { Suspense } from "react";

import { FormAuth } from "@/components/FormAuth";

function EsqueletoAuth() {
  return (
    <div className="glass-card mx-auto h-80 w-full max-w-md animate-pulse-soft rounded-md" />
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-sky-500/20 blur-[120px]"
      />

      <div className="relative z-10 w-full">
        <Suspense fallback={<EsqueletoAuth />}>
          <FormAuth />
        </Suspense>
      </div>
    </div>
  );
}
