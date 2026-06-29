import { NextResponse } from "next/server";

import { data } from "@/server/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const reputation = await data.getBusinessReputationDetail(id);
  if (!reputation) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ reputation });
}
