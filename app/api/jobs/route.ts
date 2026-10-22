import { NextResponse } from "next/server";
import { getJobs } from "@/lib/store";

export async function GET() {
  const jobs = Object.values(await getJobs());
  jobs.sort((a, b) => (b.postedAt ?? b.foundAt).localeCompare(a.postedAt ?? a.foundAt));
  return NextResponse.json(jobs);
}
