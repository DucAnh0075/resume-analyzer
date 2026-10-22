import { z } from "zod";
import { generateJson } from "./gemini";
import type { Job } from "./types";

const FilterSchema = z.object({
  results: z.array(z.object({ id: z.string(), keep: z.boolean(), reason: z.string() })),
});

const filterJsonSchema = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: { id: { type: "string" }, keep: { type: "boolean" }, reason: { type: "string" } },
        required: ["id", "keep", "reason"],
      },
    },
  },
  required: ["results"],
};

const BATCH = 40;

export type FilterVerdict = { keep: boolean; reason: string };

/** Classifies jobs by title/company/location only (no description fetch), one Gemini call per 40 jobs. */
export async function aiFilterJobs(
  jobs: Pick<Job, "id" | "title" | "company" | "location" | "criteria">[],
  criteria: string,
): Promise<Map<string, FilterVerdict>> {
  const out = new Map<string, FilterVerdict>();
  for (let i = 0; i < jobs.length; i += BATCH) {
    const chunk = jobs.slice(i, i + BATCH);
    const list = chunk
      .map((j) => [j.id, j.title, j.company, j.location, Object.values(j.criteria ?? {}).join(", ")].join(" | "))
      .join("\n");
    const prompt = `Du sortierst Stellenanzeigen für einen Bewerber vor. Entscheide pro Stelle anhand von Titel, Firma, Ort und Kriterien, ob sie zu seinen Vorgaben passt.

VORGABEN DES BEWERBERS
${criteria.trim()}

STELLEN (id | Titel | Firma | Ort | Kriterien)
${list}

REGELN
- "keep": false nur, wenn die Stelle klar nicht zu den Vorgaben passt. Im Zweifel true.
- "reason": ein kurzer Satz auf Deutsch, warum.
- Gib für jede id genau ein Ergebnis zurück, ids unverändert übernehmen.`;
    const r = await generateJson(prompt, filterJsonSchema, FilterSchema, { temperature: 0.1 });
    for (const x of r.results) out.set(x.id, { keep: x.keep, reason: x.reason });
  }
  return out;
}
