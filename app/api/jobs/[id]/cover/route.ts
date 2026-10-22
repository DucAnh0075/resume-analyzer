import { NextResponse } from "next/server";
import { tailorCover } from "@/lib/cover";
import { fetchJobDetail } from "@/lib/linkedin";
import { compileLatex, sanitizeBody, splitCv, validateBody } from "@/lib/latex";
import { readOutput, saveCoverOutput } from "@/lib/output";
import { getCover, getCv, getJob, upsertJob } from "@/lib/store";
import type { CoverResult } from "@/lib/types";

export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  const [tex, json] = await Promise.all([readOutput(id, "cover.tex"), readOutput(id, "cover.json")]);
  return NextResponse.json({ tex: tex?.toString() ?? "", result: json ? (JSON.parse(json.toString()) as CoverResult) : null });
}

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { adoptLanguage, hints } = (await req.json().catch(() => ({}))) as { adoptLanguage?: boolean; hints?: string };
  try {
    let job = await getJob(id);
    if (!job) return NextResponse.json({ error: "Job nicht gefunden" }, { status: 404 });
    const [cv, cover] = await Promise.all([getCv(), getCover()]);
    if (!cover) return NextResponse.json({ error: "Zuerst unter „Mein Anschreiben“ ein Basis-Anschreiben speichern." }, { status: 400 });
    if (!cv) return NextResponse.json({ error: "Zuerst unter „Mein CV“ den LaTeX-Lebenslauf speichern." }, { status: 400 });
    if (!job.description) job = await upsertJob({ ...job, ...(await fetchJobDetail(id)) });

    const out = await tailorCover(cover, cv, { title: job.title, company: job.company, location: job.location, description: job.description! }, { adoptLanguage: !!adoptLanguage, hints });
    const result: CoverResult = { changes: out.changes, hints: hints?.trim() || undefined, coverAt: new Date().toISOString() };
    await saveCoverOutput(id, out.tex, out.pdf, result);
    await upsertJob({ ...job, cover: true });
    return NextResponse.json({ tex: out.tex, result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Saves a hand-edited cover letter for this job and recompiles it. */
export async function PUT(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { tex } = (await req.json()) as { tex: string };
  try {
    const job = await getJob(id);
    if (!job) return NextResponse.json({ error: "Job nicht gefunden" }, { status: 404 });
    const { preamble, body } = splitCv(tex);
    const clean = sanitizeBody(body);
    validateBody(clean);
    const full = preamble + clean;
    const compiled = await compileLatex(full);
    if (!compiled.ok) return NextResponse.json({ error: compiled.log }, { status: 422 });
    const prev = await readOutput(id, "cover.json");
    const old = prev ? (JSON.parse(prev.toString()) as CoverResult) : { changes: [], coverAt: new Date().toISOString() };
    const result: CoverResult = { ...old, edited: true };
    await saveCoverOutput(id, full, compiled.pdf, result);
    await upsertJob({ ...job, cover: true });
    return NextResponse.json({ tex: full, result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
