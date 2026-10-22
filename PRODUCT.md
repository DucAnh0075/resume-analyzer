# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Job seekers (today: the author, a student in Germany) who apply to many LinkedIn postings and keep their CV in LaTeX. They work deliberately on a few chosen postings rather than skimming hundreds: pick a posting, tailor the CV, review exactly what the AI changed, then apply. Intended to become public for other users later.

## Product Purpose
Search LinkedIn jobs through saved search profiles (keywords, location, radius), then have Gemini rewrite the user's LaTeX CV for a specific posting so it stands out to HR and ATS systems, with a PDF preview. Success: a tailored, compiling CV per posting that the user has reviewed and trusts before sending.

## Positioning
Operates on the user's own LaTeX source (layout stays exact, preamble never touched) and shows every AI change, flagging additions that were not in the original CV, instead of producing a black-box rewrite.

## Operating Context
Local Next.js app, free tier only (Gemini API, LinkedIn public guest endpoints without login). Requires `latexmk` on the machine. Data lives in local JSON files and `output/<jobId>/`. Languages: UI German now, German and English required; CVs and postings can be in either language.

## Capabilities and Constraints
- Saved search profiles, job list with status (neu / angesehen / beworben / ignoriert), job detail, tailored vs original PDF preview, change list, diff, manual job entry.
- Light and dark mode must both work (currently follows system setting).
- Aggressive rewriting is allowed; employers, titles, dates, degrees and certificates must never be altered; additions must stay visible to the user.
- Open decision: going public implies multi-user accounts, per-user storage, and per-user API keys. None of that exists yet, and LinkedIn scraping terms may constrain a public version.

## Product Principles
- The user must always be able to see what the AI changed and what is new.
- Original CV is the baseline; never lose or overwrite it.
- Stay free to run.
- Speed through a list matters, but decisions about a single posting get full detail.

## Accessibility & Inclusion
Light and dark themes both supported. German and English UI required.
