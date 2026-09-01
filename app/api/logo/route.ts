import { NextResponse } from "next/server";
import { LOGO_JPEG } from "@/lib/brand-icons";

export async function GET() {
  const buf = Buffer.from(LOGO_JPEG, "base64");
  return new NextResponse(buf, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
