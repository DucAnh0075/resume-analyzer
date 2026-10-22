import { NextResponse } from "next/server";
import { extractJobId, fetchJobDetail } from "@/lib/linkedin";
import { saveOutput } from "@/lib/output";
import { getCv, getJob, upsertJob } from "@/lib/store";
import { tailorCv } from "@/lib/tailor";
import type { Job, TailorResult } from "@/lib/types";

export const maxDuration = 300;

interface Body {
  jobId?: string;
  url?: string;
  text?: string;
  title?: string;
  company?: string;
  adoptLanguage?: boolean;
  aggressive?: boolean;
}

export async function POST(req: Request) {
  const b = (await req.json()) as Body;
  try {
    const cv = await getCv();
    if (!cv) return NextResponse.json({ error: "Zuerst unter „Mein CV“ den LaTeX-Lebenslauf speichern." }, { status: 400 });

    let job: Job | undefined = b.jobId ? await getJob(b.jobId) : undefined;
    if (!job) {
      // manual entry: LinkedIn URL / id, or pasted text
      const id = (b.url && extractJobId(b.url)) || String(Date.now());
      job = (await getJob(id)) ?? {
        id,
        title: b.title || "Manuelle Stelle",
        company: b.company || "",
        location: "",
        url: b.url || "",
        status: "angesehen",
        foundAt: new Date().toISOString(),
      };
      if (b.text?.trim()) job.description = b.text.trim();
      else if (!job.description) {
        const d = await fetchJobDetail(id);
        job = { ...job, ...d };
      }
      job = await upsertJob(job);
    } else if (!job.description) {
      job = await upsertJob({ ...job, ...(await fetchJobDetail(job.id)) });
    }

    const out = await tailorCv(cv, { title: job.title, company: job.company, location: job.location, description: job.description! }, {
      adoptLanguage: !!b.adoptLanguage,
      aggressive: b.aggressive !== false,
    });
    const result: TailorResult = { changes: out.changes, keywordsUsed: out.keywordsUsed, texDiff: out.diff, tailoredAt: new Date().toISOString() };
    await saveOutput(job.id, out.tex, out.pdf, result);
    job = await upsertJob({ ...job, tailored: true });
    return NextResponse.json({ job, result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
