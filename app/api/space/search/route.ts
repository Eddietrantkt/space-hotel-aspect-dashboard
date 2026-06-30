import { NextResponse } from "next/server";

import { searchEntities } from "@/lib/server-data";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 25), 1), 100);
  const entities = await searchEntities(q, limit);

  return NextResponse.json({
    query: q,
    count: entities.length,
    entities,
  });
}

