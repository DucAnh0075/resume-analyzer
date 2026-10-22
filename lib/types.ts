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
  aiFilter?: string;
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
  cover?: boolean;
  bookmarked?: boolean;
  filterReason?: string;
  filterOverride?: boolean;
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

export interface CoverResult {
  changes: Change[];
  hints?: string;
  coverAt: string;
  edited?: boolean;
}

export type AppStage = "beworben" | "keine_antwort" | "absage" | "interview" | "angebot" | "angenommen" | "abgelehnt";

export interface Application {
  id: string;
  jobId?: string;
  title: string;
  company: string;
  location?: string;
  url?: string;
  appliedAt: string;
  stage: AppStage;
  history: { stage: AppStage; at: string }[];
  notes?: string;
}

export interface Profile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  zip: string;
  city: string;
  country: string;
  birthDate?: string;
  nationality?: string;
  workPermit?: string;
  salaryExpectation?: string;
  earliestStart?: string;
  noticePeriod?: string;
  workHours?: string;
  languages?: string;
  linkedin?: string;
  github?: string;
  website?: string;
  answers: { question: string; answer: string }[];
}
