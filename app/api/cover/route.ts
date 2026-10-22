import { NextResponse } from "next/server";
import { splitCv } from "@/lib/latex";
import { getCover, saveCover } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ tex: await getCover() });
}

export async function POST(req: Request) {
  const { tex } = (await req.json()) as { tex: string };
  try {
    splitCv(tex);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.replace("Im CV", "Im Anschreiben") }, { status: 400 });
  }
  await saveCover(tex);
  return NextResponse.json({ ok: true });
}
