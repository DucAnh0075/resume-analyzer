import type { AgentAction, AgentElement, ExpEntry } from "./agent-types";
import type { Profile } from "./types";

/** Deterministic form-field mapping. Pure, no network: every standard field that matches here costs no Gemini call. */

export const SUBMIT_RE = /absenden|abschicken|\bsenden\b|submit|einreichen|send application|apply and submit|bewerbung (jetzt )?(ab)?senden/i;
export const NEXT_RE = /^\s*(weiter|next|continue|nächste|fortfahren|save and continue|speichern und weiter)\b/i;
export const APPLY_ENTRY_RE = /jetzt bewerben|apply now|apply for this|zur bewerbung|bewerben|apply|auf (der )?firmen(web)?seite bewerben|apply on company/i;
const MARKETING_RE = /newsletter|talent.?pool|job.?alert|marketing|werbung|benachrichtig/i;
/** Used when the profile city has no autocomplete suggestion on the page. */
export const CITY_FALLBACK = ["Hamburg"];
export const EXP_SECTION_RE = /berufserfahrung|work experience|experience|werdegang/i;
const ADD_RE = /^\+?\s*(hinzuf(ü|ue)gen|add)\b/i;
const EXP_SAVE_RE = /^\s*(speichern|save|(ü|ue)bernehmen|fertig|done)\s*$/i;
const EXP_MATCHERS: [keyof ExpEntry, RegExp][] = [
  ["title", /job.?titel|job.?title|position|berufsbezeichnung|stellenbezeichnung|\btitel\b|\btitle\b/],
  ["company", /firma|unternehmen|arbeitgeber|company|employer|organi[sz]ation/],
  ["from", /^(von|from|beginn|start(datum| date)?)\b/],
  ["to", /^(bis|to|ende|end(datum| date)?)\b/],
  ["description", /beschreibung|description|aufgaben|t(ä|ae)tigkeit/],
];
export const MAX_EXPERIENCE = 3;
const PARSER_RE = /einfach bewerben|automatisch(en)? ausf(ü|ue)ll|autofill|auto-fill|parse/;
const CONSENT_RE = /datenschutz|privacy|einwillig|consent|agb|terms|zustimm|akzeptier|bestätig|agree|gelesen/i;

type TextKey = Exclude<keyof Profile, "answers"> | "fullName";

const AUTOCOMPLETE: Record<string, TextKey> = {
  "given-name": "firstName", "family-name": "lastName", email: "email", tel: "phone", "tel-national": "phone",
  "postal-code": "zip", "address-level2": "city", "street-address": "street", "address-line1": "street",
  "country-name": "country", country: "country", name: "fullName", bday: "birthDate",
};

const MATCHERS: [TextKey, RegExp][] = [
  ["firstName", /vorname|first.?name|given.?name|rufname/],
  ["lastName", /nachname|last.?name|family.?name|surname|familienname/],
  ["fullName", /^(full.?name|vollst(ä|ae)ndiger name|name|ihr name|your name)\*?$/],
  ["email", /e-?mail/],
  ["phone", /telefon|phone|mobil|handy|\btel\b/],
  ["zip", /\bplz\b|postleitzahl|zip|postal/],
  ["street", /stra(ß|ss)e|street|adresse|address/],
  ["city", /\bort\b|stadt|city|town|wohnort/],
  ["country", /\bland\b|country/],
  ["linkedin", /linkedin/],
  ["github", /github/],
  ["website", /website|webseite|portfolio|homepage/],
  ["salaryExpectation", /gehalt|salary|verg(ü|ue)tung|compensation/],
  ["earliestStart", /eintritt|startdatum|start date|earliest|verf(ü|ue)gbar ab|available (from|as of)/],
  ["noticePeriod", /k(ü|ue)ndigungsfrist|notice/],
  ["birthDate", /geburtsdatum|date of birth|birth/],
  ["nationality", /staatsangeh|nationalit/],
  ["workPermit", /arbeitserlaubnis|work permit|work authori[sz]ation|aufenthalt/],
];

const hay = (e: AgentElement) => `${e.autocomplete ?? ""} ${e.name ?? ""} ${e.label} ${e.placeholder ?? ""}`.toLowerCase().replace(/\s+/g, " ").trim();

