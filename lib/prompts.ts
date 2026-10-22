export interface TailorPromptInput {
  job: { title: string; company: string; location: string; description: string };
  body: string;
  adoptLanguage: boolean;
  aggressive: boolean;
}

export function tailorPrompt({ job, body, adoptLanguage, aggressive }: TailorPromptInput) {
  return `Du bist ein Lektor und LaTeX-Experte. Passe den Lebenslauf (LaTeX-Body) minimal-invasiv an die Stellenanzeige an. Der Lebenslauf muss danach immer noch genau so klingen und aussehen wie das Original: die Formulierungen stammen vom Bewerber, nicht von dir.

STELLENANZEIGE
Titel: ${job.title}
Firma: ${job.company}
Ort: ${job.location}
Beschreibung:
${job.description}

LEBENSLAUF (LaTeX, ab \\begin{document}):
${body}

REGELN
- Der aktuelle Lebenslauf ist die Basis. ${
    aggressive
      ? "Du darfst Skills, Tools, Methoden und Aufgaben aus der Anzeige in Profil/Summary, Skills-Bereich und bestehende Stationen und Projekte einbauen, auch wenn sie dort nicht ausdrücklich stehen. Der Bewerber bestätigt, dass er alle diese Fähigkeiten besitzt. Ergänzungen müssen sich im Stil der umgebenden Zeilen lesen."
      : "Betone und sortiere Relevantes, ändere Formulierungen nur dort, wo ein Keyword der Anzeige sonst fehlt. Ergänze Skills nur, wenn sie aus dem bestehenden CV plausibel ableitbar sind."
  }
- Übernimm die wichtigsten Keywords der Anzeige wörtlich (ATS).
- STIL (wichtigste Regel): Übernimm den Formulierungsstil des Originals strikt: Satzlänge, Wortwahl, Stichpunkt- bzw. Nominalstil, Zeitform und Grad der Detailtiefe. Keine Ich-Form, keine Marketing-Adjektive oder Floskeln (z. B. „leidenschaftlich“, „ausgeprägt“, „dynamisch“), wenn sie im Original nicht vorkommen.
- Verwende bestehende Sätze und Bullet Points bevorzugt wieder und flechte nur Keywords ein oder stelle um. Schreibe nichts komplett neu. Das Profil/Summary wird nur angepasst (Schwerpunkt, Keywords), nicht neu verfasst.
- Gleiche Abschnitte in gleicher Reihenfolge, gleiche Anzahl Bullet Points pro Station (höchstens ±1). Relevantes darf innerhalb einer Station nach oben rücken.
- Ändere keine Formatierung (\\textbf, \\small, Listenart, Trennzeichen), die im Original nicht genauso verwendet wird.
- NICHT verändern oder erfinden: Arbeitgeber, Jobtitel, Zeiträume/Daten, Abschlüsse, Hochschulen, Noten, Zertifikate, Namen, Kontaktdaten.
- Platzhalter wie CONTACT_EMAIL_1 oder CONTACT_PHONE_2 unverändert lassen.
- Behalte die LaTeX-Struktur und die vorhandenen Makros bei (keine neuen Pakete, keine neuen Makros). Sonderzeichen im Fließtext zwingend escapen: C# → C\\#, 50% → 50\\%, R&D → R\\&D, snake_case → snake\\_case.
- Länge höchstens wie das Original, damit die Seitenzahl nicht steigt.
- ${adoptLanguage ? "Schreibe den gesamten CV in der Sprache der Stellenanzeige." : "Behalte die Sprache des CV bei."}
- "body" muss mit \\begin{document} beginnen und mit \\end{document} enden.
- "changes": liste jede inhaltliche Änderung kurz auf (section, type: rewritten | added | reordered, text). Alles, was im Original-CV nicht stand, ist type "added".
- "keywordsUsed": die übernommenen Keywords der Anzeige.`;
}

export function repairPrompt(body: string, log: string) {
  return `Der folgende LaTeX-Body lässt sich nicht kompilieren. Behebe nur den Fehler, ändere sonst nichts am Inhalt. Gib den vollständigen korrigierten Body zurück (beginnt mit \\begin{document}, endet mit \\end{document}).

FEHLERLOG:
${log}

BODY:
${body}`;
}

export interface CoverPromptInput {
  job: { title: string; company: string; location: string; description: string };
  cover: string;
  cv: string;
  adoptLanguage: boolean;
  hints?: string;
}

export function coverPrompt({ job, cover, cv, adoptLanguage, hints }: CoverPromptInput) {
  return `Du bist ein Lektor und LaTeX-Experte. Passe das Basis-Anschreiben des Bewerbers (LaTeX-Body) an die Stellenanzeige an. Das Anschreiben muss danach immer noch genau so klingen wie das Original: die Formulierungen stammen vom Bewerber, nicht von dir.

STELLENANZEIGE
Titel: ${job.title}
Firma: ${job.company}
Ort: ${job.location}
Beschreibung:
${job.description}

BASIS-ANSCHREIBEN (LaTeX, ab \\begin{document}):
${cover}

LEBENSLAUF (nur als Faktenquelle):
${cv}

REGELN
- Übernimm Stil, Tonfall, Länge und Absatzzahl des Basis-Anschreibens strikt. Verwende vorhandene Sätze wieder und ändere nur, was für die Stelle nötig ist.
- Passe Firma, Position, Ansprechpartner/Anrede, Betreff und Datum-Platzhalter an die Stelle an.
- Stelle den Bezug zur Anzeige nur mit Fakten aus dem Lebenslauf her. Erfinde keine Stationen, Skills, Zahlen oder Motive.
- Keine Floskeln und Marketing-Adjektive, die im Basis-Anschreiben nicht vorkommen.${hints?.trim() ? `\n- Hinweise des Bewerbers (berücksichtigen): ${hints.trim()}` : ""}
- Platzhalter wie CONTACT_EMAIL_1 oder CONTACT_PHONE_2 unverändert lassen. Name und Adresse nicht ändern.
- Behalte die LaTeX-Struktur und Makros bei (keine neuen Pakete oder Makros). Sonderzeichen im Fließtext escapen: C# → C\\#, 50% → 50\\%, R&D → R\\&D, snake_case → snake\\_case.
- ${adoptLanguage ? "Schreibe das Anschreiben in der Sprache der Stellenanzeige." : "Behalte die Sprache des Basis-Anschreibens bei."}
- "body" muss mit \\begin{document} beginnen und mit \\end{document} enden.
- "changes": liste jede inhaltliche Änderung kurz auf (section, type: rewritten | added | reordered, text). Alles, was im Basis-Anschreiben nicht stand, ist type "added".`;
}
