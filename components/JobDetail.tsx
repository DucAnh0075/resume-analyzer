"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Change, Job, JobStatus, TailorResult } from "@/lib/types";
import { fitChip } from "./JobList";
import Icon from "./Icon";

interface Props {
  job: Job;
  result: TailorResult | null;
  busy: boolean;
  error?: string;
  hasCv: boolean;
  fitBusy: boolean;
  onFit: () => void;
  onTailor: (opts: { adoptLanguage: boolean; aggressive: boolean }) => void;
  onStatus: (s: JobStatus) => void;
  onBack: () => void;
  onGoCv: () => void;
}

const TYPE_CHIP: Record<Change["type"], string> = { added: "chip-amber", rewritten: "chip-accent", reordered: "" };
const TABS = ["fit", "desc", "changes", "diff"] as const;
type Tab = (typeof TABS)[number];

export default function JobDetail({ job, result, busy, error, hasCv, fitBusy, onFit, onTailor, onStatus, onBack, onGoCv }: Props) {
  const { t, date } = useI18n();
  const [tab, setTab] = useState<Tab>("fit");
  const [adoptLanguage, setAdoptLanguage] = useState(false);
  const [aggressive, setAggressive] = useState(true);

  const typeLabel = { added: t("changeAdded"), rewritten: t("changeRewritten"), reordered: t("changeReordered") };
  const tabLabel: Record<Tab, string> = {
    fit: job.fit ? `${t("tabFit")} ${job.fit.score}%` : t("tabFit"),
    desc: t("tabDescription"),
    changes: result ? `${t("tabChanges")} (${result.changes.length})` : t("tabChanges"),
    diff: t("tabDiff"),
  };

  function onTabKey(e: React.KeyboardEvent) {
    const i = TABS.indexOf(tab);
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    const next = TABS[(i + d + TABS.length) % TABS.length];
    setTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  }

  return (
    <div key={job.id} className="pane-in flex h-full min-h-0 flex-col">
      <header className="space-y-3 border-b border-line p-4">
        <button className="btn btn-ghost -ml-2 h-8 px-2 text-muted lg:hidden" onClick={onBack}>
          <Icon name="back" /> {t("back")}
        </button>
        <div>
          <h2 className="text-lg font-semibold leading-snug">{job.title}</h2>
          <p className="mt-0.5 text-sm text-muted">
            {[job.company, job.location, job.postedAt && date(job.postedAt)].filter(Boolean).join(" · ")}
          </p>
        </div>
        {job.criteria && Object.keys(job.criteria).length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {Object.entries(job.criteria).map(([k, v]) => (
              <li key={k} className="chip">{v}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {hasCv ? (
            <button className="btn btn-primary" disabled={busy} onClick={() => onTailor({ adoptLanguage, aggressive })}>
              {busy ? <span className="spinner" aria-hidden /> : <Icon name="spark" />}
              {busy ? t("tailoring") : job.tailored ? t("tailorAgain") : t("tailor")}
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onGoCv}>{t("noCvAction")}</button>
          )}
          {job.status === "ignoriert" ? (
            <button className="btn" onClick={() => onStatus("angesehen")}>{t("restore")}</button>
          ) : (
            <>
              <button className="btn" disabled={job.status === "beworben"} onClick={() => onStatus("beworben")}>
                {job.status === "beworben" && <Icon name="check" />} {job.status === "beworben" ? t("badgeApplied") : t("markApplied")}
              </button>
              <button className="btn btn-ghost" onClick={() => onStatus("ignoriert")}>{t("markIgnored")}</button>
            </>
          )}
          {job.url && (
            <a className="btn btn-ghost ml-auto" href={job.url} target="_blank" rel="noreferrer">
              {t("openLinkedIn")} <Icon name="external" />
            </a>
          )}
        </div>
        {!hasCv && <p className="text-sm text-muted">{t("noCvBody")}</p>}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
          <label className="flex items-center gap-2" title={t("optAggressiveHint")}>
            <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={aggressive} onChange={(e) => setAggressive(e.target.checked)} />
            {t("optAggressive")}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={adoptLanguage} onChange={(e) => setAdoptLanguage(e.target.checked)} />
            {t("optLanguage")}
          </label>
        </div>
        {busy && <p role="status" className="text-sm text-muted">{t("tailoringHint")}</p>}
        {error && <pre role="alert" className="whitespace-pre-wrap break-words rounded-lg bg-red-soft p-3 text-xs text-red-ink">{error}</pre>}
      </header>

      <div role="tablist" onKeyDown={onTabKey} className="flex gap-1 border-b border-line px-3">
        {TABS.map((k) => (
          <button
            key={k}
            id={`tab-${k}`}
            role="tab"
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            tabIndex={tab === k ? 0 : -1}
            onClick={() => setTab(k)}
            className={`relative h-10 px-3 text-sm font-medium transition-colors duration-150 ease-out ${tab === k ? "text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:bg-accent" : "text-muted"}`}
          >
            {tabLabel[k]}
          </button>
        ))}
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0} className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
        {tab === "fit" && (
          <div className="max-w-[72ch] space-y-5">
            {job.fit ? (
              <>
                <div className="flex items-start gap-3">
                  <span className={`chip shrink-0 px-2 py-1 text-base ${fitChip(job.fit.score)}`}>{job.fit.score}%</span>
                  <p className="pt-0.5 text-base leading-snug">{job.fit.verdict}</p>
                </div>
                <FitList title={t("fitPros")} tone="pro" items={job.fit.pros.map((p) => ({ ...p }))} />
                <FitList
                  title={t("fitCons")}
                  tone="con"
                  items={job.fit.cons.map((c) => ({ title: c.title, detail: c.detail, badge: { dealbreaker: t("sevDealbreaker"), gap: t("sevGap"), minor: t("sevMinor") }[c.severity], badgeClass: c.severity === "dealbreaker" ? "chip-red" : c.severity === "gap" ? "chip-amber" : "" }))}
                />
              </>
            ) : (
              <Empty title={t("fitEmptyTitle")} body={hasCv ? t("fitEmptyBody") : t("noCvBody")} />
            )}
            {hasCv && (
              <button className={`btn ${job.fit ? "" : "btn-primary"}`} disabled={fitBusy} onClick={onFit}>
                {fitBusy ? <span className="spinner" aria-hidden /> : <Icon name="spark" />}
                {fitBusy ? t("fitAnalyzing") : job.fit ? t("fitAgain") : t("fitAnalyze")}
              </button>
            )}
          </div>
        )}

        {tab === "desc" &&
          (job.description ? (
            <div className="max-w-[72ch] whitespace-pre-wrap leading-relaxed">{job.description}</div>
          ) : (
            <div className="space-y-2" aria-label={t("loadingDescription")}>
              {[90, 100, 75, 95, 60].map((w, i) => <div key={i} className="skeleton h-4" style={{ width: `${w}%` }} />)}
            </div>
          ))}

        {tab === "changes" &&
          (result ? (
            <div className="max-w-[72ch] space-y-4">
              {result.keywordsUsed.length > 0 && (
                <section aria-label={t("keywordsUsed")}>
                  <h3 className="mb-1.5 text-xs font-medium text-muted">{t("keywordsUsed")}</h3>
                  <ul className="flex flex-wrap gap-1.5">
                    {result.keywordsUsed.map((k) => <li key={k} className="chip chip-accent">{k}</li>)}
                  </ul>
                </section>
              )}
              <p className="text-muted">{t("changesNote")}</p>
              <ul className="space-y-2">
                {result.changes.map((c, i) => (
                  <li key={i} className={`rounded-lg border p-3 ${c.type === "added" ? "border-transparent bg-amber-soft" : "border-line bg-surface"}`}>
                    <div className="flex items-center gap-2">
                      <span className={`chip ${TYPE_CHIP[c.type]}`}>{typeLabel[c.type]}</span>
                      <span className="font-medium">{c.section}</span>
                    </div>
                    <p className="mt-1.5 leading-relaxed">{c.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <Empty title={t("noTailored")} body={t("noTailoredHint")} />
          ))}

        {tab === "diff" &&
          (result ? (
            <pre className="overflow-x-auto font-mono text-xs leading-5">
              {result.texDiff.split("\n").map((l, i) => (
                <div key={i} className={`px-2 ${l.startsWith("+") && !l.startsWith("+++") ? "diff-add" : l.startsWith("-") && !l.startsWith("---") ? "diff-del" : "text-muted"}`}>{l || " "}</div>
              ))}
            </pre>
          ) : (
            <Empty title={t("noTailored")} body={t("noTailoredHint")} />
          ))}
      </div>
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-1">
      <p className="font-medium">{title}</p>
      <p className="text-muted">{body}</p>
    </div>
  );
}

function FitList({ title, tone, items }: { title: string; tone: "pro" | "con"; items: { title: string; detail: string; badge?: string; badgeClass?: string }[] }) {
  return (
    <section aria-label={title}>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className={`chip ${tone === "pro" ? "chip-accent" : "chip-red"}`} aria-hidden>{tone === "pro" ? "+" : "−"}</span>
        {title} <span className="font-normal text-muted">{items.length}</span>
      </h3>
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={i} className="rounded-lg border border-line bg-surface p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{it.title}</span>
              {it.badge && <span className={`chip ${it.badgeClass ?? ""}`}>{it.badge}</span>}
            </div>
            <p className="mt-1 leading-relaxed text-muted">{it.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
