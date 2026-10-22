import { z } from "zod";
import { generateJson } from "./gemini";
import { compileLatex, maskContacts, sanitizeBody, splitCv, unmaskContacts, validateBody } from "./latex";
import { coverPrompt, repairPrompt } from "./prompts";
import type { Change, Job } from "./types";

const CoverSchema = z.object({
  body: z.string(),
  changes: z.array(z.object({ section: z.string(), type: z.enum(["rewritten", "added", "reordered"]), text: z.string() })),
});

const coverJsonSchema = {
  type: "object",
  properties: {
    body: { type: "string" },
    changes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          section: { type: "string" },
          type: { type: "string", enum: ["rewritten", "added", "reordered"] },
          text: { type: "string" },
        },
        required: ["section", "type", "text"],
      },
    },
  },
  required: ["body", "changes"],
};

const RepairSchema = z.object({ body: z.string() });
const repairJsonSchema = { type: "object", properties: { body: { type: "string" } }, required: ["body"] };

export interface CoverOutput {
  tex: string;
  pdf: Buffer;
  changes: Change[];
}

export async function tailorCover(
  coverTex: string,
  cvTex: string,
  job: Pick<Job, "title" | "company" | "location" | "description">,
  opts: { adoptLanguage: boolean; hints?: string },
): Promise<CoverOutput> {
  const { preamble, body } = splitCv(coverTex);
  const { masked, map } = maskContacts(body);
  const cvMasked = maskContacts(splitCv(cvTex).body).masked;

  const result = await generateJson(
    coverPrompt({ job: { ...job, description: job.description ?? "" }, cover: masked, cv: cvMasked, ...opts }),
    coverJsonSchema,
    CoverSchema,
    { temperature: 0.3 },
  );

  let newBody = sanitizeBody(unmaskContacts(result.body, map));
  validateBody(newBody);
  let compiled = await compileLatex(preamble + newBody);

  if (!compiled.ok) {
    const fixed = await generateJson(repairPrompt(maskContacts(newBody).masked, compiled.log), repairJsonSchema, RepairSchema);
    newBody = sanitizeBody(unmaskContacts(fixed.body, map));
    validateBody(newBody);
    compiled = await compileLatex(preamble + newBody);
    if (!compiled.ok) throw new Error(`LaTeX-Kompilierung fehlgeschlagen:\n${compiled.log}`);
  }

  return { tex: preamble + newBody, pdf: compiled.pdf, changes: result.changes };
}
