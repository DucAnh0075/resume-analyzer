"use client";
import { sankey, sankeyLeft, sankeyLinkHorizontal } from "d3-sankey";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SANKEY_NODES, sankeyFlows, STAGES, type SankeyNode } from "@/lib/sankey";
import { useI18n, type Key } from "@/lib/i18n";
import type { AppStage, Application, Job } from "@/lib/types";
import { api, post } from "./api";
import Field from "./Field";

const NODE_KEY: Record<SankeyNode, Key> = {
  beworben: "stBeworben",
  ausstehend: "stAusstehend",
  keine_antwort: "stKeineAntwort",
  interview: "stInterview",
  absage: "stAbsage",
  angebot: "stAngebot",
  angenommen: "stAngenommen",
  abgelehnt: "stAbgelehnt",
};
const STAGE_KEY: Record<AppStage, Key> = NODE_KEY;

// Color follows the stage, never its position: positive outcomes teal/violet, negative red/amber, neutral gray.
const NODE_COLOR: Record<SankeyNode, string> = {
  beworben: "var(--ink)",
  ausstehend: "var(--line-strong)",
  keine_antwort: "var(--muted)",
  interview: "var(--accent)",
  absage: "var(--red-ink)",
  angebot: "var(--violet-ink)",
  angenommen: "var(--accent)",
  abgelehnt: "var(--amber-ink)",
};

const W = 760;
const H = 340;
const LABEL_W = 130;

