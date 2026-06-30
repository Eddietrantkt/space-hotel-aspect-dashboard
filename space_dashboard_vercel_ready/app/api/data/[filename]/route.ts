import { NextResponse } from "next/server";

import { loadDataFile } from "@/lib/server-data";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ filename: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { filename } = await context.params;
  try {
    return NextResponse.json(await loadDataFile(filename));
  } catch {
    return NextResponse.json({ detail: `Unknown data file: ${filename}` }, { status: 404 });
  }
}

