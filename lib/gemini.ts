import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function client() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY fehlt. Kostenlosen Key auf aistudio.google.com holen und in .env.local eintragen.");
  return new GoogleGenAI({ apiKey });
}

/** One structured-output call with retry/backoff for rate limits (free tier). */
export async function generateJson<T>(
  prompt: string,
  jsonSchema: Record<string, unknown>,
  parser: z.ZodType<T>,
  opts: { temperature?: number; lite?: boolean } = {},
): Promise<T> {
  const ai = client();
  // Free-tier quotas are per model, so cheap classification work runs on a separate lite model.
  const mainModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  let model = opts.lite ? process.env.GEMINI_MODEL_LITE || "gemini-3.5-flash-lite" : mainModel;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", responseJsonSchema: jsonSchema, temperature: opts.temperature ?? 0.7 },
      });
      return parser.parse(JSON.parse(res.text ?? ""));
    } catch (e) {
      lastErr = e;
      const msg = String((e as Error)?.message ?? e);
      // Google retires models for new users; a retired lite model must not break the app.
      if (model !== mainModel && /NOT_FOUND|no longer available/i.test(msg)) {
        model = mainModel;
        continue;
      }
      const retryable = /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded/i.test(msg);
      if (!retryable && !(e instanceof SyntaxError) && !(e instanceof z.ZodError)) throw e;
      await sleep(2000 * 2 ** attempt);
    }
  }
  throw lastErr;
}
