import { NextResponse } from "next/server";

import { borrarCookieSesion } from "@/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  borrarCookieSesion();
  return NextResponse.json({ ok: true });
}
