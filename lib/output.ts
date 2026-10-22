import { promises as fs } from "fs";
import path from "path";
import type { CoverResult, TailorResult } from "./types";

const dir = (jobId: string) => path.join(process.cwd(), "output", jobId.replace(/\D/g, ""));

export async function saveOutput(jobId: string, tex: string, pdf: Buffer, result: TailorResult) {
  const d = dir(jobId);
  await fs.mkdir(d, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(d, "cv.tex"), tex),
    fs.writeFile(path.join(d, "cv.pdf"), pdf),
    fs.writeFile(path.join(d, "result.json"), JSON.stringify(result, null, 2)),
  ]);
}

export async function readOutput(jobId: string, file: "cv.tex" | "cv.pdf" | "result.json" | "cover.tex" | "cover.pdf" | "cover.json") {
  try {
    return await fs.readFile(path.join(dir(jobId), file));
  } catch {
    return null;
  }
}

export async function saveCoverOutput(jobId: string, tex: string, pdf: Buffer, result: CoverResult) {
  const d = dir(jobId);
  await fs.mkdir(d, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(d, "cover.tex"), tex),
    fs.writeFile(path.join(d, "cover.pdf"), pdf),
    fs.writeFile(path.join(d, "cover.json"), JSON.stringify(result, null, 2)),
  ]);
}
