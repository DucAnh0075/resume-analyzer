import type { AppStage, Application } from "./types";

export const STAGES: AppStage[] = ["beworben", "keine_antwort", "interview", "absage", "angebot", "angenommen", "abgelehnt"];

export const SANKEY_NODES = ["beworben", "ausstehend", "keine_antwort", "interview", "absage", "angebot", "angenommen", "abgelehnt"] as const;
export type SankeyNode = (typeof SANKEY_NODES)[number];
export interface SankeyLink {
  source: SankeyNode;
  target: SankeyNode;
  value: number;
}

/**
 * Each application contributes one path through Beworben → (Keine Antwort | Absage | Interview | Ausstehend),
 * Interview → (Absage | Angebot | Ausstehend), Angebot → (Angenommen | Abgelehnt | Ausstehend).
 * A rejection counts as "after interview" when the history contains an interview.
 */
export function sankeyFlows(apps: Application[]): SankeyLink[] {
  const counts = new Map<string, number>();
  const add = (s: SankeyNode, t: SankeyNode) => counts.set(`${s}>${t}`, (counts.get(`${s}>${t}`) ?? 0) + 1);

  for (const a of apps) {
    const seen = new Set(a.history.map((h) => h.stage));
    seen.add(a.stage);
    const interviewed = seen.has("interview") || seen.has("angebot") || seen.has("angenommen") || (seen.has("absage") && a.history.some((h) => h.stage === "interview"));
    const offered = seen.has("angebot") || seen.has("angenommen") || seen.has("abgelehnt");

    if (a.stage === "keine_antwort") add("beworben", "keine_antwort");
    else if (!interviewed && !offered) {
      add("beworben", a.stage === "absage" ? "absage" : "ausstehend");
    } else {
      add("beworben", "interview");
      if (offered) {
        add("interview", "angebot");
        add("angebot", a.stage === "angenommen" ? "angenommen" : a.stage === "abgelehnt" ? "abgelehnt" : "ausstehend");
      } else add("interview", a.stage === "absage" ? "absage" : "ausstehend");
    }
  }
  return [...counts].map(([k, value]) => {
    const [source, target] = k.split(">") as [SankeyNode, SankeyNode];
    return { source, target, value };
  });
}
