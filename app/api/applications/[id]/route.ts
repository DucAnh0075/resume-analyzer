import { NextResponse } from "next/server";
import { applyStage } from "@/lib/applications";
import { STAGES } from "@/lib/sankey";
import { getApplications, getJob, saveApplications, upsertJob } from "@/lib/store";
import type { AppStage } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  const b = (await req.json()) as { stage?: AppStage; notes?: string; appliedAt?: string };
  const apps = await getApplications();
  let app = apps[id];
  if (!app) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  if (b.stage) {
    if (!STAGES.includes(b.stage)) return NextResponse.json({ error: "Ungültiger Stand" }, { status: 400 });
    app = applyStage(app, b.stage);
  }
  if (b.notes !== undefined) app = { ...app, notes: b.notes };
  if (b.appliedAt) app = { ...app, appliedAt: new Date(b.appliedAt).toISOString() };
  apps[id] = app;
  await saveApplications(apps);
  return NextResponse.json(app);
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  const apps = await getApplications();
  const app = apps[id];
  if (!app) return NextResponse.json({ ok: true });
  delete apps[id];
  await saveApplications(apps);
  // Otherwise the backfill would recreate it from the job's "beworben" status.
  if (app.jobId) {
    const job = await getJob(app.jobId);
    if (job?.status === "beworben") await upsertJob({ ...job, status: "angesehen" });
  }
  return NextResponse.json({ ok: true });
}
