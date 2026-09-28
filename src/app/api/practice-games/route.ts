import { NextResponse } from "next/server";
import { isPracticeResult, recordPracticeGame } from "@/lib/practice/record";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isPracticeResult(body)) return NextResponse.json({ saved: false, reason: "invalid" }, { status: 400 });
  return NextResponse.json(await recordPracticeGame(body));
}
