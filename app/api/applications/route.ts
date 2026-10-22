import { NextResponse } from "next/server";
import { newApplication, syncApplications } from "@/lib/applications";
import { getApplications, saveApplications } from "@/lib/store";
import type { Application } from "@/lib/types";

export async function GET() {
  const apps = await syncApplications();
  return NextResponse.json(Object.values(apps).sort((a, b) => b.appliedAt.localeCompare(a.appliedAt)));
}

export async function POST(req: Request) {
  const b = (await req.json()) as Partial<Application>;
  if (!b.title?.trim() || !b.company?.trim()) return NextResponse.json({ error: "Firma und Titel sind Pflicht." }, { status: 400 });
  const app = newApplication({ ...b, title: b.title.trim(), company: b.company.trim(), appliedAt: b.appliedAt ? new Date(b.appliedAt).toISOString() : undefined });
  const apps = await getApplications();
  apps[app.id] = app;
  await saveApplications(apps);
  return NextResponse.json(app);
}
