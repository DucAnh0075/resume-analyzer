"use client";
import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Job, SearchProfile } from "@/lib/types";
import Icon from "./Icon";

interface Props {
  jobs: Job[];
  searches: SearchProfile[];
  busy: boolean;
  info: string;
  onApply: (searchId: string) => void;
  onRestore: (ids: string[]) => void;
  onOpenJob: (id: string) => void;
}

export default function AiFilterPage({ jobs, searches, busy, info, onApply, onRestore, onOpenJob }: Props) {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [searchId, setSearchId] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return jobs
      .filter((j) => j.status === "ignoriert" && j.filterReason)
      .filter((j) => !searchId || j.searchId === searchId)
      .filter((j) => !needle || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(needle));
  }, [jobs, q, searchId]);
  const sel = filtered.filter((j) => checked.has(j.id)).map((j) => j.id);
  const withFilter = searches.filter((s) => s.aiFilter?.trim());
  const profileName = (id?: string) => searches.find((s) => s.id === id)?.name;

  const toggle = (id: string) => setChecked((c) => { const n = new Set(c); if (!n.delete(id)) n.add(id); return n; });
  const restore = (ids: string[]) => { onRestore(ids); setChecked(new Set()); };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4">
      <section aria-label={t("aiProfiles")} className="space-y-2">
        <h2 className="text-lg font-semibold">{t("aiProfiles")}</h2>
        {withFilter.length ? (
          <ul className="space-y-2">
            {withFilter.map((s) => (
              <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-surface p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{s.name}</p>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted">{s.aiFilter}</p>
                </div>
                <button className="btn shrink-0" disabled={busy} onClick={() => onApply(s.id)}>
                  {busy ? <span className="spinner" aria-hidden /> : <Icon name="spark" />}
                  {busy ? t("aiFiltering") : t("applyAiFilter")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("aiNoCriteria")}</p>
        )}
        <p role="status" aria-live="polite" className={info ? "text-xs text-muted" : "sr-only"}>{info}</p>
      </section>

      <section aria-label={t("aiPageTitle")} className="space-y-3">
        <h2 className="text-lg font-semibold">{t("aiPageTitle")} <span className="font-normal text-muted">{filtered.length}</span></h2>
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-xs" type="search" aria-label={t("filterSearch")} placeholder={t("filterSearchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input max-w-[14rem]" aria-label={t("filterProfile")} value={searchId} onChange={(e) => setSearchId(e.target.value)}>
            <option value="">{t("allProfiles")}</option>
            {searches.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn" disabled={!sel.length} onClick={() => restore(sel)}>{t("aiRestoreSel", { n: sel.length })}</button>
          <button className="btn" disabled={!filtered.length} onClick={() => restore(filtered.map((j) => j.id))}>{t("aiRestoreAll", { n: filtered.length })}</button>
        </div>
        {filtered.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {filtered.map((j) => (
              <li key={j.id} className="flex items-start gap-3 p-3">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--accent)]" aria-label={t("selectRow")} checked={checked.has(j.id)} onChange={() => toggle(j.id)} />
                <div className="min-w-0 flex-1">
                  <button className="text-left text-sm font-medium underline-offset-2 hover:underline" onClick={() => onOpenJob(j.id)}>{j.title}</button>
                  <p className="text-xs text-muted">{[j.company, j.location, profileName(j.searchId)].filter(Boolean).join(" · ")}</p>
                  <p className="mt-1 text-sm">{j.filterReason}</p>
                </div>
                <button className="btn btn-ghost shrink-0" onClick={() => restore([j.id])}>{t("aiRestore")}</button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("aiPageEmpty")}</p>
        )}
      </section>
    </div>
  );
}
