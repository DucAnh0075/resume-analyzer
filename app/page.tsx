"use client";
import { useCallback, useEffect, useState } from "react";
import { api, post } from "@/components/api";
import JobDetail from "@/components/JobDetail";
import JobList, { type JobFilter } from "@/components/JobList";
import Applications from "@/components/Applications";
import ManualJob, { type ManualInput } from "@/components/ManualJob";
import MyCv from "@/components/MyCv";
import PdfPanel from "@/components/PdfPanel";
import SearchProfiles from "@/components/SearchProfiles";
import { LangToggle, ThemeToggle } from "@/components/Toggles";
import { useI18n, type Key } from "@/lib/i18n";
import type { Job, JobStatus, SearchProfile, TailorResult } from "@/lib/types";

type Page = "jobs" | "applications" | "searches" | "cv" | "cover" | "manual";
type Pane = "list" | "detail" | "pdf";
const NAV: [Page, Key][] = [["jobs", "navJobs"], ["applications", "navApplications"], ["searches", "navSearches"], ["cv", "navCv"], ["cover", "navCover"], ["manual", "navManual"]];

export default function Home() {
  const { t, lang } = useI18n();
  const [fitBusy, setFitBusy] = useState(false);
  const [page, setPage] = useState<Page>("jobs");
  const [pane, setPane] = useState<Pane>("list"); // below lg only one pane is visible at a time
  const [jobs, setJobs] = useState<Job[]>([]);
  const [searches, setSearches] = useState<SearchProfile[]>([]);
  const [hasCv, setHasCv] = useState(true);
  const [hasCover, setHasCover] = useState(true);
  const [selectedId, setSelectedId] = useState<string>();
  const [result, setResult] = useState<TailorResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [filtering, setFiltering] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState("");
  const [version, setVersion] = useState(0);
  const [filter, setFilter] = useState<JobFilter>({ status: "alle", searchId: "", q: "" });
  const [runSearchId, setRunSearchId] = useState("");

  const reload = useCallback(async () => {
    const [j, s] = await Promise.all([api<Job[]>("/api/jobs"), api<SearchProfile[]>("/api/searches")]);
    setJobs(j);
    setSearches(s);
    setRunSearchId((cur) => (s.some((x) => x.id === cur) ? cur : s[0]?.id ?? ""));
  }, []);

  useEffect(() => {
    reload();
    api<{ tex: string }>("/api/cv").then((d) => setHasCv(!!d.tex));
    api<{ tex: string }>("/api/cover").then((d) => setHasCover(!!d.tex));
  }, [reload]);

  const selected = jobs.find((j) => j.id === selectedId);

  async function select(id: string) {
    setSelectedId(id);
    setPane("detail");
    setError(undefined);
    setResult(null);
    const d = await api<{ result: TailorResult | null; error?: string }>(`/api/jobs/${id}`);
    setResult(d.result);
    if (d.error) setError(d.error);
    reload();
  }

  async function runSearch() {
    if (!runSearchId) return setInfo(t("needProfile"));
    setSearching(true);
    setInfo(t("searching"));
    try {
      const r = await post<{ added: number; filtered: number; total: number; warning?: string }>("/api/search/run", { searchId: runSearchId });
      const msg = r.filtered ? t("searchDoneFiltered", { added: r.added, total: r.total, filtered: r.filtered }) : t("searchDone", { added: r.added, total: r.total });
      setInfo(`${msg}${r.warning ? " " + r.warning : ""}`);
      await reload();
    } catch (e) {
      setInfo((e as Error).message);
    } finally {
      setSearching(false);
    }
  }

  async function applyFilter() {
    if (!runSearchId) return;
    setFiltering(true);
    setInfo(t("aiFiltering"));
    try {
      const r = await post<{ checked: number; filtered: number }>("/api/search/filter", { searchId: runSearchId });
      setInfo(t("aiFilterDone", r));
      await reload();
    } catch (e) {
      setInfo((e as Error).message);
    } finally {
      setFiltering(false);
    }
  }

  async function tailor(body: Record<string, unknown>) {
    setBusy(true);
    setError(undefined);
    try {
      const r = await post<{ job: Job; result: TailorResult }>("/api/tailor", body);
      await reload();
      setSelectedId(r.job.id);
      setResult(r.result);
      setVersion((v) => v + 1);
      setPage("jobs");
      setPane("pdf");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function analyzeFit(id: string) {
    setFitBusy(true);
    setError(undefined);
    try {
      await post(`/api/jobs/${id}/fit`, { lang });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFitBusy(false);
    }
  }

  async function setStatus(s: JobStatus) {
    if (!selected) return;
    await post(`/api/jobs/${selected.id}/status`, { status: s });
    reload();
  }

  async function bulk(ids: string[], patch: { status?: JobStatus; bookmarked?: boolean }) {
    if (!ids.length) return;
    await post("/api/jobs/bulk", { ids, ...patch });
    reload();
  }

  const show = (p: Pane) => (pane === p ? "flex" : "hidden") + " lg:flex";

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-2">
        <h1 className="text-base font-semibold tracking-tight">{t("appName")}</h1>
        <nav aria-label="Main" className="seg order-last w-full overflow-x-auto sm:order-none sm:w-auto">
          {NAV.map(([k, label]) => (
            <button key={k} aria-current={page === k ? "page" : undefined} onClick={() => setPage(k)} className="flex-1 whitespace-nowrap sm:flex-none">
              {t(label)}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
        {page === "jobs" && (
          <div className="flex h-full flex-col lg:grid lg:grid-cols-[340px_minmax(0,1fr)_minmax(0,0.95fr)] xl:grid-cols-[380px_minmax(0,1fr)_minmax(0,1fr)]">
            <section aria-label={t("navJobs")} className={`${show("list")} min-h-0 flex-1 flex-col border-line bg-surface lg:h-full lg:border-r`}>
              <JobList
                jobs={jobs}
                searches={searches}
                selectedId={selectedId}
                filter={filter}
                runSearchId={runSearchId}
                busy={searching}
                filterBusy={filtering}
                onApplyFilter={applyFilter}
                info={info}
                onFilter={setFilter}
                onRunSearchId={setRunSearchId}
                onRunSearch={runSearch}
                onSelect={select}
                onBulk={bulk}
                onGo={setPage}
              />
            </section>
            {selected ? (
              <>
                <section aria-label={t("paneDetails")} className={`${show("detail")} min-h-0 flex-1 flex-col border-line lg:h-full lg:border-r`}>
                  <JobDetail
                    job={selected}
                    result={result}
                    busy={busy}
                    error={error}
                    hasCv={hasCv}
                    fitBusy={fitBusy}
                    hasCover={hasCover}
                    onCoverChanged={() => { reload(); setVersion((v) => v + 1); }}
                    onGoCover={() => setPage("cover")}
                    onBookmark={() => bulk([selected.id], { bookmarked: !selected.bookmarked })}
                    onFit={() => analyzeFit(selected.id)}
                    onStatus={setStatus}
                    onBack={() => setPane("list")}
                    onGoCv={() => setPage("cv")}
                    onTailor={(o) => tailor({ jobId: selected.id, ...o })}
                  />
                </section>
                <section aria-label={t("panePdf")} className={`${show("pdf")} min-h-0 flex-1 flex-col lg:h-full`}>
                  <div className="min-h-0 flex-1"><PdfPanel job={selected} version={version} /></div>
                </section>
              </>
            ) : (
              <div className="hidden items-center justify-center p-8 text-sm text-muted lg:col-span-2 lg:flex">{t("selectJob")}</div>
            )}
            {selected && pane !== "list" && (
              <div className="seg mx-auto my-2 shrink-0 shadow-[var(--shadow)] lg:hidden" role="group" aria-label={t("paneDetails")}>
                <button aria-pressed={pane === "detail"} onClick={() => setPane("detail")}>{t("paneDetails")}</button>
                <button aria-pressed={pane === "pdf"} onClick={() => setPane("pdf")}>{t("panePdf")}</button>
              </div>
            )}
          </div>
        )}
        {page === "applications" && <Applications jobs={jobs} onOpenJob={(id) => { setPage("jobs"); select(id); }} />}
        {page === "searches" && <SearchProfiles searches={searches} onChange={reload} />}
        {page === "cv" && <MyCv onSaved={setHasCv} />}
        {page === "cover" && <MyCv kind="cover" onSaved={setHasCover} />}
        {page === "manual" && <ManualJob busy={busy} error={error} onSubmit={(m: ManualInput) => tailor({ ...m, aggressive: true })} />}
      </main>
    </div>
  );
}
