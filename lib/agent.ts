import { z } from "zod";
import type { AgentAction, AgentElement, AgentStepInput, AgentStepResult, ExpEntry } from "./agent-types";
import { EXP_SECTION_RE, forInput, keyFor, mapFields, MAX_EXPERIENCE, pickOption, profileValue, SUBMIT_RE } from "./fieldmap";
import { generateJson } from "./gemini";
import { maskContacts, splitCv } from "./latex";
import type { Job, Profile } from "./types";

const CONFIRMED_RE = /vielen dank f(ü|ue)r (ihre|deine) bewerbung|thank you for (applying|your application)|bewerbung (wurde )?(erfolgreich )?(eingegangen|gesendet|(ü|ue)bermittelt)|application (has been |was )?(received|submitted|sent)/i;
const CAPTCHA_RE = /captcha|ich bin kein roboter|i'?m not a robot|verify you are human/i;
const EASY_APPLY_RE = /easy apply|einfach bewerben/i;

const DATE_KEYS = new Set(["birthDate", "earliestStart"]);
const DATE_HINT_RE = /datum|date|geburt|birth|eintritt|start|verf(ü|ue)gbar|available|tt\.mm|dd\/mm/i;

const PROFILE_KEYS = [
  "firstName", "lastName", "fullName", "email", "phone", "street", "zip", "city", "country", "birthDate", "nationality", "workPermit",
  "salaryExpectation", "earliestStart", "noticePeriod", "workHours", "languages", "linkedin", "github", "website",
] as const;

const LlmSchema = z.object({
  results: z.array(z.object({ id: z.string(), action: z.enum(["fill", "select", "check", "skip"]), value: z.string(), profileKey: z.string() })),
  clickId: z.string(),
});
const llmJsonSchema = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          action: { type: "string", enum: ["fill", "select", "check", "skip"] },
          value: { type: "string" },
          profileKey: { type: "string" },
        },
        required: ["id", "action", "value", "profileKey"],
      },
    },
    clickId: { type: "string" },
  },
  required: ["results", "clickId"],
};

const ExpSchema = z.object({ entries: z.array(z.object({ title: z.string(), company: z.string(), from: z.string(), to: z.string(), description: z.string() })) });
const expJsonSchema = {
  type: "object",
  properties: {
    entries: {
      type: "array",
      items: {
        type: "object",
        properties: { title: { type: "string" }, company: { type: "string" }, from: { type: "string" }, to: { type: "string" }, description: { type: "string" } },
        required: ["title", "company", "from", "to", "description"],
      },
    },
  },
  required: ["entries"],
};

// One Gemini call per CV text and server run; the agent asks for it on every step of a form with an experience section.
const expCache = new Map<string, ExpEntry[]>();
async function getExperience(cv: string): Promise<ExpEntry[]> {
  const body = splitCv(cv).body;
  const hit = expCache.get(body);
  if (hit) return hit;
  const { masked } = maskContacts(body);
  const r = await generateJson(
    `Extrahiere aus dem Lebenslauf die Berufserfahrung (Jobs, Praktika, Werkstudentenstellen; keine Ausbildung) als Liste, neueste zuerst, höchstens ${MAX_EXPERIENCE} Einträge.
Felder: title (Jobtitel), company, from und to als "MM/JJJJ" ("heute" falls laufend), description (höchstens 2 Sätze, nur Fakten aus dem Lebenslauf, Wortwahl übernehmen). Nichts erfinden, unbekannte Felder leer lassen.

LEBENSLAUF (LaTeX-Body):
${masked}`,
    expJsonSchema, ExpSchema, { temperature: 0.1, lite: true },
  );
  const entries = r.entries.slice(0, MAX_EXPERIENCE);
  expCache.set(body, entries);
  return entries;
}

const describe = (e: AgentElement) =>
  [`id=${e.id}`, `${e.kind}${e.type ? `/${e.type}` : ""}`, `label="${e.label}"`, e.required ? "Pflicht" : "", e.value ? `aktueller Wert="${e.value}"` : "", e.error ? `Seitenfehler="${e.error}" (bisheriger Wert wurde abgelehnt, liefere einen anderen)` : "", e.options?.length ? `Optionen: ${e.options.join(" | ")}` : ""].filter(Boolean).join(" ; ");

