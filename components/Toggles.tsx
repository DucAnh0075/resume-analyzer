"use client";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import Icon from "./Icon";

type Theme = "system" | "light" | "dark";
const ORDER: Theme[] = ["system", "light", "dark"];
const ICON = { system: "system", light: "sun", dark: "moon" } as const;

export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>("system");

  useEffect(() => {
    try {
      const s = localStorage.getItem("theme");
      if (s === "light" || s === "dark") setTheme(s);
    } catch {}
  }, []);

  function next() {
    const n = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
    setTheme(n);
    const root = document.documentElement;
    if (n === "system") root.removeAttribute("data-theme");
    else root.dataset.theme = n;
    try {
      if (n === "system") localStorage.removeItem("theme");
      else localStorage.setItem("theme", n);
    } catch {}
  }

  const label = theme === "system" ? t("themeSystem") : theme === "light" ? t("themeLight") : t("themeDark");
  return (
    <button className="btn btn-ghost btn-icon" onClick={next} aria-label={label} title={label}>
      <Icon name={ICON[theme]} />
    </button>
  );
}

export function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="seg" role="group" aria-label={t("language")}>
      {(["de", "en"] as const).map((l) => (
        <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} lang={l}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
