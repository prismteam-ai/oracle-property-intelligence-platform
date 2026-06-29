import { NextResponse } from "next/server";
import { z } from "zod";

import { data } from "@/server/db";

export const runtime = "nodejs";
export const maxDuration = 60;

const QuerySchema = z.object({
  q: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = QuerySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const result = await data.answerQuestion(parsed.data.q);
  return NextResponse.json(result);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q");
  const parsed = QuerySchema.safeParse({ q });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const result = await data.answerQuestion(parsed.data.q);
  return NextResponse.json(result);
}
