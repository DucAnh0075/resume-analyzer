import { NextResponse } from "next/server";
import type { AgentStepInput } from "@/lib/agent-types";
import { agentStep } from "@/lib/agent";
import { getCv, getJob, getProfile, saveProfile } from "@/lib/store";
import { readOutput } from "@/lib/output";

export const maxDuration = 120;

export async function POST(req: Request) {
  const input = (await req.json()) as AgentStepInput;
  try {
    const [cv, profile, job] = await Promise.all([getCv(), getProfile(), input.jobId ? getJob(input.jobId) : undefined]);
    if (!cv) return NextResponse.json({ status: "blocked", actions: [], message: "Zuerst unter „Mein CV“ den LaTeX-Lebenslauf speichern." });
    const hasCover = !!(input.jobId && (await readOutput(input.jobId, "cover.pdf")));
    const { learned, ...result } = await agentStep(input, { job, cv, profile, hasCover });
    if (learned?.length) await saveProfile({ ...profile, answers: [...profile.answers, ...learned] });
    return NextResponse.json(result);
  } catch (e) {
    const msg = (e as Error).message;
    const limited = /429|RESOURCE_EXHAUSTED|quota/i.test(msg);
    return NextResponse.json({
      status: "blocked",
      actions: [],
      message: limited ? "Gemini-Tageslimit oder Rate-Limit erreicht. Versuche es später oder morgen erneut." : msg,
    });
  }
}
