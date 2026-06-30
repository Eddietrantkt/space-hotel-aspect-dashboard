import { NextResponse } from "next/server";

import { loadSummaryMethods } from "@/lib/server-data";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await loadSummaryMethods());
}

