import { NextResponse } from "next/server";
import { ensureApplications } from "@/lib/applications";
import { getJobs, saveJobs } from "@/lib/store";
import type { JobStatus } from "@/lib/types";

const VALID: JobStatus[] = ["neu", "angesehen", "beworben", "ignoriert"];

export async function POST(req: Request) {
  const { ids, status, bookmarked } = (await req.json()) as { ids: string[]; status?: JobStatus; bookmarked?: boolean };
  if (!Array.isArray(ids) || (status && !VALID.includes(status))) return NextResponse.json({ error: "Ungültig" }, { status: 400 });
  const jobs = await getJobs();
  const touched = ids.filter((id) => jobs[id]);
  for (const id of touched) {
    if (status) jobs[id] = { ...jobs[id], status };
    if (bookmarked !== undefined) jobs[id] = { ...jobs[id], bookmarked };
  }
  await saveJobs(jobs);
  if (status === "beworben") await ensureApplications(touched.map((id) => jobs[id]));
  return NextResponse.json({ updated: touched.length });
}
