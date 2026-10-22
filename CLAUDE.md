# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server on :3000 (needs GEMINI_API_KEY in .env.local, see .env.example)
npm run build        # production build
npm run typecheck    # tsc --noEmit (there is no linter and no test suite)
```

Ad-hoc checks of `lib/` modules: write a throwaway script and run it with `npx tsx script.ts` (pure helpers in `lib/latex.ts` and `lib/linkedin.ts` need no network or API key). Compiling a CV needs `latexmk`/`pdflatex` on PATH.

## What this is

Local single-user tool (UI text is German): saved LinkedIn search profiles → job list → Gemini rewrites the user's LaTeX CV for a chosen job → PDF preview. Free-tier only: Gemini via `@google/genai`, LinkedIn via public guest endpoints without login. Do not add login, proxy rotation or captcha circumvention for LinkedIn; on 429/999/403 the code throws `LinkedInBlockedError` and the UI falls back to manual text entry.

## Architecture

- **No database.** `lib/store.ts` persists to JSON files under `data/` (`searches.json`, `jobs.json` keyed by LinkedIn job id, `cv.tex` = the user's base CV). Generated artifacts live in `output/<jobId>/` (`cv.tex`, `cv.pdf`, `result.json`, see `lib/output.ts`). Both dirs are gitignored.
- **Tailoring pipeline** (`POST /api/tailor` → `lib/tailor.ts`): split CV at `\begin{document}` (`splitCv`) → only the body goes to Gemini, the preamble is never sent or modified → e-mail/phone replaced by `CONTACT_*` placeholders (`maskContacts`) and restored afterwards → `validateBody` → `compileLatex` (latexmk in a temp dir) → on compile failure one Gemini repair call with the log excerpt, then fail. Prompts are in `lib/prompts.ts`; the "aggressive" mode intentionally lets the model add skills not in the CV, but employers/titles/dates/degrees must stay untouched, and additions are surfaced as `changes[].type === "added"` for the user to review.
- **Style rule**: `tailorPrompt` is deliberately minimal-invasive (reuse the user's sentences, same sections/bullet counts, no marketing adjectives); tailor and cover calls run at temperature 0.3 via `generateJson`'s `opts`.
- **Cover letter** (`lib/cover.ts`): base letter in `data/cover.tex` (same `\begin{document}` split as the CV), `POST /api/jobs/[id]/cover` tailors it (Gemini), `PUT` recompiles a hand-edited version; outputs `cover.tex/pdf/json` in `output/<jobId>/`; `/pdf?doc=cover` serves it.
- **Bulk/bookmarks**: `POST /api/jobs/bulk` `{ids, status?, bookmarked?}`; `Job.bookmarked` is independent of status.
- **Applications** (`data/applications.json`, `lib/applications.ts`): setting a job to "beworben" creates an `Application` (also backfilled on `GET /api/applications`); external ones via POST. Pure sankey logic lives in `lib/sankey.ts` (client-safe, no fs); layout via `d3-sankey` in `components/Applications.tsx`.
- **Application agent** (`extension/` Chrome MV3 extension + `lib/agent.ts`, `lib/fieldmap.ts`, `POST /api/agent/step|done`): the extension snapshots the form, the app answers with actions, the extension executes them. Standard fields are mapped locally (`mapFields`, no LLM); Gemini (lite model, `generateJson` `opts.lite`) only sees the leftover fields and never receives contact data (profile values are substituted server-side from `data/profile.json`). **The agent must never submit without the user's confirmation overlay**: `content.js` refuses clicks on submit-looking buttons, the server only ever returns `ready_to_submit`. No LinkedIn Easy Apply automation. `SUBMIT_RE` exists in `lib/fieldmap.ts` and `extension/content.js` and must stay in sync. `public/test-form.html` is a harmless local test form.
  - **Trusted input**: synthetic DOM events are ignored by many widgets (SmartRecruiters: shadow DOM, autocomplete, dropzones), so `background.js` uses `chrome.debugger` (`cdpType`/`cdpKey`/`cdpClick`) and uploads via `DOM.setFileInputFiles` (path obtained through the `downloads` API into `Downloads/resume-analyzer/`, second strategy: intercept the page's own file dialog). Both permissions are in `manifest.json`; DevTools must be closed on the tab or the debugger cannot attach. Synthetic events in `content.js` are only the fallback.
  - **Self-correction**: the snapshot carries `invalid`/`error` per field (`errorOf`). `AgentStepInput.attempts` counts tries per element; an invalid field is retried up to 3 times (profile value → city fallback `CITY_FALLBACK` = Hamburg → Gemini repair with the error text), then the user is asked. "Weiter" is repeatable via a `next:<page signature>` mark in `done`. Failed actions do not stop the run; they show up as "Zuletzt gescheitert" in later user messages.
  - **Work experience**: `getExperience` (`lib/agent.ts`, one lite Gemini call per CV, cached in memory) extracts up to `MAX_EXPERIENCE` entries; `mapFields` clicks the "Hinzufügen" button of a "Berufserfahrung" section (`section` is set by `content.js`), fills the dialog and clicks save, tracked by `exp:add:n` / `exp:saved:n` marks (`AgentAction.click.mark`).
  - `fieldmap.ts` skips "Einfach Bewerben"-style CV parsers (`PARSER_RE`) and treats a single unlabeled upload as the CV when the page mentions it.
- **Fit analysis** (`POST /api/jobs/[id]/fit` → `lib/fit.ts`): on demand, one Gemini call per job returns score, verdict, pros and cons (cons carry a severity); stored on `Job.fit`. The list shows `fit.score` when present, otherwise the cheap local title-overlap `Job.score`.
- **Gemini calls** go through `generateJson` in `lib/gemini.ts` (structured output via a hand-written JSON schema + a zod parser; retries with backoff on 429/5xx and on parse errors). Schemas in `lib/tailor.ts` must be kept in sync with their zod counterparts manually. Model comes from `GEMINI_MODEL`.
- **LinkedIn** (`lib/linkedin.ts`): search via `jobs-guest/.../seeMoreJobPostings/search` (radius km → nearest allowed miles value), details via `.../jobPosting/<id>`; both are scraped with cheerio CSS selectors that break if LinkedIn changes markup. Search results get a cheap local score (title-word overlap with the CV) in `app/api/search/run/route.ts`; no LLM is used for ranking during the search itself. The only LLM step is the optional per-profile `aiFilter` (`lib/jobfilter.ts`): one batch Gemini call on title/company/location that sets unsuitable new jobs to `ignoriert` with `Job.filterReason`; `POST /api/search/filter` applies it to existing untouched jobs.
- **`/api/jobs/[id]/pdf`** serves both the tailored PDF and the original CV (`?which=original`, compiled on demand; the id is ignored then). `?format=tex`, `&download` switch format/disposition.
- **UI**: single client page `app/page.tsx` holds all state and switches between Jobs (3-column master/detail/PDF), Suchprofile, Mein CV, Manuell; components in `components/`. Tailwind v3, dark mode via media query.
- Route params are `Promise`s (Next 15); path alias `@/*` maps to the repo root.
