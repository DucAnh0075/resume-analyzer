"use client";
import { useEffect, useState } from "react";
import { useI18n, type Key } from "@/lib/i18n";
import type { Profile } from "@/lib/types";
import { api, post } from "./api";
import Field from "./Field";
import Icon from "./Icon";

export const EXT_KEY = "extensionId";

type TextKey = Exclude<keyof Profile, "answers">;
const FIELDS: [TextKey, Key, "half" | "full"][] = [
  ["firstName", "profFirst", "half"], ["lastName", "profLast", "half"],
  ["email", "profEmail", "half"], ["phone", "profPhone", "half"],
  ["street", "profStreet", "full"], ["zip", "profZip", "half"], ["city", "profCity", "half"], ["country", "profCountry", "half"],
  ["birthDate", "profBirth", "half"], ["nationality", "profNationality", "half"],
  ["workPermit", "profPermit", "half"], ["salaryExpectation", "profSalary", "half"],
  ["earliestStart", "profStart", "half"], ["noticePeriod", "profNotice", "half"],
  ["workHours", "profHours", "full"], ["languages", "profLanguages", "full"],
  ["linkedin", "profLinkedin", "half"], ["github", "profGithub", "half"], ["website", "profWebsite", "half"],
];

export default function MyProfile() {
  const { t } = useI18n();
  const [extId, setExtId] = useState("");
  const [p, setP] = useState<Profile>();
  const [msg, setMsg] = useState<{ text: string; error?: boolean }>({ text: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<Profile>("/api/profile").then(setP);
    try { setExtId(localStorage.getItem(EXT_KEY) ?? ""); } catch {}
  }, []);

  if (!p) return null;

  const set = (k: TextKey, v: string) => setP({ ...p, [k]: v });

  async function save() {
    try {
      await post("/api/profile", p);
      setMsg({ text: t("profSaved") });
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    }
  }

  async function fromCv() {
    setBusy(true);
    setMsg({ text: "" });
    try {
      setP(await post<Profile>("/api/profile/from-cv", {}));
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true });
    } finally {
      setBusy(false);
    }
  }

  const setAnswer = (i: number, patch: Partial<Profile["answers"][number]>) =>
    setP({ ...p, answers: p.answers.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <h2 className="text-lg font-semibold">{t("profTitle")}</h2>
        <p className="mt-1 text-sm text-muted">{t("profHint")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn" disabled={busy} onClick={fromCv}>
          {busy ? <span className="spinner" aria-hidden /> : <Icon name="spark" />} {t("profFromCv")}
        </button>
        <button className="btn btn-primary" onClick={save}>{t("profSave")}</button>
        <span role="status" className={`text-sm ${msg.error ? "text-red-ink" : "text-muted"}`}>{msg.text}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(([k, label, width]) => (
          <div key={k} className={width === "full" ? "sm:col-span-2" : ""}>
            <Field label={t(label)}>{(id) => <input id={id} className="input" value={(p[k] as string | undefined) ?? ""} onChange={(e) => set(k, e.target.value)} />}</Field>
          </div>
        ))}
      </div>

      <section className="space-y-2" aria-label={t("profAnswers")}>
        <h3 className="text-sm font-semibold">{t("profAnswers")}</h3>
        <p className="text-xs text-muted">{t("profAnswersHint")}</p>
        {p.answers.map((a, i) => (
          <div key={i} className="grid gap-2 rounded-lg border border-line bg-surface p-3 sm:grid-cols-[1fr_1fr_auto]">
            <input className="input" aria-label={t("profQuestion")} placeholder={t("profQuestion")} value={a.question} onChange={(e) => setAnswer(i, { question: e.target.value })} />
            <input className="input" aria-label={t("profAnswer")} placeholder={t("profAnswer")} value={a.answer} onChange={(e) => setAnswer(i, { answer: e.target.value })} />
            <button className="btn btn-ghost text-red-ink" onClick={() => setP({ ...p, answers: p.answers.filter((_, j) => j !== i) })}>{t("delete")}</button>
          </div>
        ))}
        <button className="btn" onClick={() => setP({ ...p, answers: [...p.answers, { question: "", answer: "" }] })}><Icon name="plus" /> {t("profAddAnswer")}</button>
      </section>

      <section className="max-w-md">
        <Field label={t("profExtId")} hint={t("profExtHint")}>
          {(id) => <input id={id} className="input font-mono text-xs" value={extId} spellCheck={false} onChange={(e) => { setExtId(e.target.value.trim()); try { localStorage.setItem(EXT_KEY, e.target.value.trim()); } catch {} }} />}
        </Field>
      </section>
    </div>
  );
}
