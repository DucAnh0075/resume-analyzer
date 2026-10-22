import { NextResponse } from "next/server";
import { aiFilterJobs } from "@/lib/jobfilter";
import { LinkedInBlockedError, searchJobs } from "@/lib/linkedin";
import { getCv, getJobs, getSearches, saveJobs } from "@/lib/store";
import type { Job } from "@/lib/types";

const tokens = (s: string) => new Set(s.toLowerCase().match(/[a-zäöüß+#.]{3,}/g) ?? []);

export const maxDuration = 120;

export async function POST(req: Request) {
  const { searchId } = (await req.json()) as { searchId: string };
  const profile = (await getSearches()).find((s) => s.id === searchId);
  if (!profile) return NextResponse.json({ error: "Suchprofil nicht gefunden" }, { status: 404 });

  try {
    const { jobs: found, warning } = await searchJobs(profile);
    const exclude = profile.excludeKeywords.map((k) => k.toLowerCase());
    const cvTokens = tokens(await getCv());
    const stored = await getJobs();
    const fresh: Job[] = [];
    for (const c of found) {
      if (exclude.some((k) => c.title.toLowerCase().includes(k))) continue;
      const titleTokens = [...tokens(c.title)];
      const score = titleTokens.length ? Math.round((100 * titleTokens.filter((t) => cvTokens.has(t)).length) / titleTokens.length) : 0;
      if (stored[c.id]) {
        stored[c.id].score = score;
        continue;
      }
      fresh.push({ ...c, status: "neu", searchId: profile.id, score, foundAt: new Date().toISOString() });
    }

    // Optional AI filter: unsuitable jobs are kept but ignored, with the reason, so mistakes can be restored.
    let filtered = 0;
    let filterWarning: string | undefined;
    if (profile.aiFilter?.trim() && fresh.length) {
      try {
        const verdicts = await aiFilterJobs(fresh, profile.aiFilter);
        for (const j of fresh) {
          const v = verdicts.get(j.id);
          if (v && !v.keep) {
            j.status = "ignoriert";
            j.filterReason = v.reason;
            filtered++;
          }
        }
      } catch (e) {
        filterWarning = `AI-Filter fehlgeschlagen, Stellen ungefiltert gespeichert: ${(e as Error).message}`;
      }
    }
    for (const j of fresh) stored[j.id] = j;
    await saveJobs(stored);
    return NextResponse.json({ added: fresh.length - filtered, filtered, total: found.length, warning: [warning, filterWarning].filter(Boolean).join(" ") || undefined });
  } catch (e) {
    const status = e instanceof LinkedInBlockedError ? 429 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
