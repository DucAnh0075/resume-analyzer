"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n, type Key } from "@/lib/i18n";
import type { Job, JobStatus, SearchProfile } from "@/lib/types";
import Icon from "./Icon";

export const STATUS_KEY: Record<JobStatus, Key> = {
  neu: "statusNeu",
  angesehen: "statusAngesehen",
  beworben: "statusBeworben",
  ignoriert: "statusIgnoriert",
};

export interface JobFilter {
  status: JobStatus | "alle" | "gemerkt";
  searchId: string;
  q: string;
}

interface Props {
  jobs: Job[];
  searches: SearchProfile[];
  selectedId?: string;
  filter: JobFilter;
  runSearchId: string;
  busy: boolean;
  filterBusy: boolean;
  onApplyFilter: () => void;
  info: string;
  onFilter: (f: JobFilter) => void;
  onRunSearchId: (id: string) => void;
  onRunSearch: () => void;
  onSelect: (id: string) => void;
  onBulk: (ids: string[], patch: { status?: JobStatus; bookmarked?: boolean }) => void;
  onGo: (page: "searches" | "manual") => void;
}

export const fitChip = (score: number) => (score >= 70 ? "chip-accent" : score >= 45 ? "chip-amber" : "chip-red");

export function filterJobs(jobs: Job[], f: JobFilter) {
  const q = f.q.trim().toLowerCase();
  return jobs
    .filter((j) => (f.status === "alle" ? j.status !== "ignoriert" : f.status === "gemerkt" ? !!j.bookmarked : j.status === f.status))
    .filter((j) => !f.searchId || j.searchId === f.searchId)
    .filter((j) => !q || `${j.title} ${j.company} ${j.location}`.toLowerCase().includes(q));
}

