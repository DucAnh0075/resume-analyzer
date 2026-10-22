export interface TailorPromptInput {
  job: { title: string; company: string; location: string; description: string };
  body: string;
  adoptLanguage: boolean;
  aggressive: boolean;
}

export function tailorPrompt({ job, body, adoptLanguage, aggressive }: TailorPromptInput) {
  return `Du bist ein erfahrener Karriere-Coach und LaTeX-Experte. Passe den Lebenslauf (LaTeX-Body) so an die Stellenanzeige an, dass der Bewerber bei HR und ATS-Systemen heraussticht.

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
      ? "Du darfst frei umformulieren, umstrukturieren und Skills, Tools, Methoden und Aufgaben aus der Anzeige in Profil/Summary, Skills-Bereich und bestehende Stationen und Projekte einbauen, auch wenn sie dort nicht ausdrücklich stehen. Der Bewerber bestätigt, dass er alle diese Fähigkeiten besitzt."
      : "Formuliere um, sortiere um und betone Relevantes. Ergänze Skills nur, wenn sie aus dem bestehenden CV plausibel ableitbar sind."
  }
- Übernimm die wichtigsten Keywords der Anzeige wörtlich (ATS).
- Schreibe das Profil/Summary komplett auf diese Stelle zu. Bullet Points: starke Verben, konkrete Ergebnisse, Relevantes nach oben, Irrelevantes kürzen.
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
