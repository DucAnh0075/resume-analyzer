import { NextResponse } from "next/server";
import { ensureApplications } from "@/lib/applications";
import { getJob, upsertJob } from "@/lib/store";
import { withStatus } from "@/lib/jobs";
import type { JobStatus } from "@/lib/types";

const VALID: JobStatus[] = ["neu", "angesehen", "beworben", "ignoriert"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status } = (await req.json()) as { status: JobStatus };
  const job = await getJob(id);
  if (!job || !VALID.includes(status)) return NextResponse.json({ error: "Ungültig" }, { status: 400 });
  const saved = await upsertJob(withStatus(job, status));
  if (status === "beworben") await ensureApplications([saved]);
  return NextResponse.json(saved);
}
