import { NextRequest, NextResponse } from "next/server";
import { BRAND_ICONS } from "@/lib/brand-icons";

export async function GET(req: NextRequest) {
  const size = req.nextUrl.searchParams.get("s") || "mark";
  const key = size === "180" ? "icon180" : size === "192" || size === "512" ? "icon192" : "logoMark";
  const buf = Buffer.from(BRAND_ICONS[key], "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
