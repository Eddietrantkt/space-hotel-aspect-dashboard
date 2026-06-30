import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    status: "ok",
    app: "SPACE Dashboard API",
    runtime: "vercel-next",
  });
}

