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
): Promise<T> {
  const ai = client();
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", responseJsonSchema: jsonSchema, temperature: 0.7 },
      });
      return parser.parse(JSON.parse(res.text ?? ""));
    } catch (e) {
      lastErr = e;
      const msg = String((e as Error)?.message ?? e);
      const retryable = /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|overloaded/i.test(msg);
      if (!retryable && !(e instanceof SyntaxError) && !(e instanceof z.ZodError)) throw e;
      await sleep(2000 * 2 ** attempt);
    }
  }
  throw lastErr;
}
