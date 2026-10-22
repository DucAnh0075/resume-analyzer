"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Change, CoverResult, Job } from "@/lib/types";
import { api, post } from "./api";
import Icon from "./Icon";

interface Props {
  job: Job;
  hasCover: boolean;
  hasCv: boolean;
  onChanged: () => void;
  onGoCover: () => void;
}

const TYPE_CHIP: Record<Change["type"], string> = { added: "chip-amber", rewritten: "chip-accent", reordered: "" };

export default function CoverPanel({ job, hasCover, hasCv, onChanged, onGoCover }: Props) {
  const { t } = useI18n();
  const [tex, setTex] = useState("");
  const [saved, setSaved] = useState("");
  const [result, setResult] = useState<CoverResult | null>(null);
  const [hints, setHints] = useState("");
  const [adoptLanguage, setAdoptLanguage] = useState(false);
  const [busy, setBusy] = useState<"gen" | "save" | undefined>();
  const [msg, setMsg] = useState<{ text: string; error?: boolean }>({ text: "" });

  useEffect(() => {
    setMsg({ text: "" });
    api<{ tex: string; result: CoverResult | null }>(`/api/jobs/${job.id}/cover`).then((d) => {
      setTex(d.tex);
      setSaved(d.tex);
      setResult(d.result);
      setHints(d.result?.hints ?? "");
    });
  }, [job.id]);

  const typeLabel = { added: t("changeAdded"), rewritten: t("changeRewritten"), reordered: t("changeReordered") };

  async function run(kind: "gen" | "save") {
    setBusy(kind);
    setMsg({ text: "" });
    try {
      const d =
        kind === "gen"
          ? await post<{ tex: string; result: CoverResult }>(`/api/jobs/${job.id}/cover`, { adoptLanguage, hints })
          : await api<{ tex: string; result: CoverResult }>(`/api/jobs/${job.id}/cover`, { method: "PUT", body: JSON.stringify({ tex }) });
      setTex(d.tex);
      setSaved(d.tex);
      setResult(d.result);
      if (kind === "save") setMsg({ text: t("coverSaved") });
      onChanged();
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    } finally {
      setBusy(undefined);
    }
  }

  if (!hasCover || !hasCv) {
    return (
      <div className="max-w-[72ch] space-y-3">
        <p className="text-muted">{!hasCv ? t("noCvBody") : t("noCoverBody")}</p>
        {hasCv && <button className="btn btn-primary" onClick={onGoCover}>{t("noCoverAction")}</button>}
      </div>
    );
  }

  return (
    <div className="max-w-[72ch] space-y-4">
      <div className="space-y-2">
        <label className="field-label" htmlFor="cover-hints">{t("coverHints")}</label>
        <input id="cover-hints" className="input" value={hints} placeholder={t("coverHintsPh")} onChange={(e) => setHints(e.target.value)} />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button className="btn btn-primary" disabled={!!busy} onClick={() => run("gen")}>
            {busy === "gen" ? <span className="spinner" aria-hidden /> : <Icon name="spark" />}
            {busy === "gen" ? t("coverGenerating") : job.cover ? t("coverRegenerate") : t("coverGenerate")}
          </button>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={adoptLanguage} onChange={(e) => setAdoptLanguage(e.target.checked)} />
            {t("optLanguage")}
          </label>
        </div>
      </div>

      {tex ? (
        <>
          <div className="space-y-2">
            <label className="field-label" htmlFor="cover-tex">{t("coverEditor")}</label>
            <textarea id="cover-tex" className="input h-72 resize-y font-mono text-xs leading-5" spellCheck={false} value={tex} onChange={(e) => setTex(e.target.value)} />
            <div className="flex flex-wrap items-center gap-2">
              <button className="btn" disabled={!!busy || tex === saved} onClick={() => run("save")}>
                {busy === "save" && <span className="spinner" aria-hidden />} {t("coverSaveCompile")}
              </button>
              <span role="status" className={`text-sm ${msg.error ? "text-red-ink" : "text-muted"}`}>{!msg.error && msg.text}</span>
            </div>
            {msg.error && <pre role="alert" className="whitespace-pre-wrap break-words rounded-lg bg-red-soft p-3 text-xs text-red-ink">{msg.text}</pre>}
          </div>
          {result && result.changes.length > 0 && (
            <section aria-label={t("coverChanges")}>
              <h3 className="mb-2 text-sm font-semibold">{t("coverChanges")}</h3>
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
            </section>
          )}
        </>
      ) : (
        <div className="space-y-1">
          <p className="font-medium">{t("coverEmptyTitle")}</p>
          <p className="text-muted">{t("coverEmptyBody")}</p>
        </div>
      )}
      {msg.error && !tex && <pre role="alert" className="whitespace-pre-wrap break-words rounded-lg bg-red-soft p-3 text-xs text-red-ink">{msg.text}</pre>}
    </div>
  );
}
