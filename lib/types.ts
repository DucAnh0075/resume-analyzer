export type Workplace = "onsite" | "remote" | "hybrid";
export type Experience = "internship" | "entry" | "associate" | "mid-senior" | "director" | "executive";
export type Posted = "24h" | "week" | "month" | "any";
export type JobStatus = "neu" | "angesehen" | "beworben" | "ignoriert";

export interface SearchProfile {
  id: string;
  name: string;
  keywords: string;
  location: string;
  radiusKm: number;
  postedWithin: Posted;
  workplace: Workplace[];
  experience: Experience[];
  excludeKeywords: string[];
  maxResults: number;
}

export interface FitPoint {
  title: string;
  detail: string;
}

export interface JobFit {
  score: number;
  verdict: string;
  pros: FitPoint[];
  cons: (FitPoint & { severity: "dealbreaker" | "gap" | "minor" })[];
  analyzedAt: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  postedAt?: string;
  url: string;
  description?: string;
  criteria?: Record<string, string>;
  status: JobStatus;
  searchId?: string;
  tailored?: boolean;
  score?: number;
  fit?: JobFit;
  foundAt: string;
}

export interface Change {
  section: string;
  type: "rewritten" | "added" | "reordered";
  text: string;
}

export interface TailorResult {
  changes: Change[];
  keywordsUsed: string[];
  texDiff: string;
  tailoredAt: string;
}
