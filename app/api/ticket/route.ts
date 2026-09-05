import { NextResponse } from "next/server";
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true, tipo: body?.tipo || "comanda", tavolo: body?.tavolo || "" });
}
