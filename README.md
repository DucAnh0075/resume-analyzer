# Resume Analyzer

Lokales Ein-Nutzer-Tool, das LinkedIn-Stellenanzeigen sucht und deinen LaTeX-Lebenslauf mit Gemini auf eine gewählte Stelle zuschneidet. Das Ergebnis wird direkt als PDF-Vorschau angezeigt. Die Oberfläche ist auf Deutsch.

## Funktionen

- **Suchprofile:** LinkedIn-Suchen (Stichwort, Ort, Radius) speichern und erneut ausführen.
- **Jobliste:** Treffer mit einer einfachen lokalen Bewertung (Titel-Überlappung mit dem CV).
- **Passungsanalyse:** Auf Wunsch bewertet Gemini eine Stelle mit Score, Fazit sowie Pro- und Contra-Punkten.
- **CV-Anpassung:** Gemini schreibt den Inhalt deines LaTeX-CVs für die Stelle um. Änderungen werden aufgelistet, das Ergebnis wird kompiliert und als PDF angezeigt.
- **Manuelle Eingabe:** Stellentext einfügen, falls LinkedIn die Abfrage blockiert.
- **Mein CV:** Basis-CV als `.tex` im Browser bearbeiten, das Original lässt sich als PDF ansehen.

## Voraussetzungen

- Node.js 20 oder neuer
- LaTeX mit `latexmk` und `pdflatex` im `PATH` (z. B. TeX Live)
- Ein kostenloser Gemini-API-Key von [Google AI Studio](https://aistudio.google.com)

## Einrichtung

```bash
npm install
```

Lege eine Datei `.env.local` an:

```
GEMINI_API_KEY=dein-key
# optional, Standard ist gemini-2.5-flash
GEMINI_MODEL=gemini-2.5-flash
```

Starte den Dev-Server:

```bash
npm run dev
```

Die App läuft dann auf http://localhost:3000. Ein Beispiel-CV liegt in `examples/cv_example.tex`. Du kannst es unter „Mein CV“ als Ausgangspunkt einfügen.

## Befehle

```bash
npm run dev        # Dev-Server auf :3000
npm run build      # Produktions-Build
npm run start      # Produktions-Server
npm run typecheck  # TypeScript-Prüfung
```

## So funktioniert es

- **Keine Datenbank:** Suchprofile, Jobs und dein Basis-CV liegen als JSON/`.tex` in `data/`. Erzeugte CVs liegen in `output/<jobId>/`. Beide Ordner sind per `.gitignore` ausgeschlossen.
- **Datenschutz beim Anpassen:** Nur der Dokumentteil des CVs (nach `\begin{document}`) geht an Gemini. Die Präambel bleibt unberührt, E-Mail und Telefonnummer werden vorher maskiert und danach wieder eingesetzt.
- **Kompilierung:** Schlägt das Kompilieren fehl, versucht Gemini einmal anhand des Logs eine Reparatur.
- **LinkedIn:** Es werden die öffentlichen Gast-Endpunkte ohne Login genutzt. Bei Blockaden (429/999/403) bietet die App die manuelle Eingabe an. Die Abfrage basiert auf HTML-Selektoren und kann brechen, wenn LinkedIn sein Markup ändert.

## Technik

Next.js 15 (App Router), React 19, Tailwind CSS 3, `@google/genai`, cheerio, zod.

Siehe auch `CLAUDE.md` für Architekturdetails.
