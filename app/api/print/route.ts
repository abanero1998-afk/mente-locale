import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json({
      ok: true,
      printed: false,
      zpl: body?.zpl || "",
      printer_ip: body?.printer_ip || null,
      note: "ZPL pronto. Collega IP stampante Zebra in localStorage.printer_ip",
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