export default function Applications({ jobs, onOpenJob }: { jobs: Job[]; onOpenJob: (id: string) => void }) {
  const { t } = useI18n();
  const [apps, setApps] = useState<Application[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    try {
      setApps(await api<Application[]>("/api/applications"));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoaded(true);
    }
  }, []);
  useEffect(() => { load(); }, [load, jobs]);

  const kpi = useMemo(() => {
    const ever = (a: Application, ...s: AppStage[]) => s.some((x) => a.stage === x || a.history.some((h) => h.stage === x));
    const n = apps.length;
    const pct = (c: number) => (n ? `${Math.round((c / n) * 100)}%` : "–");
    return {
      total: String(n),
      reply: pct(apps.filter((a) => ever(a, "absage", "interview", "angebot", "angenommen", "abgelehnt")).length),
      interview: pct(apps.filter((a) => ever(a, "interview", "angebot", "angenommen", "abgelehnt")).length),
      offers: String(apps.filter((a) => ever(a, "angebot", "angenommen", "abgelehnt")).length),
    };
  }, [apps]);

  async function patch(id: string, body: Partial<Pick<Application, "stage" | "notes">>) {
    setApps((cur) => cur.map((a) => (a.id === id ? { ...a, ...body } : a)));
    await api(`/api/applications/${id}`, { method: "PATCH", body: JSON.stringify(body) }).catch((e) => setError(e.message));
    load();
  }

  async function remove(id: string) {
    await api(`/api/applications/${id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4">
      <h2 className="text-lg font-semibold">{t("appSankey")}</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([["appKpiTotal", kpi.total], ["appKpiReply", kpi.reply], ["appKpiInterview", kpi.interview], ["appKpiOffers", kpi.offers]] as [Key, string][]).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-line bg-surface p-3">
            <dt className="text-xs text-muted">{t(k)}</dt>
            <dd className="mt-0.5 text-2xl font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {error && <pre role="alert" className="whitespace-pre-wrap rounded-lg bg-red-soft p-3 text-xs text-red-ink">{error}</pre>}

      <section className="rounded-xl border border-line bg-surface p-3" aria-label={t("appSankey")}>
        {apps.length ? <SankeyChart apps={apps} /> : loaded && <p className="p-4 text-sm text-muted">{t("appEmpty")}</p>}
      </section>

      <section aria-label={t("appTable")} className="space-y-2">
        <h3 className="text-sm font-semibold">{t("appTable")}</h3>
        {apps.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">{t("aCompany")} · {t("aTitle")}</th>
                  <th className="px-3 py-2 font-medium">{t("appDate")}</th>
                  <th className="px-3 py-2 font-medium">{t("appStage")}</th>
                  <th className="px-3 py-2 font-medium">{t("appNotes")}</th>
                  <th className="px-3 py-2"><span className="sr-only">{t("delete")}</span></th>
                </tr>
              </thead>
              <tbody>
                {apps.map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium">{a.company}</div>
                      <div className="text-xs text-muted">
                        {a.jobId && jobs.some((j) => j.id === a.jobId) ? (
                          <button className="underline decoration-line-strong underline-offset-2" onClick={() => onOpenJob(a.jobId!)} title={t("appOpenJob")}>{a.title}</button>
                        ) : a.url ? (
                          <a className="underline decoration-line-strong underline-offset-2" href={a.url} target="_blank" rel="noreferrer">{a.title}</a>
                        ) : a.title}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted">{new Date(a.appliedAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2">
                      <select className="input h-8" aria-label={t("appStage")} value={a.stage} onChange={(e) => patch(a.id, { stage: e.target.value as AppStage })}>
                        {STAGES.map((s) => <option key={s} value={s}>{t(STAGE_KEY[s])}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input className="input h-8" aria-label={t("appNotes")} defaultValue={a.notes ?? ""} onBlur={(e) => e.target.value !== (a.notes ?? "") && patch(a.id, { notes: e.target.value })} />
                    </td>
                    <td className="px-3 py-2 text-right"><button className="btn btn-ghost h-8 px-2 text-muted" onClick={() => remove(a.id)}>{t("delete")}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ExternalForm onAdded={load} onError={setError} />
    </div>
  );
}

function ExternalForm({ onAdded, onError }: { onAdded: () => void; onError: (m: string) => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ company: "", title: "", url: "", appliedAt: new Date().toISOString().slice(0, 10), stage: "beworben" as AppStage });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await post("/api/applications", f);
      setF({ ...f, company: "", title: "", url: "" });
      onAdded();
    } catch (err) {
      onError((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-surface p-4">
      <h3 className="text-sm font-semibold">{t("appExternal")}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label={t("aCompany")}>{(id) => <input id={id} className="input" required value={f.company} onChange={set("company")} />}</Field>
        <Field label={t("aTitle")}>{(id) => <input id={id} className="input" required value={f.title} onChange={set("title")} />}</Field>
        <Field label={t("aUrl")}>{(id) => <input id={id} className="input" type="url" value={f.url} onChange={set("url")} />}</Field>
        <Field label={t("appDate")}>{(id) => <input id={id} className="input" type="date" value={f.appliedAt} onChange={set("appliedAt")} />}</Field>
        <Field label={t("appStage")}>
          {(id) => (
            <select id={id} className="input" value={f.stage} onChange={set("stage")}>
              {STAGES.map((s) => <option key={s} value={s}>{t(STAGE_KEY[s])}</option>)}
            </select>
          )}
        </Field>
      </div>
      <button className="btn btn-primary" type="submit">{t("appAdd")}</button>
    </form>
  );
}

interface NodeDatum { name: SankeyNode }
interface LinkDatum { source: SankeyNode; target: SankeyNode; value: number }

function SankeyChart({ apps }: { apps: Application[] }) {
  const { t } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const total = apps.length;

  const graph = useMemo(() => {
    const links: LinkDatum[] = sankeyFlows(apps);
    const used = new Set<SankeyNode>(links.flatMap((l) => [l.source, l.target]));
    const nodes: NodeDatum[] = SANKEY_NODES.filter((n) => used.has(n)).map((name) => ({ name }));
    return sankey<NodeDatum, LinkDatum>()
      .nodeId((d) => d.name)
      .nodeAlign(sankeyLeft)
      .nodeSort((a, b) => SANKEY_NODES.indexOf(a.name) - SANKEY_NODES.indexOf(b.name))
      .nodeWidth(14)
      .nodePadding(16)
      .extent([[4, 8], [W - LABEL_W, H - 8]])({ nodes, links: links.map((l) => ({ ...l })) });
  }, [apps]);

  const path = sankeyLinkHorizontal();
  const label = (n: SankeyNode) => t(NODE_KEY[n]);

  return (
    <div>
      <p className="px-1 pb-2 text-xs text-muted">{t("appSankeyDesc")} · {t("appFlows", { n: total })}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t("appSankey")}>
        <g fill="none">
          {graph.links.map((l, i) => {
            const s = l.source as unknown as NodeDatum, tg = l.target as unknown as NodeDatum;
            return (
              <path
                key={i}
                d={path(l) ?? undefined}
                stroke={NODE_COLOR[tg.name]}
                strokeOpacity={hover === null ? 0.28 : hover === i ? 0.6 : 0.1}
                strokeWidth={Math.max(1, l.width ?? 1)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ transition: "stroke-opacity 140ms var(--ease-out)" }}
              >
                <title>{`${label(s.name)} → ${label(tg.name)}: ${t("appFlowTip", { n: l.value, total })}`}</title>
              </path>
            );
          })}
        </g>
        {graph.nodes.map((n) => {
          const right = (n.x0 ?? 0) > W / 2 - 40;
          const x = right ? (n.x1 ?? 0) + 6 : (n.x1 ?? 0) + 6;
          return (
            <g key={n.name}>
              <rect x={n.x0} y={n.y0} width={(n.x1 ?? 0) - (n.x0 ?? 0)} height={Math.max(1, (n.y1 ?? 0) - (n.y0 ?? 0))} rx={3} fill={NODE_COLOR[n.name]} />
              <text x={x} y={((n.y0 ?? 0) + (n.y1 ?? 0)) / 2} dy="0.35em" fontSize={12} fill="var(--ink)">
                {label(n.name)} <tspan fill="var(--muted)" className="tabular-nums">{n.value}</tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
