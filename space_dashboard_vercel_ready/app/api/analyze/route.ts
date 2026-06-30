import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    {
      status: "unavailable",
      reason:
        "Model-backed Analyze requires the Python FastAPI runtime with SemAE, sentiment, and summarization models. The Vercel backend serves dashboard data/search only.",
      next_step:
        "Deploy backend/ on a CPU/GPU Python host and set NEXT_PUBLIC_API_URL to that backend when ad-hoc inference is needed.",
    },
    { status: 503 },
  );
}