export function profileValue(p: Profile, key: TextKey): string {
  if (key === "fullName") return `${p.firstName} ${p.lastName}`.trim();
  return ((p[key] as string | undefined) ?? "").trim();
}

/** <input type="date"> only accepts YYYY-MM-DD; the profile holds what the user typed (usually 31.12.1999). */
export function forInput(e: AgentElement, v: string): string {
  if (e.type !== "date") return v;
  const m = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : v;
}

export function keyFor(e: AgentElement): TextKey | undefined {
  const ac = e.autocomplete?.split(/\s+/).pop()?.toLowerCase();
  if (ac && AUTOCOMPLETE[ac]) return AUTOCOMPLETE[ac];
  if (e.type === "email") return "email";
  if (e.type === "tel") return "phone";
  const h = hay(e);
  for (const [k, re] of MATCHERS) if (re.test(h)) return k;
}

const tokens = (s: string) => new Set(s.toLowerCase().match(/[a-zäöüß0-9]{3,}/g) ?? []);

export function similar(a: string, b: string) {
  const x = tokens(a), y = tokens(b);
  if (!x.size || !y.size) return 0;
  const inter = [...x].filter((t) => y.has(t)).length;
  return inter / (x.size + y.size - inter);
}

export function pickOption(options: string[] | undefined, wanted: string): string | undefined {
  if (!options?.length || !wanted) return;
  const w = wanted.toLowerCase();
  return options.find((o) => o.toLowerCase() === w) ?? options.find((o) => o.toLowerCase().includes(w) || w.includes(o.toLowerCase()));
}

export interface MapResult {
  actions: AgentAction[];
  /** fields neither the profile nor learned answers could fill */
  unresolved: AgentElement[];
  /** invalid fields where the simple strategies failed twice: Gemini gets the error text and proposes a fix */
  repair: AgentElement[];
  nextId?: string;
  submitId?: string;
  entryId?: string;
  hasForm: boolean;
}

