# Resume Analyzer

Lokales Ein-Nutzer-Tool, das LinkedIn-Stellenanzeigen sucht und deinen LaTeX-Lebenslauf mit Gemini auf eine gewählte Stelle zuschneidet. Das Ergebnis wird direkt als PDF-Vorschau angezeigt. Die Oberfläche ist auf Deutsch.

## Funktionen

- **Suchprofile:** LinkedIn-Suchen (Stichwort, Ort, Radius) speichern und erneut ausführen.
- **Jobliste:** Treffer mit einer einfachen lokalen Bewertung (Titel-Überlappung mit dem CV).
- **Passungsanalyse:** Auf Wunsch bewertet Gemini eine Stelle mit Score, Fazit sowie Pro- und Contra-Punkten.
- **CV-Anpassung:** Gemini schreibt den Inhalt deines LaTeX-CVs für die Stelle um. Änderungen werden aufgelistet, das Ergebnis wird kompiliert und als PDF angezeigt.
- **Manuelle Eingabe:** Stellentext einfügen, falls LinkedIn die Abfrage blockiert.
- **AI-Filter:** Pro Suchprofil beschreibst du in Freitext, was du suchst (z. B. nur Softwareentwicklung, kein Consulting). Gemini sortiert neue Treffer nach Titel, Firma und Ort aus. Im Reiter „AI-Filter“ siehst du die Begründungen und kannst Stellen wiederherstellen.
- **Anschreiben, Merken, Mehrfach-Ignorieren, Bewerbungsstand (Sankey).**
- **Bewerbungs-Agent:** Chrome-Extension, die eine Bewerbung selbstständig ausfüllt und vor dem Absenden um Erlaubnis fragt (siehe unten).
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

## Bewerbungs-Agent (Chrome-Extension)

1. `npm run dev` starten und unter „Profil“ deine Stammdaten eintragen (Button „Aus CV vorausfüllen“ hilft).
2. In Chrome `chrome://extensions` öffnen, den Entwicklermodus einschalten, „Entpackte Erweiterung laden“ und den Ordner `extension/` wählen.
3. Die angezeigte Extension-ID unter „Profil“ eintragen.
4. In einer Stelle auf „Mit Agent bewerben“ klicken. Alternativ auf einer Bewerbungsseite das Extension-Popup öffnen und „Agent auf dieser Seite starten“ wählen.

Der Agent öffnet die Seite, klickt sich zum Formular durch, trägt Daten ein, lädt CV und Anschreiben hoch und geht mehrstufige Formulare durch. **Abgesendet wird erst nach deiner Bestätigung** in der Zusammenfassung. Danach landet die Bewerbung im Bewerbungsstand. Standardfelder werden ohne AI-Aufruf ausgefüllt, Gemini bekommt nur die offenen Felder (Free-Tier-schonend, Agent-Schritte laufen auf `GEMINI_MODEL_LITE`, Standard `gemini-3.5-flash-lite`, fällt bei Abkündigung auf `GEMINI_MODEL` zurück). Deine Kontaktdaten gehen nie an Gemini.

Wie der Agent Felder erkennt: Beschriftungen kommen aus `<label>`, `aria-label` oder, wenn beides fehlt, aus dem nächsten Label oder der nächsten Überschrift davor (so wird auch eine Dropzone unter „Lebenslauf“ erkannt). Jedes Dokument lädt er pro Lauf nur einmal hoch. Datumswerte aus dem Profil (`TT.MM.JJJJ`) wandelt er für Datumsfelder um. Autocomplete-Felder (z. B. Stadt) füllt er und klickt den passenden Vorschlag an. Felder ohne Beschriftung und Felder, deren Profilwert fehlt, rät er nicht, sondern fragt dich.

Grenzen: Bei Login, Captcha oder Account-Anlage pausiert der Agent und wartet auf dich. LinkedIn „Easy Apply“ wird bewusst nicht automatisiert. Eigene Auswahlfelder ohne echtes `<select>`, Datumsfelder aus drei getrennten Auswahlfeldern oder Formulare in fremden iframes können Handarbeit brauchen. Wenn eine Seite nicht klappt, im Popup „Seitenanalyse kopieren“ wählen: Das kopiert, welche Felder (Beschriftungen und Typen, keine Werte) der Agent sieht. Zum gefahrlosen Ausprobieren gibt es ein Testformular unter http://localhost:3000/test-form.html (sendet nichts).

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
