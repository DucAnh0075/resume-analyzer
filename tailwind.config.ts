import type { Config } from "tailwindcss";

const v = (name: string) => `var(--${name})`;

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: v("bg"),
        surface: v("surface"),
        sunken: v("sunken"),
        line: v("line"),
        "line-strong": v("line-strong"),
        ink: v("ink"),
        muted: v("muted"),
        accent: v("accent"),
        "accent-ink": v("accent-ink"),
        "accent-soft": v("accent-soft"),
        "amber-soft": v("amber-soft"),
        "amber-ink": v("amber-ink"),
        "red-soft": v("red-soft"),
        "red-ink": v("red-ink"),
        "violet-soft": v("violet-soft"),
        "violet-ink": v("violet-ink"),
      },
      borderRadius: { xl: "0.875rem" },
      transitionTimingFunction: { out: "cubic-bezier(0.23, 1, 0.32, 1)" },
    },
  },
  plugins: [],
} satisfies Config;
