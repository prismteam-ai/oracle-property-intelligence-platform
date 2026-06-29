import { NextResponse } from "next/server";

import { data } from "@/server/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const permit = await data.getPermitByNumber(number);
  if (!permit) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const contractors = await data.listContractorQualityScoresForPermitNumber(number);
  return NextResponse.json({ permit, contractors });
}
