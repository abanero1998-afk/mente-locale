import { NextRequest, NextResponse } from "next/server";
import { IMAGES } from "@/lib/logo-data";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const size = params.get("s");
  const id = params.get("id");

  let key = "logoMark";
  if (id && IMAGES[id]) key = id;
  else if (size === "180") key = "icon180";
  else if (size === "192" || size === "512") key = "icon192";

  const raw = IMAGES[key];
  if (!raw) return new NextResponse("not found", { status: 404 });
  const buf = Buffer.from(raw, "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
