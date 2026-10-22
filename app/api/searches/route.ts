import { NextResponse } from "next/server";
import { getSearches, saveSearches } from "@/lib/store";
import type { SearchProfile } from "@/lib/types";

export async function GET() {
  return NextResponse.json(await getSearches());
}

export async function POST(req: Request) {
  const p = (await req.json()) as SearchProfile;
  if (!p.keywords?.trim()) return NextResponse.json({ error: "Suchbegriff fehlt" }, { status: 400 });
  const all = await getSearches();
  const profile: SearchProfile = {
    id: p.id || crypto.randomUUID(),
    name: p.name?.trim() || p.keywords,
    keywords: p.keywords.trim(),
    location: p.location?.trim() ?? "",
    radiusKm: Number(p.radiusKm) || 25,
    postedWithin: p.postedWithin ?? "week",
    workplace: p.workplace ?? [],
    experience: p.experience ?? [],
    excludeKeywords: (p.excludeKeywords ?? []).map((k) => k.trim()).filter(Boolean),
    maxResults: Math.min(Number(p.maxResults) || 50, 100),
  };
  const next = all.some((s) => s.id === profile.id) ? all.map((s) => (s.id === profile.id ? profile : s)) : [...all, profile];
  await saveSearches(next);
  return NextResponse.json(profile);
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  await saveSearches((await getSearches()).filter((s) => s.id !== id));
  return NextResponse.json({ ok: true });
}
