import { NextResponse } from "next/server";
import { splitCv } from "@/lib/latex";
import { getCv, saveCv } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ tex: await getCv() });
}

export async function POST(req: Request) {
  const { tex } = (await req.json()) as { tex: string };
  try {
    splitCv(tex);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  await saveCv(tex);
  return NextResponse.json({ ok: true });
}
