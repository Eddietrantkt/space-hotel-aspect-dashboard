import { NextResponse } from "next/server";

import { listDataFiles } from "@/lib/server-data";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ files: await listDataFiles() });
}

