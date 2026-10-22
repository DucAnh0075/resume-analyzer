import { getApplications, getJobs, saveApplications } from "./store";
import type { AppStage, Application, Job } from "./types";

export { STAGES } from "./sankey";

const now = () => new Date().toISOString();

function fromJob(job: Job): Application {
  const at = now();
  return {
    id: `job-${job.id}`,
    jobId: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    url: job.url,
    appliedAt: at,
    stage: "beworben",
    history: [{ stage: "beworben", at }],
  };
}

/** Idempotent: one application per job id. */
export async function ensureApplications(jobs: Job[]) {
  const apps = await getApplications();
  let changed = false;
  for (const j of jobs) {
    const id = `job-${j.id}`;
    if (!apps[id]) {
      apps[id] = fromJob(j);
      changed = true;
    }
  }
  if (changed) await saveApplications(apps);
  return apps;
}

/** Backfills applications for every job already marked "beworben". */
export async function syncApplications() {
  const jobs = Object.values(await getJobs()).filter((j) => j.status === "beworben");
  return ensureApplications(jobs);
}

export function newApplication(a: Pick<Application, "title" | "company"> & Partial<Application>): Application {
  const at = a.appliedAt || now();
  const stage = a.stage ?? "beworben";
  const history = [{ stage: "beworben" as AppStage, at }];
  if (stage !== "beworben") history.push({ stage, at: now() });
  return { id: `ext-${Date.now()}`, title: a.title, company: a.company, location: a.location, url: a.url, notes: a.notes, appliedAt: at, stage, history };
}

export function applyStage(app: Application, stage: AppStage): Application {
  if (app.stage === stage) return app;
  return { ...app, stage, history: [...app.history, { stage, at: now() }] };
}
