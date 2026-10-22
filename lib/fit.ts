import { z } from "zod";
import { generateJson } from "./gemini";
import { maskContacts, splitCv } from "./latex";
import type { Job, JobFit } from "./types";

const FitSchema = z.object({
  score: z.number().min(0).max(100),
  verdict: z.string(),
  pros: z.array(z.object({ title: z.string(), detail: z.string() })),
  cons: z.array(
    z.object({ title: z.string(), detail: z.string(), severity: z.enum(["dealbreaker", "gap", "minor"]) }),
  ),
});

const point = { title: { type: "string" }, detail: { type: "string" } };
const fitJsonSchema = {
  type: "object",
  properties: {
    score: { type: "integer" },
    verdict: { type: "string" },
    pros: { type: "array", items: { type: "object", properties: point, required: ["title", "detail"] } },
    cons: {
      type: "array",
      items: {
        type: "object",
        properties: { ...point, severity: { type: "string", enum: ["dealbreaker", "gap", "minor"] } },
        required: ["title", "detail", "severity"],
      },
    },
  },
  required: ["score", "verdict", "pros", "cons"],
};

export async function analyzeFit(
  cvTex: string,
  job: Pick<Job, "title" | "company" | "location" | "description">,
  lang: "de" | "en",
): Promise<JobFit> {
  const { masked } = maskContacts(splitCv(cvTex).body);
  const language = lang === "de" ? "Deutsch" : "English";
  const prompt = `Du bewertest, wie gut ein Bewerber auf eine Stelle passt. Sei ehrlich und konkret, nicht schmeichelhaft.

STELLE
Titel: ${job.title}
Firma: ${job.company}
Ort: ${job.location}
Beschreibung:
${job.description ?? ""}

LEBENSLAUF (LaTeX-Body):
${masked}

AUFGABE
- "score": 0-100, wie wahrscheinlich der Bewerber mit diesem CV in die engere Auswahl kommt (Muss-Anforderungen zählen stärker als Kann-Anforderungen).
- "verdict": ein Satz als Fazit.
- "pros": 3-6 Gründe, die für den Bewerber sprechen. Jeder mit kurzem "title" und "detail", das die Anforderung der Stelle mit einer konkreten Stelle im CV belegt.
- "cons": 2-6 Schwächen oder Lücken. "severity": "dealbreaker" (Muss-Kriterium fehlt, z. B. Abschluss, Sprache, Aufenthaltstitel, Jahre Erfahrung), "gap" (wichtige Anforderung nur teilweise erfüllt) oder "minor". Das "detail" nennt, wie sich die Lücke im CV oder Anschreiben abmildern lässt, ohne etwas zu erfinden.
- Antworte vollständig auf ${language}.`;

  const r = await generateJson(prompt, fitJsonSchema, FitSchema);
  return { ...r, score: Math.round(r.score), analyzedAt: new Date().toISOString() };
}
