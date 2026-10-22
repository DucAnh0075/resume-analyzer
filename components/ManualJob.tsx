"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import Field from "./Field";

export interface ManualInput { url?: string; text?: string; title?: string; company?: string }

export default function ManualJob({ busy, error, onSubmit }: { busy: boolean; error?: string; onSubmit: (m: ManualInput) => void }) {
  const { t } = useI18n();
  const [m, setM] = useState<ManualInput>({});
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(m); }}
      className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold">{t("manualTitle")}</h2>
        <p className="mt-1 max-w-[60ch] text-sm text-muted">{t("manualBody")}</p>
      </div>
      <Field label={t("mUrl")}>{(id) => <input id={id} type="url" className="input" placeholder="https://www.linkedin.com/jobs/view/…" value={m.url ?? ""} onChange={(e) => setM({ ...m, url: e.target.value })} />}</Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("mTitle")}>{(id) => <input id={id} className="input" value={m.title ?? ""} onChange={(e) => setM({ ...m, title: e.target.value })} />}</Field>
        <Field label={t("mCompany")}>{(id) => <input id={id} className="input" value={m.company ?? ""} onChange={(e) => setM({ ...m, company: e.target.value })} />}</Field>
      </div>
      <Field label={t("mText")}>{(id) => <textarea id={id} className="input h-56" value={m.text ?? ""} onChange={(e) => setM({ ...m, text: e.target.value })} />}</Field>
      {error && <pre role="alert" className="whitespace-pre-wrap rounded-lg bg-red-soft p-3 text-sm text-red-ink">{error}</pre>}
      <button type="submit" disabled={busy || (!m.url?.trim() && !m.text?.trim())} className="btn btn-primary">
        {busy && <span className="spinner" aria-hidden />} {busy ? t("tailoring") : t("mSubmit")}
      </button>
    </form>
  );
}
