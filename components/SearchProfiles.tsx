"use client";
import { useState } from "react";
import { useI18n, type Key } from "@/lib/i18n";
import type { Experience, Posted, SearchProfile, Workplace } from "@/lib/types";
import { api, post } from "./api";
import Field from "./Field";

const EMPTY: SearchProfile = {
  id: "", name: "", keywords: "", location: "", radiusKm: 25, postedWithin: "week",
  workplace: [], experience: [], excludeKeywords: [], maxResults: 50,
};
const WORKPLACE: [Workplace, Key][] = [["onsite", "wpOnsite"], ["hybrid", "wpHybrid"], ["remote", "wpRemote"]];
const EXPERIENCE: [Experience, Key][] = [
  ["internship", "expInternship"], ["entry", "expEntry"], ["associate", "expAssociate"],
  ["mid-senior", "expMidSenior"], ["director", "expDirector"], ["executive", "expExecutive"],
];
const POSTED: [Posted, Key][] = [["24h", "posted24h"], ["week", "postedWeek"], ["month", "postedMonth"], ["any", "postedAny"]];

function toggle<T>(list: T[], v: T) {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function CheckGroup<T extends string>({ legend, options, value, onChange }: { legend: string; options: [T, Key][]; value: T[]; onChange: (v: T[]) => void }) {
  const { t } = useI18n();
  return (
    <fieldset>
      <legend className="field-label">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, k]) => (
          <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-1.5 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft">
            <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={value.includes(v)} onChange={() => onChange(toggle(value, v))} />
            {t(k)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export default function SearchProfiles({ searches, onChange }: { searches: SearchProfile[]; onChange: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState<SearchProfile>(EMPTY);
  const [err, setErr] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await post("/api/searches", form);
      setForm(EMPTY);
      setErr("");
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8 p-4 sm:p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <form onSubmit={save} className="space-y-4">
        <h2 className="text-lg font-semibold">{form.id ? t("searchesEdit") : t("searchesNew")}</h2>
        <Field label={t("fName")}>{(id) => <input id={id} className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
        <Field label={t("fKeywords")}>{(id) => <input id={id} required className="input" placeholder={t("fKeywordsPh")} value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} />}</Field>
        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <Field label={t("fLocation")}>{(id) => <input id={id} className="input" placeholder={t("fLocationPh")} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />}</Field>
          <Field label={t("fRadius")}>{(id) => <input id={id} className="input" type="number" min={0} value={form.radiusKm} onChange={(e) => setForm({ ...form, radiusKm: Number(e.target.value) })} />}</Field>
        </div>
        <Field label={t("fPosted")}>
          {(id) => (
            <select id={id} className="input" value={form.postedWithin} onChange={(e) => setForm({ ...form, postedWithin: e.target.value as Posted })}>
              {POSTED.map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
            </select>
          )}
        </Field>
        <CheckGroup legend={t("fWorkplace")} options={WORKPLACE} value={form.workplace} onChange={(v) => setForm({ ...form, workplace: v })} />
        <CheckGroup legend={t("fExperience")} options={EXPERIENCE} value={form.experience} onChange={(v) => setForm({ ...form, experience: v })} />
        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <Field label={t("fExclude")} hint={t("fExcludeHint")}>
            {(id) => <input id={id} className="input" placeholder={t("fExcludePh")} value={form.excludeKeywords.join(", ")} onChange={(e) => setForm({ ...form, excludeKeywords: e.target.value.split(",").map((s) => s.trim()) })} />}
          </Field>
          <Field label={t("fMax")}>{(id) => <input id={id} className="input" type="number" min={10} max={100} value={form.maxResults} onChange={(e) => setForm({ ...form, maxResults: Number(e.target.value) })} />}</Field>
        </div>
        {err && <p role="alert" className="text-sm text-red-ink">{err}</p>}
        <div className="flex gap-2">
          <button type="submit" className="btn btn-primary">{t("save")}</button>
          {form.id && <button type="button" className="btn" onClick={() => setForm(EMPTY)}>{t("cancel")}</button>}
        </div>
      </form>

      <section aria-labelledby="saved-h" className="space-y-3">
        <h2 id="saved-h" className="text-lg font-semibold">{t("searchesSaved")}</h2>
        {searches.length ? (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {searches.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{s.name}</p>
                  <p className="text-sm text-muted">{s.location || t("everywhere")} · {s.radiusKm} km · {t(POSTED.find(([v]) => v === s.postedWithin)![1])}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button className="btn btn-ghost" onClick={() => setForm(s)}>{t("edit")}</button>
                  <button className="btn btn-ghost text-red-ink" onClick={async () => { await api(`/api/searches?id=${s.id}`, { method: "DELETE" }); onChange(); }}>{t("delete")}</button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("searchesNone")}</p>
        )}
      </section>
    </div>
  );
}
