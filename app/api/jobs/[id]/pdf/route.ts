import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { compileLatex, splitCv } from "@/lib/latex";
import { readOutput } from "@/lib/output";
import { getCv } from "@/lib/store";

// Compiling takes seconds, so the original CV PDF is cached per source hash.
const originalPdfCache = new Map<string, Buffer>();

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  const which = q.get("which") === "original" ? "original" : "tailored";
  const format = q.get("format") === "tex" ? "tex" : "pdf";
  const download = q.has("download");

  let data: Buffer | null;
  if (which === "original") {
    const tex = await getCv();
    if (!tex) return NextResponse.json({ error: "Kein CV gespeichert" }, { status: 404 });
    if (format === "tex") data = Buffer.from(tex);
    else {
      splitCv(tex);
      const key = createHash("sha1").update(tex).digest("hex");
      let pdf = originalPdfCache.get(key);
      if (!pdf) {
        const r = await compileLatex(tex);
        if (!r.ok) return NextResponse.json({ error: r.log }, { status: 422 });
        pdf = r.pdf;
        originalPdfCache.set(key, pdf);
      }
      data = pdf;
    }
  } else {
    data = await readOutput(id, format === "tex" ? "cv.tex" : "cv.pdf");
  }
  if (!data) return NextResponse.json({ error: "Noch nicht erstellt" }, { status: 404 });

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "text/plain; charset=utf-8",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="cv-${which}-${id}.${format}"`,
    },
  });
}
