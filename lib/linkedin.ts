import * as cheerio from "cheerio";
import type { Experience, Job, Posted, SearchProfile, Workplace } from "./types";

const BASE = "https://www.linkedin.com/jobs-guest/jobs/api";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
};

export class LinkedInBlockedError extends Error {}

const WT: Record<Workplace, string> = { onsite: "1", remote: "2", hybrid: "3" };
const EXP: Record<Experience, string> = {
  internship: "1",
  entry: "2",
  associate: "3",
  "mid-senior": "4",
  director: "5",
  executive: "6",
};
const TPR: Record<Posted, string | null> = {
  "24h": "r86400",
  week: "r604800",
  month: "r2592000",
  any: null,
};
const MILES = [0, 5, 10, 25, 50, 100];

export function kmToLinkedInMiles(km: number) {
  const mi = km / 1.609;
  return MILES.reduce((best, m) => (Math.abs(m - mi) < Math.abs(best - mi) ? m : best));
}

async function get(url: string) {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(15000) });
  if (res.status === 429 || res.status === 999 || res.status === 403) {
    throw new LinkedInBlockedError(`LinkedIn blockt die Anfrage (HTTP ${res.status}). Später erneut versuchen oder Text einfügen.`);
  }
  if (!res.ok) throw new Error(`LinkedIn HTTP ${res.status}`);
  return res.text();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function extractJobId(input: string): string | null {
  const s = input.trim();
  if (/^\d{6,}$/.test(s)) return s;
  const m = s.match(/currentJobId=(\d+)/) ?? s.match(/\/jobs\/view\/(?:[^/?]*-)?(\d{6,})/) ?? s.match(/jobPosting[:/](\d+)/);
  return m ? m[1] : null;
}

export function buildSearchUrl(p: SearchProfile, start: number) {
  const q = new URLSearchParams({
    keywords: p.keywords,
    location: p.location,
    distance: String(kmToLinkedInMiles(p.radiusKm)),
    sortBy: "DD",
    start: String(start),
  });
  const tpr = TPR[p.postedWithin];
  if (tpr) q.set("f_TPR", tpr);
  if (p.workplace.length) q.set("f_WT", p.workplace.map((w) => WT[w]).join(","));
  if (p.experience.length) q.set("f_E", p.experience.map((e) => EXP[e]).join(","));
  return `${BASE}/seeMoreJobPostings/search?${q}`;
}

export function parseSearchCards(html: string): Pick<Job, "id" | "title" | "company" | "location" | "postedAt" | "url">[] {
  const $ = cheerio.load(html);
  const out: ReturnType<typeof parseSearchCards> = [];
  $("li").each((_, li) => {
    const el = $(li);
    const urn = el.find("[data-entity-urn]").attr("data-entity-urn") ?? "";
    const id = urn.split(":").pop() ?? "";
    const title = el.find(".base-search-card__title").text().trim();
    if (!id || !title) return;
    out.push({
      id,
      title,
      company: el.find(".base-search-card__subtitle").text().trim(),
      location: el.find(".job-search-card__location").text().trim(),
      postedAt: el.find("time").attr("datetime"),
      url: `https://www.linkedin.com/jobs/view/${id}`,
    });
  });
  return out;
}

/** Fetches up to maxResults cards, politely paced. Throws LinkedInBlockedError if blocked before any result. */
export async function searchJobs(p: SearchProfile) {
  const all: ReturnType<typeof parseSearchCards> = [];
  let blocked: string | undefined;
  for (let start = 0; all.length < p.maxResults && start < 200; start += 10) {
    try {
      const cards = parseSearchCards(await get(buildSearchUrl(p, start)));
      if (!cards.length) break;
      all.push(...cards);
    } catch (e) {
      if (e instanceof LinkedInBlockedError && all.length) {
        blocked = e.message;
        break;
      }
      throw e;
    }
    await sleep(1000 + Math.random() * 2000);
  }
  const seen = new Set<string>();
  const unique = all.filter((c) => !seen.has(c.id) && seen.add(c.id));
  return { jobs: unique.slice(0, p.maxResults), warning: blocked };
}

export function parseJobDetail(html: string) {
  const $ = cheerio.load(html);
  const desc = $(".show-more-less-html__markup");
  desc.find("br").replaceWith("\n");
  desc.find("li").each((_, li) => {
    $(li).prepend("• ").append("\n");
  });
  desc.find("p, ul").append("\n");
  const criteria: Record<string, string> = {};
  $(".description__job-criteria-item").each((_, it) => {
    const k = $(it).find(".description__job-criteria-subheader").text().trim();
    const v = $(it).find(".description__job-criteria-text").text().trim();
    if (k) criteria[k] = v;
  });
  return {
    title: $(".top-card-layout__title").first().text().trim(),
    company: $(".topcard__org-name-link, .top-card-layout__card a.topcard__org-name-link").first().text().trim(),
    location: $(".topcard__flavor--bullet").first().text().trim(),
    description: desc.text().replace(/\n{3,}/g, "\n\n").trim(),
    criteria,
  };
}

export async function fetchJobDetail(id: string) {
  const d = parseJobDetail(await get(`${BASE}/jobPosting/${id}`));
  if (!d.description) throw new Error("Keine Stellenbeschreibung gefunden (Anzeige evtl. abgelaufen).");
  return d;
}
