import { NextResponse } from "next/server";
import { getProfile, saveProfile } from "@/lib/store";
import type { Profile } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getProfile());
}

export async function POST(req: Request) {
  const p = (await req.json()) as Profile;
  const answers = (p.answers ?? []).filter((a) => a.question.trim() && a.answer.trim());
  await saveProfile({ ...p, answers });
  return NextResponse.json({ ok: true });
}
