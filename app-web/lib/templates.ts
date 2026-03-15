// Frontend template metadata.
// The actual LaTeX generation is now fully instruction-based (see app-api/src/lib/templates.ts).
// This file contains only the UI-relevant metadata: name, description, preview, and Pro flag.

export type TemplateCategory = "cheatsheet" | "notes" | "problem" | "paper" | "report";

export type Template = {
  id: string;
  name: string;
  description: string;
  isPro: boolean;
  category: TemplateCategory;
  thumbnailPath: string;
  previewPath: string;
};

export const templates: Template[] = [
  // ==================== FREE ====================
  {
    id: "landscape_3col_maths",
    name: "Landscape 3 columns (Maths)",
    description: "Compact 3-column landscape layout ideal for math formulas and summaries.",
    isPro: false,
    category: "cheatsheet",
    thumbnailPath: "/templates/previews/3cols_landscape.png",
    previewPath: "/templates/previews/3cols_landscape_Template_Calculus.pdf",
  },
  {
    id: "2cols_portrait",
    name: "Portrait 2 columns",
    description: "Classic 2-column portrait layout for any technical cheat-sheet.",
    isPro: false,
    category: "cheatsheet",
    thumbnailPath: "/templates/previews/2cols_portrait.png",
    previewPath: "/templates/previews/2cols_portrait_QED_For_Hadrons.pdf",
  },
  {
    id: "cornell",
    name: "Cornell Notes System",
    description: "Guided note-taking with keyword cues in the left margin and a summary box.",
    isPro: false,
    category: "notes",
    thumbnailPath: "/templates/previews/cornell.png",
    previewPath: "/templates/previews/cornell.pdf",
  },
  {
    id: "problem_solving",
    name: "Problem Solving Sheet (STEM)",
    description: "Structured blocks for engineering and physics exercises with result boxes.",
    isPro: false,
    category: "problem",
    thumbnailPath: "/templates/previews/problem_solving.png",
    previewPath: "/templates/previews/problem_solving.pdf",
  },
  {
    id: "zettelkasten",
    name: "Zettelkasten Cards",
    description: "Knowledge card grid — each card is a self-contained concept with cross-links.",
    isPro: false,
    category: "notes",
    thumbnailPath: "/templates/previews/zettelkasten.png",
    previewPath: "/templates/previews/zettelkasten.pdf",
  },
  // ==================== PRO ====================
  {
    id: "academic_paper",
    name: "Academic Research Paper",
    description: "Two-column research paper with theorems, proofs, and bibliography (AMS style).",
    isPro: true,
    category: "paper",
    thumbnailPath: "/templates/previews/academic_paper.png",
    previewPath: "/templates/previews/academic_paper.pdf",
  },
  {
    id: "lab_report",
    name: "Technical Lab Report",
    description: "Experimental report with error analysis, SI units, and data tables.",
    isPro: true,
    category: "report",
    thumbnailPath: "/templates/previews/lab_report.png",
    previewPath: "/templates/previews/lab_report.pdf",
  },
  {
    id: "data_analysis",
    name: "Data Analysis Report",
    description: "Statistical analysis report with code blocks, metrics tables, and ML formulas.",
    isPro: true,
    category: "report",
    thumbnailPath: "/templates/previews/data_analysis.png",
    previewPath: "/templates/previews/data_analysis.pdf",
  },
];

/** Get a template by ID — returns undefined if not found */
export function getTemplate(id: string): Template | undefined {
  return templates.find((t) => t.id === id);
}

/** Free templates only */
export const freeTemplates = templates.filter((t) => !t.isPro);

/** Pro templates only */
export const proTemplates = templates.filter((t) => t.isPro);