async function askGemini(
  job: Job | undefined,
  cv: string,
  profile: Profile,
  unresolved: AgentElement[],
  buttons: AgentElement[] | undefined,
  pageText: string,
) {
  const { masked } = maskContacts(splitCv(cv).body);
  const keys = PROFILE_KEYS.map((k) => `${k}: ${profileValue(profile, k) ? "gesetzt" : "leer"}`).join(", ");
  const prompt = `Du füllst ein Bewerbungsformular für einen Bewerber aus. Entscheide für jedes offene Element, was eingetragen wird.

${job ? `STELLE\nTitel: ${job.title}\nFirma: ${job.company}\nBeschreibung:\n${(job.description ?? "").slice(0, 3000)}\n` : `SEITENTEXT\n${pageText.slice(0, 3000)}\n`}
LEBENSLAUF (LaTeX-Body, Faktenquelle):
${masked}

PROFIL-SCHLÜSSEL (Werte kennst du nicht, der Server setzt sie ein): ${keys}

OFFENE ELEMENTE
${unresolved.map(describe).join("\n") || "(keine)"}
${buttons?.length ? `\nBUTTONS/LINKS (nur für "clickId")\n${buttons.map(describe).join("\n")}\n` : ""}
REGELN
- Pro offenem Element genau ein Eintrag. "fill": Text in "value" ODER Profil-Schlüssel in "profileKey" (dann value leer). "select": "value" ist exakt eine der Optionen. "check": "value" ist "true" oder "false". "skip": du weißt es nicht oder es ist eine rechtlich/persönlich sensible Frage (Diversity, Behinderung, Religion, Vorstrafen).
- Freitextantworten: Stil und Wortwahl des Lebenslaufs übernehmen, nur Fakten daraus, höchstens 4 Sätze, keine Floskeln. Nichts erfinden. Kennst du die Antwort nicht aus CV oder Stelle, "skip".
- Sprache: die der Frage.
- "clickId": nur wenn keine Formularfelder offen sind und die Seite eine Schaltfläche braucht, um zur Bewerbung zu kommen (nie ein Absenden-Button). Sonst leerer String.`;
  return generateJson(prompt, llmJsonSchema, LlmSchema, { temperature: 0.1, lite: true });
}