export default function JobList(p: Props) {
  const { t, date } = useI18n();
  const listRef = useRef<HTMLUListElement>(null);
  const visible = filterJobs(p.jobs, p.filter);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const sel = visible.filter((j) => checked.has(j.id)).map((j) => j.id);
  const headRef = useRef<HTMLInputElement>(null);

  // Selection only ever covers what is currently visible.
  useEffect(() => {
    setChecked((c) => {
      const ids = new Set(visible.map((j) => j.id));
      const next = new Set([...c].filter((id) => ids.has(id)));
      return next.size === c.size ? c : next;
    });
  }, [visible.length, p.filter.status, p.filter.searchId, p.filter.q]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (headRef.current) headRef.current.indeterminate = sel.length > 0 && sel.length < visible.length;
  });

  const toggle = (id: string) => setChecked((c) => { const n = new Set(c); if (!n.delete(id)) n.add(id); return n; });
  const toggleAll = () => setChecked(sel.length === visible.length ? new Set() : new Set(visible.map((j) => j.id)));
  const bulk = (patch: { status?: JobStatus; bookmarked?: boolean }) => { p.onBulk(sel, patch); setChecked(new Set()); };

  // Arrow keys move the selection; deliberately instant, keyboard actions are never animated.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const i = visible.findIndex((j) => j.id === p.selectedId);
    const next = visible[Math.min(visible.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))];
    if (!next) return;
    e.preventDefault();
    p.onSelect(next.id);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-id="${next.id}"]`)?.focus();
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-line p-3">
        <div className="flex gap-2">
          <select className="input" aria-label={t("filterProfile")} value={p.runSearchId} onChange={(e) => p.onRunSearchId(e.target.value)} disabled={!p.searches.length}>
            {p.searches.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            {!p.searches.length && <option>—</option>}
          </select>
          <button className="btn btn-primary shrink-0" disabled={p.busy} onClick={p.onRunSearch}>
            {p.busy ? <span className="spinner" aria-hidden /> : <Icon name="search" />}
            {t("runSearch")}
          </button>
        </div>
        {p.searches.find((s) => s.id === p.runSearchId)?.aiFilter && (
          <button className="btn btn-ghost h-8 w-full justify-start px-2 text-muted" disabled={p.filterBusy || p.busy} onClick={p.onApplyFilter} title={t("applyAiFilterHint")}>
            {p.filterBusy ? <span className="spinner" aria-hidden /> : <Icon name="spark" />}
            {p.filterBusy ? t("aiFiltering") : t("applyAiFilter")}
          </button>
        )}
        <p role="status" aria-live="polite" className={p.info ? "text-xs text-muted" : "sr-only"}>{p.info}</p>
        <input
          className="input"
          type="search"
          aria-label={t("filterSearch")}
          placeholder={t("filterSearchPlaceholder")}
          value={p.filter.q}
          onChange={(e) => p.onFilter({ ...p.filter, q: e.target.value })}
        />
        <div className="flex gap-2">
          <select className="input" aria-label={t("filterStatus")} value={p.filter.status} onChange={(e) => p.onFilter({ ...p.filter, status: e.target.value as JobFilter["status"] })}>
            <option value="alle">{t("statusAll")}</option>
            <option value="gemerkt">{t("statusBookmarked")}</option>
            {(Object.keys(STATUS_KEY) as JobStatus[]).map((s) => <option key={s} value={s}>{t(STATUS_KEY[s])}</option>)}
          </select>
          <select className="input" aria-label={t("filterProfile")} value={p.filter.searchId} onChange={(e) => p.onFilter({ ...p.filter, searchId: e.target.value })}>
            <option value="">{t("allProfiles")}</option>
            {p.searches.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="flex min-h-8 flex-wrap items-center gap-2 text-xs text-muted">
          <input ref={headRef} type="checkbox" className="h-4 w-4 accent-[var(--accent)]" aria-label={t("selectAll")} checked={visible.length > 0 && sel.length === visible.length} disabled={!visible.length} onChange={toggleAll} />
          {sel.length === 0 ? (
            <span>{visible.length === 1 ? t("jobCountOne") : t("jobCount", { n: visible.length })}</span>
          ) : (
            <>
              <button className="btn h-8 px-2.5" onClick={() => bulk({ status: "ignoriert" })}>{t("bulkIgnore", { n: sel.length })}</button>
              <button className="btn h-8 px-2.5" onClick={() => bulk({ bookmarked: true })}><Icon name="star" size={14} /> {t("bulkBookmark", { n: sel.length })}</button>
              <button className="btn btn-ghost h-8 px-2" onClick={() => setChecked(new Set())}>{t("bulkClear")}</button>
            </>
          )}
        </div>
      </div>

      {visible.length ? (
        <ul ref={listRef} onKeyDown={onKeyDown} aria-label={t("jobsListLabel")} className="min-h-0 flex-1 overflow-y-auto">
          {visible.map((j) => {
            const selected = j.id === p.selectedId;
            return (
              <li key={j.id} data-selected={selected || undefined} className={`job-row flex items-stretch border-b border-line ${selected ? "bg-accent-soft" : ""}`}>
                <label className="flex w-9 shrink-0 cursor-pointer items-start justify-center pt-3">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" aria-label={t("selectRow")} checked={checked.has(j.id)} onChange={() => toggle(j.id)} />
                </label>
                <button
                  data-id={j.id}
                  aria-current={selected ? "true" : undefined}
                  onClick={() => p.onSelect(j.id)}
                  className="block min-w-0 flex-1 py-2.5 pr-1 text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`text-sm leading-snug ${j.status === "neu" ? "font-semibold" : "font-medium"}`}>{j.title}</span>
                    {j.fit ? (
                      <span className={`chip shrink-0 ${fitChip(j.fit.score)}`} title={t("fitAiScore")}>{j.fit.score}%</span>
                    ) : (
                      j.score !== undefined && <span className="shrink-0 text-xs tabular-nums text-muted" title={t("matchTitle")}>{j.score}%</span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted">{[j.company, j.location].filter(Boolean).join(" · ")}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {j.postedAt && <span className="text-xs text-muted">{date(j.postedAt)}</span>}
                    {j.status === "neu" && <span className="chip chip-accent">{t("badgeNew")}</span>}
                    {j.tailored && <span className="chip chip-amber">{t("badgeCv")}</span>}
                    {j.cover && <span className="chip chip-amber">{t("badgeCover")}</span>}
                    {j.status === "beworben" && <span className="chip chip-violet">{t("badgeApplied")}</span>}
                  </div>
                </button>
                <button
                  className={`flex w-9 shrink-0 items-start justify-center pt-3 ${j.bookmarked ? "text-amber-ink" : "text-muted"}`}
                  aria-pressed={!!j.bookmarked}
                  aria-label={j.bookmarked ? t("unbookmark") : t("bookmark")}
                  onClick={() => p.onBulk([j.id], { bookmarked: !j.bookmarked })}
                >
                  <Icon name="star" size={15} filled={!!j.bookmarked} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-1 flex-col items-start gap-3 p-5">
          {p.jobs.length ? (
            <p className="text-sm text-muted">{t("emptyFiltered")}</p>
          ) : (
            <>
              <h2 className="text-base font-semibold">{t("emptyJobsTitle")}</h2>
              <p className="max-w-[34ch] text-sm text-muted">{t("emptyJobsBody")}</p>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-primary" onClick={() => p.onGo("searches")}>{t("emptyNoProfile")}</button>
                <button className="btn" onClick={() => p.onGo("manual")}>{t("emptyManual")}</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
