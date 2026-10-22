import { NextResponse } from "next/server";
import { z } from "zod";
import { generateJson } from "@/lib/gemini";
import { EMAIL, maskContacts, PHONE, splitCv } from "@/lib/latex";
import { EMPTY_PROFILE, getCv, getProfile } from "@/lib/store";

const Schema = z.object({
  firstName: z.string(), lastName: z.string(), street: z.string(), zip: z.string(), city: z.string(),
  country: z.string(), nationality: z.string(), languages: z.string(), linkedin: z.string(), github: z.string(), website: z.string(),
});
const str = { type: "string" };
const jsonSchema = {
  type: "object",
  properties: Object.fromEntries(Object.keys(Schema.shape).map((k) => [k, str])),
  required: Object.keys(Schema.shape),
};

/** Prefills the profile from the CV. E-mail and phone come from a local regex, never from Gemini. */
export async function POST() {
  try {
    const cv = await getCv();
    if (!cv) return NextResponse.json({ error: "Zuerst unter „Mein CV“ den LaTeX-Lebenslauf speichern." }, { status: 400 });
    const preambleAndBody = cv;
    const { masked } = maskContacts(splitCv(cv).body);
    const r = await generateJson(
      `Lies den Lebenslauf (LaTeX) und extrahiere Stammdaten für Bewerbungsformulare. Gib für unbekannte Felder einen leeren String zurück, erfinde nichts. "languages": Sprachen mit Niveau in einem kurzen Text. E-Mail und Telefon sind als CONTACT_* maskiert, ignoriere sie.\n\n${masked}`,
      jsonSchema,
      Schema,
      { temperature: 0, lite: true },
    );
    const email = preambleAndBody.match(new RegExp(EMAIL.source))?.[0] ?? "";
    const phone = preambleAndBody.match(new RegExp(PHONE.source))?.[0]?.trim() ?? "";
    const current = await getProfile();
    // Only fill what is still empty so manual edits are never overwritten.
    const merged = { ...current };
    for (const [k, v] of Object.entries({ ...r, email, phone })) {
      const key = k as keyof typeof EMPTY_PROFILE;
      if (typeof v === "string" && v && !current[key]) (merged as Record<string, unknown>)[key] = v;
    }
    return NextResponse.json(merged);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