/** One agent step for the current page state. Standard fields are mapped locally, Gemini only sees what is left. */
export async function agentStep(
  input: AgentStepInput,
  ctx: { job?: Job; cv: string; profile: Profile; hasCover: boolean },
): Promise<AgentStepResult & { learned?: { question: string; answer: string }[] }> {
  const { profile, job, cv } = ctx;
  const text = `${input.title}\n${input.text}`;
  const learned: { question: string; answer: string }[] = [];

  if (CONFIRMED_RE.test(text)) return { status: "done", actions: [], message: "Bewerbung abgeschickt.", learned };
  if (/linkedin\.com/.test(input.url) && EASY_APPLY_RE.test(input.text) && !input.elements.some((e) => e.kind === "field")) {
    // Easy Apply is never automated; a plain external link to the company site is fine and is picked up below.
    if (!input.elements.some((e) => /firmen|company/i.test(e.label) && /bewerben|apply/i.test(e.label)))
      return { status: "blocked", actions: [], message: "LinkedIn Easy Apply wird nicht automatisiert. Bewirb dich dort selbst oder nutze die Firmenseite.", learned };
  }
  if (input.elements.some((e) => e.type === "password") || CAPTCHA_RE.test(text)) {
    return { status: "need_user", actions: [], message: "Login oder Captcha erkannt. Erledige das selbst und klicke dann auf „Erledigt, weiter“.", learned };
  }

  const actions: AgentAction[] = [];
  const done = [...(input.done ?? [])];

  // answers the user typed for an earlier question
  for (const a of input.answers ?? []) {
    const el = input.elements.find((e) => e.id === a.id);
    if (!el) continue;
    const opt = el.options?.length ? pickOption(el.options, a.value) : undefined;
    actions.push(opt ? { type: "select", id: a.id, option: opt, label: a.label } : { type: "fill", id: a.id, value: a.value, label: a.label });
    if (a.remember) learned.push({ question: a.label, answer: a.value });
  }
  const answered = new Set((input.answers ?? []).map((a) => a.id));

  const wantsExp = input.elements.some((e) => e.kind === "button" && EXP_SECTION_RE.test(e.section ?? "")) || done.some((d) => d.startsWith("exp:add:"));
  const experience = wantsExp ? await getExperience(cv).catch(() => []) : undefined;
  const m = mapFields(input.elements, profile, { done: [...done, ...answered], hasCover: ctx.hasCover, experience, attempts: input.attempts, pageText: input.text });
  actions.push(...m.actions);
  let unresolved = m.unresolved;
  const repair = m.repair;

  let clickId: string | undefined;
  const needNav = !m.hasForm && !m.entryId && !m.nextId;
  if (unresolved.length || repair.length || needNav) {
    // Fields without any label would be guessed blindly, and fields whose profile key is known but empty need the user, not a guess.
    const blind = unresolved.filter((e) => !e.label?.trim() || keyFor(e));
    const askable = [...unresolved.filter((e) => !blind.includes(e)), ...repair];
    const buttons = needNav ? input.elements.filter((e) => (e.kind === "button" || e.kind === "link") && !SUBMIT_RE.test(e.label)).slice(0, 40) : undefined;
    const still: AgentElement[] = [...blind];
    if (askable.length || needNav) {
      const r = await askGemini(job, cv, profile, askable, buttons, input.text);
      for (const e of askable) {
        const x = r.results.find((y) => y.id === e.id);
        const label = e.label || e.name || e.id;
        if (!x || x.action === "skip") { still.push(e); continue; }
        if (x.action === "check") { actions.push({ type: "check", id: e.id, checked: x.value === "true", label }); continue; }
        if (x.action === "select") {
          const opt = pickOption(e.options, x.value);
          if (opt) actions.push({ type: "select", id: e.id, option: opt, label });
          else still.push(e);
          continue;
        }
        const key = x.profileKey && (PROFILE_KEYS as readonly string[]).includes(x.profileKey) ? (x.profileKey as (typeof PROFILE_KEYS)[number]) : undefined;
        // a date from the profile only goes into something that looks like a date field
        if (key && DATE_KEYS.has(key) && e.type !== "date" && !DATE_HINT_RE.test(`${e.label} ${e.name ?? ""} ${e.placeholder ?? ""}`)) { still.push(e); continue; }
        const fromProfile = key ? forInput(e, profileValue(profile, key)) : "";
        const value = fromProfile || x.value.trim();
        if (value) actions.push({ type: "fill", id: e.id, value, label, generated: !fromProfile });
        else still.push(e);
      }
      if (r.clickId && input.elements.some((e) => e.id === r.clickId)) clickId = r.clickId;
    }
    unresolved = still;
  }

  if (actions.length) return { status: "continue", actions, learned };

  // Only required fields we could not fill ask the user; optional free-text questions are simply skipped.
  const blocking = unresolved.find((e) => e.required || e.invalid);
  if (blocking) {
    const label = blocking.label || blocking.placeholder || blocking.name || blocking.type || blocking.id;
    return { status: "ask", actions: [], question: { id: blocking.id, label: blocking.error ? `${label} (Seite meldet: ${blocking.error})` : label, options: blocking.options }, learned };
  }
  if (m.hasForm) {
    // "Weiter" may be clicked again when the page did not move on (the fields are repaired in between); at most 3 times per page state
    const sig = `next:${input.url}|${input.elements.filter((e) => e.kind === "field" || e.kind === "file").map((e) => e.label).join("|")}`;
    if (m.nextId && done.filter((d) => d === sig).length < 3) return { status: "continue", actions: [{ type: "click", id: m.nextId, label: "Weiter", mark: sig }], learned };
    if (m.submitId) return { status: "ready_to_submit", actions: [], submitId: m.submitId, learned };
    return { status: "need_user", actions: [], message: "Kein Absenden-Button gefunden. Prüfe die Seite und mach selbst weiter.", learned };
  }
  const entry = m.entryId ?? clickId;
  if (entry && !done.includes(entry)) return { status: "continue", actions: [{ type: "click", id: entry, label: "Zur Bewerbung" }], learned };
  return { status: "need_user", actions: [], message: "Ich finde auf dieser Seite keinen Weg zum Bewerbungsformular.", learned };
}
