import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode = body?.mode || "zpl";
    const zpl = body?.zpl || "";
    if (mode === "https" && body?.httpsUrl) {
      try {
        const r = await fetch(body.httpsUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: zpl,
        });
        return NextResponse.json({ ok: r.ok, printed: r.ok, mode, note: r.ok ? "Inviato via HTTPS" : "HTTPS stampante non ha risposto" });
      } catch {
        return NextResponse.json({ ok: false, printed: false, mode, note: "HTTPS stampante non raggiungibile" });
      }
    }
    return NextResponse.json({
      ok: true,
      printed: false,
      mode,
      zpl,
      printer_ip: body?.ip || body?.printer_ip || null,
      btName: body?.btName || null,
      note:
        mode === "bt"
          ? "Modalità Bluetooth: apri Web Bluetooth dal telefono e invia ZPL"
          : "ZPL pronto. Imposta IP:porta della stampante in HACCP → Stampante",
    });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
