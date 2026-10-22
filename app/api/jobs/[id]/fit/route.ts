import { NextResponse } from "next/server";
import { analyzeFit } from "@/lib/fit";
import { fetchJobDetail } from "@/lib/linkedin";
import { getCv, getJob, upsertJob } from "@/lib/store";

export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { lang } = (await req.json().catch(() => ({}))) as { lang?: "de" | "en" };
  try {
    let job = await getJob(id);
    if (!job) return NextResponse.json({ error: "Job nicht gefunden" }, { status: 404 });
    const cv = await getCv();
    if (!cv) return NextResponse.json({ error: "Zuerst unter „Mein CV“ den LaTeX-Lebenslauf speichern." }, { status: 400 });
    if (!job.description) job = await upsertJob({ ...job, ...(await fetchJobDetail(id)) });

    const fit = await analyzeFit(cv, job, lang === "en" ? "en" : "de");
    return NextResponse.json(await upsertJob({ ...job, fit }));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
