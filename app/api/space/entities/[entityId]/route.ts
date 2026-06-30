import { NextResponse } from "next/server";

import { findEntity } from "@/lib/server-data";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ entityId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { entityId } = await context.params;
  const entity = await findEntity(entityId);
  if (!entity) {
    return NextResponse.json({ detail: `Unknown entity_id: ${entityId}` }, { status: 404 });
  }
  return NextResponse.json(entity);
}

