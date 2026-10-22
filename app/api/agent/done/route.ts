import { NextResponse } from "next/server";
import { ensureApplications } from "@/lib/applications";
import { getApplications, getJob, saveApplications, upsertJob } from "@/lib/store";

/** Called by the extension after the user confirmed and the application was submitted. */
export async function POST(req: Request) {
  const { jobId } = (await req.json()) as { jobId: string };
  const job = await getJob(jobId);
  if (!job) return NextResponse.json({ error: "Job nicht gefunden" }, { status: 404 });
  const saved = await upsertJob({ ...job, status: "beworben" });
  await ensureApplications([saved]);
  const apps = await getApplications();
  const app = apps[`job-${jobId}`];
  if (app) {
    apps[app.id] = { ...app, notes: [app.notes, "per Agent"].filter(Boolean).join(" · ") };
    await saveApplications(apps);
  }
  return NextResponse.json({ ok: true });
}
