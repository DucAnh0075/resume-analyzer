import { execFile } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";

const run = promisify(execFile);

export interface SplitCv {
  preamble: string;
  body: string;
}

export function splitCv(tex: string): SplitCv {
  const i = tex.indexOf("\\begin{document}");
  if (i < 0) throw new Error("Im CV fehlt \\begin{document}.");
  return { preamble: tex.slice(0, i), body: tex.slice(i) };
}

export const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
export const PHONE = /(?:\+\d|\b0\d)[\d\s()/.-]{7,}\d/g;

/** Replaces e-mails and phone numbers with placeholders so they are not sent to the API. */
export function maskContacts(text: string) {
  const map = new Map<string, string>();
  let n = 0;
  const swap = (kind: string) => (m: string) => {
    const ph = `CONTACT_${kind}_${++n}`;
    map.set(ph, m);
    return ph;
  };
  const masked = text.replace(EMAIL, swap("EMAIL")).replace(PHONE, swap("PHONE"));
  return { masked, map };
}

export function unmaskContacts(text: string, map: Map<string, string>) {
  let out = text;
  for (const [ph, original] of map) out = out.split(ph).join(original);
  return out;
}

/**
 * Models often forget to escape plain-text characters (C#, 50%). Fix the two that break
 * compilation or silently truncate a line. `#` followed by a digit is a macro parameter and stays.
 */
export function sanitizeBody(body: string) {
  return body.replace(/(?<!\\)#(?!\d)/g, "\\#").replace(/(?<=\d)(?<!\\)%/g, "\\%");
}

export function validateBody(body: string) {
  const b = body.trim();
  if (!b.startsWith("\\begin{document}") || !b.endsWith("\\end{document}")) {
    throw new Error("Body muss mit \\begin{document} beginnen und mit \\end{document} enden.");
  }
  if (/\\documentclass|\\usepackage/.test(b)) throw new Error("Body darf keine Preamble-Befehle enthalten.");
}

export type CompileResult = { ok: true; pdf: Buffer } | { ok: false; log: string };

export async function compileLatex(tex: string): Promise<CompileResult> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "cv-"));
  try {
    await fs.writeFile(path.join(dir, "cv.tex"), tex);
    try {
      await run("latexmk", ["-pdf", "-interaction=nonstopmode", "-halt-on-error", "-no-shell-escape", "cv.tex"], {
        cwd: dir,
        timeout: 90_000,
      });
    } catch (e) {
      const log = await fs.readFile(path.join(dir, "cv.log"), "utf8").catch(() => String(e));
      return { ok: false, log: errorExcerpt(log) };
    }
    return { ok: true, pdf: await fs.readFile(path.join(dir, "cv.pdf")) };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function errorExcerpt(log: string) {
  const lines = log.split("\n");
  const idx = lines.findIndex((l) => l.startsWith("!"));
  return (idx >= 0 ? lines.slice(idx, idx + 8) : lines.slice(-15)).join("\n");
}
