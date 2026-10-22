"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { api, post } from "./api";
import Field from "./Field";
import Icon from "./Icon";

export default function MyCv({ kind = "cv", onSaved }: { kind?: "cv" | "cover"; onSaved: (has: boolean) => void }) {
  const endpoint = kind === "cv" ? "/api/cv" : "/api/cover";
  const { t } = useI18n();
  const [tex, setTex] = useState("");
  const [msg, setMsg] = useState<{ text: string; error?: boolean }>({ text: "" });
  const [v, setV] = useState(0);
  const [hasSaved, setHasSaved] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api<{ tex: string }>(endpoint).then((d) => {
      setTex(d.tex);
      setHasSaved(!!d.tex);
    });
  }, [endpoint]);
  useEffect(() => setLoaded(false), [v]);

  async function save() {
    try {
      await post(endpoint, { tex });
      setMsg({ text: t("cvSaved") });
      setHasSaved(true);
      onSaved(true);
      setV((x) => x + 1);
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    }
  }

  return (
    <div className="grid min-h-full gap-4 p-4 lg:h-full lg:grid-cols-2 lg:grid-rows-1">
      <div className="flex min-h-[24rem] flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="btn cursor-pointer">
            <Icon name="file" /> {t("cvUpload")}
            <input type="file" accept=".tex" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setTex(await f.text()); }} />
          </label>
          <button className="btn btn-primary" onClick={save} disabled={!tex.trim()}>{t("cvSave")}</button>
          <span role="status" className={`text-sm ${msg.error ? "text-red-ink" : "text-muted"}`}>{msg.text}</span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <Field label={t(kind === "cv" ? "cvEditor" : "coverEditor")}>
            {(id) => <textarea id={id} className="input h-full min-h-[20rem] flex-1 resize-none font-mono text-xs leading-5" value={tex} onChange={(e) => setTex(e.target.value)} spellCheck={false} placeholder={t(kind === "cv" ? "cvPlaceholder" : "coverPlaceholder")} />}
          </Field>
        </div>
      </div>
      <div className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border border-line bg-sunken">
        <div className="border-b border-line bg-surface px-3 py-2 text-sm font-medium">{t(kind === "cv" ? "cvOriginalPdf" : "coverBasePdf")}</div>
        <div className="relative min-h-0 flex-1">
          {hasSaved ? (
            <>
              {!loaded && <div role="status" className="absolute inset-0 grid place-items-center text-sm text-muted"><span className="flex items-center gap-2"><span className="spinner" aria-hidden /> {t("pdfCompiling")}</span></div>}
              <iframe key={`${kind}-${v}`} src={`/api/jobs/0/pdf?which=original&doc=${kind}&v=${v}`} onLoad={() => setLoaded(true)} title={t(kind === "cv" ? "cvOriginalPdf" : "coverBasePdf")} className={`h-full w-full transition-opacity duration-200 ease-out ${loaded ? "opacity-100" : "opacity-0"}`} />
            </>
          ) : (
            <p className="p-4 text-sm text-muted">{t(kind === "cv" ? "noCvBody" : "noCoverBody")}</p>
          )}
        </div>
      </div>
    </div>
  );
}
