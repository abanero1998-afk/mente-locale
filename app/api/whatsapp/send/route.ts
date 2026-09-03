import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const to = String(body.to || process.env.SOCIO_WA || "+3444106229").replace(/\s+/g, "");
  const msg = String(body.msg || "");
  const token = process.env.WHATSAPP_TOKEN || "";
  const phoneId = process.env.WHATSAPP_PHONE_ID || "";

  if (!msg) return NextResponse.json({ ok: false, error: "msg vuoto" }, { status: 400 });

  if (token && phoneId) {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace("+", ""),
        type: "text",
        text: { body: msg },
      }),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, provider: "meta", data });
  }

  return NextResponse.json({
    ok: true,
    queued: true,
    provider: "stub",
    to,
    msg,
    hint: "Imposta WHATSAPP_TOKEN e WHATSAPP_PHONE_ID su Vercel per invio reale.",
  });
}
