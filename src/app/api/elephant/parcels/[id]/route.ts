import { NextResponse } from "next/server";

import { data } from "@/server/db";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const property =
    (await data.getPropertyById(id)) ?? (await data.getPropertyByParcelIdentifier(id));
  if (!property) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ property });
}