export function mapFields(elements: AgentElement[], profile: Profile, opts: { done?: string[]; hasCover?: boolean; experience?: ExpEntry[]; attempts?: Record<string, number>; pageText?: string }): MapResult {
  const done = new Set(opts.done ?? []);
  const actions: AgentAction[] = [];
  const unresolved: AgentElement[] = [];
  const repair: AgentElement[] = [];
  const fields = elements.filter((e) => e.kind === "field" || e.kind === "file");
  const hasForm = fields.length > 0;
  const uploaded = new Set([...done].filter((d) => d.startsWith("doc:")));
  // "Berufserfahrung": one dialog per CV entry. add > saved means a dialog is open and its fields get this entry's values.
  const nAdded = [...done].filter((d) => d.startsWith("exp:add:")).length;
  const nSaved = [...done].filter((d) => d.startsWith("exp:saved:")).length;
  const exp = nAdded > nSaved ? opts.experience?.[nAdded - 1] : undefined;
  let expFilled = false;

  // A single unlabeled upload on a page that talks about the CV is the CV (labels of dropzones are often just "Datei auswählen").
  const CV_RE = /lebenslauf|\bcv\b|resume|curriculum/;
  const isFile = (f: AgentElement) => f.kind === "file" || f.type === "file";
  const isParser = (f: AgentElement) => PARSER_RE.test(hay(f)) && !/lebenslauf\s*\*/.test(hay(f));
  const files = fields.filter(isFile);
  const others = files.filter((f) => !isParser(f) && !CV_RE.test(hay(f)) && !/anschreiben|cover|motivation|foto|photo|avatar|bild/.test(hay(f)));
  const cvFallbackId = others.length === 1 && !files.some((f) => CV_RE.test(hay(f))) && CV_RE.test((opts.pageText ?? "").toLowerCase()) ? others[0].id : undefined;

  for (const e of fields) {
    const tries = opts.attempts?.[e.id] ?? 0;
    if (e.invalid && tries >= 3) { unresolved.push(e); continue; }
    if (done.has(e.id) && !e.invalid) continue;
    const label = e.label || e.name || e.placeholder || e.id;
    const h = hay(e);

    if (e.kind === "file" || e.type === "file") {
      // each document goes in once per run: upload widgets often re-render with a fresh empty input after a file is added
      const upload = (doc: "cv" | "cover") => {
        if (!e.invalid && (e.value || uploaded.has(`doc:${doc}`))) return;
        uploaded.add(`doc:${doc}`);
        actions.push({ type: "upload", id: e.id, doc, label });
      };
      // CV parsers ("Einfach Bewerben") would overwrite the personal fields with parsed values
      if (PARSER_RE.test(h) && !/lebenslauf\s*\*/.test(h)) continue;
      if (CV_RE.test(h) || e.id === cvFallbackId) upload("cv");
      else if (/anschreiben|cover|motivation/.test(h)) { if (opts.hasCover) upload("cover"); }
      else if (e.required && !e.value) unresolved.push(e);
      continue;
    }

    if (e.type === "checkbox") {
      if (e.checked) continue;
      if (MARKETING_RE.test(h)) continue;
      if (CONSENT_RE.test(h) && e.required) actions.push({ type: "check", id: e.id, checked: true, label });
      else if (e.required) unresolved.push(e);
      continue;
    }

    if (e.value?.trim() && !e.invalid) continue; // already filled
    if (e.type === "hidden" || e.type === "password") continue;
    if (e.invalid && tries >= 2) { repair.push(e); continue; }

    if (exp) {
      const ek = EXP_MATCHERS.find(([, re]) => re.test(label.toLowerCase().replace(/\s*\*$/, "").trim()))?.[0];
      if (ek && exp[ek]) { actions.push({ type: "fill", id: e.id, value: exp[ek], label }); expFilled = true; continue; }
    }

    const key = keyFor(e);
    if (key) {
      // second try for a city the autocomplete rejected: the fallback city
      const v = key === "city" && tries > 0 && e.invalid ? CITY_FALLBACK[0] : profileValue(profile, key);
      if (v) {
        if (e.options?.length) {
          const opt = pickOption(e.options, v);
          if (opt) actions.push({ type: "select", id: e.id, option: opt, label });
          else if (e.required) unresolved.push(e);
        } else actions.push({ type: "fill", id: e.id, value: forInput(e, v), label, fallback: key === "city" ? CITY_FALLBACK : undefined });
        continue;
      }
    }

    const learned = profile.answers
      .map((a) => ({ a, s: similar(a.question, label) }))
      .filter((x) => x.s >= 0.6)
      .sort((x, y) => y.s - x.s)[0]?.a;
    if (learned) {
      if (e.options?.length) {
        const opt = pickOption(e.options, learned.answer);
        if (opt) actions.push({ type: "select", id: e.id, option: opt, label });
        else unresolved.push(e);
      } else actions.push({ type: "fill", id: e.id, value: learned.answer, label });
      continue;
    }

    // Optional plain inputs without a match are left empty on purpose; only required fields and free-text questions need an answer.
    if (e.required || e.type === "textarea") unresolved.push(e);
  }

  const buttons = elements.filter((e) => e.kind === "button" || e.kind === "link");
  const submitId =
    buttons.find((b) => SUBMIT_RE.test(b.label))?.id ??
    (hasForm ? buttons.find((b) => b.submit && !NEXT_RE.test(b.label))?.id : undefined);
  const nextId = buttons.find((b) => NEXT_RE.test(b.label))?.id;
  const entryId = !hasForm ? buttons.find((b) => APPLY_ENTRY_RE.test(b.label) && !SUBMIT_RE.test(b.label))?.id : undefined;

  const expBtns = buttons.filter((b) => ADD_RE.test(b.label) && EXP_SECTION_RE.test(b.section ?? ""));
  const saveBtn = buttons.find((b) => EXP_SAVE_RE.test(b.label));
  if (expFilled && saveBtn) actions.push({ type: "click", id: saveBtn.id, label: saveBtn.label, mark: `exp:saved:${nAdded}` });
  else if (!actions.length && !exp && expBtns.length && nAdded < Math.min(opts.experience?.length ?? 0, MAX_EXPERIENCE))
    actions.push({ type: "click", id: expBtns[0].id, label: "Berufserfahrung hinzufügen", mark: `exp:add:${nAdded}` });

  return { actions, unresolved, repair, nextId, submitId, entryId, hasForm };
}
