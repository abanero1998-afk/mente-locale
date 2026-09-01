import { NextRequest, NextResponse } from "next/server";
import { IMAGES } from "@/lib/logo-data";

export const runtime = "nodejs";

export function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("id") || "logoMark";
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
