import { NextResponse } from "next/server";

import { loadSpaceData } from "@/lib/server-data";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await loadSpaceData());
}

