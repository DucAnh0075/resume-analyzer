import { NextResponse } from "next/server";
import { aiFilterJobs } from "@/lib/jobfilter";
import { getJobs, getSearches, saveJobs } from "@/lib/store";

export const maxDuration = 120;

/** Applies a profile's AI filter to its existing untouched jobs. */
export async function POST(req: Request) {
  const { searchId } = (await req.json()) as { searchId: string };
  const profile = (await getSearches()).find((s) => s.id === searchId);
  if (!profile?.aiFilter?.trim()) return NextResponse.json({ error: "Dieses Suchprofil hat keinen KI-Filter." }, { status: 400 });
  try {
    const jobs = await getJobs();
    const candidates = Object.values(jobs).filter(
      (j) => j.searchId === searchId && (j.status === "neu" || j.status === "angesehen") && !j.bookmarked && !j.tailored && !j.cover,
    );
    const verdicts = await aiFilterJobs(candidates, profile.aiFilter);
    let filtered = 0;
    for (const j of candidates) {
      const v = verdicts.get(j.id);
      if (v && !v.keep) {
        jobs[j.id] = { ...j, status: "ignoriert", filterReason: v.reason };
        filtered++;
      }
    }
    await saveJobs(jobs);
    return NextResponse.json({ checked: candidates.length, filtered });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
