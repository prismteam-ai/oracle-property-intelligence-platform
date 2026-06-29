import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { resolveProviderKind } from "@/server/provider-kind";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const provider = resolveProviderKind(process.env);

  if (provider === "memory") {
    return NextResponse.json({ status: "ok", provider, db: "skipped" });
  }

  const { db } = await import("@/server/pg");
  const startedAt = Date.now();
  await db.execute(sql`select 1`);
  return NextResponse.json({
    status: "ok",
    provider,
    db: "reachable",
    latencyMs: Date.now() - startedAt,
  });
}
