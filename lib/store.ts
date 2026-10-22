import { promises as fs } from "fs";
import path from "path";
import type { Application, Job, SearchProfile } from "./types";

const DATA = path.join(process.cwd(), "data");

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA, file), "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown) {
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(path.join(DATA, file), JSON.stringify(value, null, 2));
}

export const getSearches = () => readJson<SearchProfile[]>("searches.json", []);
export const saveSearches = (s: SearchProfile[]) => writeJson("searches.json", s);

export const getJobs = () => readJson<Record<string, Job>>("jobs.json", {});
export const saveJobs = (j: Record<string, Job>) => writeJson("jobs.json", j);

export async function getJob(id: string) {
  return (await getJobs())[id];
}

export async function upsertJob(job: Job) {
  const jobs = await getJobs();
  jobs[job.id] = { ...jobs[job.id], ...job };
  await saveJobs(jobs);
  return jobs[job.id];
}

export async function getCv(): Promise<string> {
  try {
    return await fs.readFile(path.join(DATA, "cv.tex"), "utf8");
  } catch {
    return "";
  }
}

export async function saveCv(tex: string) {
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(path.join(DATA, "cv.tex"), tex);
}

export async function getCover(): Promise<string> {
  try {
    return await fs.readFile(path.join(DATA, "cover.tex"), "utf8");
  } catch {
    return "";
  }
}

export async function saveCover(tex: string) {
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(path.join(DATA, "cover.tex"), tex);
}

export const getApplications = () => readJson<Record<string, Application>>("applications.json", {});
export const saveApplications = (a: Record<string, Application>) => writeJson("applications.json", a);
