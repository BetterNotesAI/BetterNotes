import { z } from "zod";

const sectionSchema = z.object({
  heading: z.string().min(1).max(120),
  bullets: z.array(z.string().min(1).max(300)).min(1).max(10)
});

export const generatedDocumentSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(1200),
  sections: z.array(sectionSchema).min(1).max(12),
  equations: z.array(z.string().min(1).max(300)).max(12)
});

export type GeneratedDocument = z.infer<typeof generatedDocumentSchema>;

const latexEscapeMap: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  "$": "\\$",
  "&": "\\&",
  "#": "\\#",
  "%": "\\%",
  "_": "\\_",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}"
};

export function escapeLatexText(raw: string): string {
  return raw.replace(/[\\{}$&#%_~^]/g, (character) => latexEscapeMap[character] ?? character);
}

function toSectionsLatex(document: GeneratedDocument): string {
  return document.sections
    .map((section) => {
      const heading = `\\section*{${escapeLatexText(section.heading)}}`;
      const bullets = section.bullets
        .map((bullet) => `\\item ${escapeLatexText(bullet)}`)
        .join("\n");

      return `${heading}\n\\begin{itemize}\n${bullets}\n\\end{itemize}`;
    })
    .join("\n\n");
}

function toEquationsLatex(document: GeneratedDocument): string {
  if (document.equations.length === 0) {
    return "\\text{No equations detected.}";
  }

  return document.equations.join(" \\\\ ");
}

export function buildFallbackDocument(prompt: string, notes: string): GeneratedDocument {
  const lines = notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8);

  const bullets = lines.length > 0 ? lines : ["No input lines found. Add text or upload a PDF."];

  return {
    title: prompt ? `Notes: ${prompt.slice(0, 80)}` : "Study Notes",
    summary: notes.slice(0, 260) || "Generated from your uploaded notes.",
    sections: [
      {
        heading: "Key points",
        bullets
      }
    ],
    equations: []
  };
}

export function renderTemplate(templateSource: string, document: GeneratedDocument, prompt: string): string {
  const filled = templateSource
    .replaceAll("{TITLE}", escapeLatexText(document.title))
    .replaceAll("{PROMPT}", escapeLatexText(prompt || "No prompt provided"))
    .replaceAll("{SUMMARY}", escapeLatexText(document.summary))
    .replaceAll("{SECTIONS}", toSectionsLatex(document))
    .replaceAll("{EQUATIONS}", toEquationsLatex(document));

  if (filled.includes("\\end{document}")) {
    return filled;
  }

  return `${filled}\n\\end{document}`;
}
