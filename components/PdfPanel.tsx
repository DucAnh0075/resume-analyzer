"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { Job } from "@/lib/types";
import Icon from "./Icon";

export default function PdfPanel({ job, version }: { job: Job; version: number }) {
  const { t } = useI18n();
  const [which, setWhich] = useState<"tailored" | "original">("tailored");
  const [loaded, setLoaded] = useState(false);
  const base = `/api/jobs/${job.id}/pdf?which=${which}`;
  const canShow = which === "original" || !!job.tailored;

  useEffect(() => setLoaded(false), [job.id, which, version]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
        <div className="seg" role="group" aria-label={t("pdfPreview")}>
          {(["tailored", "original"] as const).map((w) => (
            <button key={w} aria-pressed={which === w} onClick={() => setWhich(w)}>
              {w === "tailored" ? t("pdfTailored") : t("pdfOriginal")}
            </button>
          ))}
        </div>
        {canShow && (
          <div className="ml-auto flex gap-1">
            <a className="btn btn-ghost" href={`${base}&format=pdf&download`}><Icon name="download" /> PDF</a>
            <a className="btn btn-ghost" href={`${base}&format=tex&download`}><Icon name="file" /> .tex</a>
          </div>
        )}
      </div>
      <div className="relative min-h-0 flex-1 bg-sunken">
        {canShow ? (
          <>
            {!loaded && (
              <div role="status" className="absolute inset-0 grid place-items-center text-sm text-muted">
                <span className="flex items-center gap-2"><span className="spinner" aria-hidden /> {t("pdfCompiling")}</span>
              </div>
            )}
            <iframe
              key={`${job.id}-${which}-${version}`}
              src={`${base}&format=pdf&v=${version}`}
              onLoad={() => setLoaded(true)}
              title={t("pdfPreview")}
              className={`h-full w-full transition-opacity duration-200 ease-out ${loaded ? "opacity-100" : "opacity-0"}`}
            />
          </>
        ) : (
          <p className="p-4 text-sm text-muted">{t("pdfNone")}</p>
        )}
      </div>
    </div>
  );
}
