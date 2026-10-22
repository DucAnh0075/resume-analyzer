import { NextResponse } from "next/server";
import { LinkedInBlockedError, searchJobs } from "@/lib/linkedin";
import { getCv, getJobs, getSearches, saveJobs } from "@/lib/store";
import type { Job } from "@/lib/types";

const tokens = (s: string) => new Set(s.toLowerCase().match(/[a-zäöüß+#.]{3,}/g) ?? []);

export async function POST(req: Request) {
  const { searchId } = (await req.json()) as { searchId: string };
  const profile = (await getSearches()).find((s) => s.id === searchId);
  if (!profile) return NextResponse.json({ error: "Suchprofil nicht gefunden" }, { status: 404 });

  try {
    const { jobs: found, warning } = await searchJobs(profile);
    const exclude = profile.excludeKeywords.map((k) => k.toLowerCase());
    const cvTokens = tokens(await getCv());
    const stored = await getJobs();
    let added = 0;
    for (const c of found) {
      if (exclude.some((k) => c.title.toLowerCase().includes(k))) continue;
      const titleTokens = [...tokens(c.title)];
      const score = titleTokens.length ? Math.round((100 * titleTokens.filter((t) => cvTokens.has(t)).length) / titleTokens.length) : 0;
      if (stored[c.id]) {
        stored[c.id].score = score;
        continue;
      }
      stored[c.id] = { ...c, status: "neu", searchId: profile.id, score, foundAt: new Date().toISOString() } satisfies Job;
      added++;
    }
    await saveJobs(stored);
    return NextResponse.json({ added, total: found.length, warning });
  } catch (e) {
    const status = e instanceof LinkedInBlockedError ? 429 : 500;
    return NextResponse.json({ error: (e as Error).message }, { status });
  }
}
