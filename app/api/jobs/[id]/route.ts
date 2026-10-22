import { NextResponse } from "next/server";
import { fetchJobDetail } from "@/lib/linkedin";
import { readOutput } from "@/lib/output";
import { getJob, upsertJob } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  let job = await getJob(id);
  if (!job) return NextResponse.json({ error: "Job nicht gefunden" }, { status: 404 });
  if (!job.description) {
    try {
      const d = await fetchJobDetail(id);
      job = await upsertJob({ ...job, ...d, title: d.title || job.title, company: d.company || job.company, location: d.location || job.location });
    } catch (e) {
      return NextResponse.json({ job, error: (e as Error).message });
    }
  }
  if (job.status === "neu") job = await upsertJob({ ...job, status: "angesehen" });
  const raw = await readOutput(id, "result.json");
  return NextResponse.json({ job, result: raw ? JSON.parse(raw.toString()) : null });
}
