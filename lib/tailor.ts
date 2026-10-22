import { createTwoFilesPatch } from "diff";
import { z } from "zod";
import { generateJson } from "./gemini";
import { compileLatex, maskContacts, sanitizeBody, splitCv, unmaskContacts, validateBody } from "./latex";
import { repairPrompt, tailorPrompt } from "./prompts";
import type { Change, Job } from "./types";

const TailorSchema = z.object({
  body: z.string(),
  changes: z.array(z.object({ section: z.string(), type: z.enum(["rewritten", "added", "reordered"]), text: z.string() })),
  keywordsUsed: z.array(z.string()),
});

const tailorJsonSchema = {
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
    keywordsUsed: { type: "array", items: { type: "string" } },
  },
  required: ["body", "changes", "keywordsUsed"],
};

const RepairSchema = z.object({ body: z.string() });
const repairJsonSchema = { type: "object", properties: { body: { type: "string" } }, required: ["body"] };

export interface TailorOutput {
  tex: string;
  pdf: Buffer;
  changes: Change[];
  keywordsUsed: string[];
  diff: string;
}

export async function tailorCv(
  cvTex: string,
  job: Pick<Job, "title" | "company" | "location" | "description">,
  opts: { adoptLanguage: boolean; aggressive: boolean },
): Promise<TailorOutput> {
  const { preamble, body } = splitCv(cvTex);
  const { masked, map } = maskContacts(body);

  const result = await generateJson(
    tailorPrompt({ job: { ...job, description: job.description ?? "" }, body: masked, ...opts }),
    tailorJsonSchema,
    TailorSchema,
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

  const tex = preamble + newBody;
  return {
    tex,
    pdf: compiled.pdf,
    changes: result.changes,
    keywordsUsed: result.keywordsUsed,
    diff: createTwoFilesPatch("original.tex", "angepasst.tex", cvTex, tex, "", "", { context: 2 }),
  };
}
