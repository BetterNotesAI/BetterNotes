// app-api/src/lib/latex.ts
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { execFile } from "child_process";
import { extractExecOutput, makeHttpError, trimHugeLog } from "./errors";

const execFileAsync = promisify(execFile);

/* -------------------------
   tooling helpers
------------------------- */

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execFileAsync(process.platform === "win32" ? "where" : "which", [cmd], { timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function detectMissingStyPackage(log: string): string | null {
  if (!log) return null;
  const match = log.match(/File `([^`]+\.sty)' not found\./);
  if (!match?.[1]) return null;
  return match[1];
}

function buildMissingPackageMessage(packageFile: string): string {
  return [
    `LaTeX package missing: ${packageFile}.`,
    "Install the missing package in your TeX distribution (for example: tlmgr install <package>)",
    "or run app-api with Docker (its image already includes texlive-latex-extra).",
  ].join(" ");
}

/* -------------------------
   fallbacks (compilation-safety)
------------------------- */

export function stripMarkdownFences(text: string): string {
  const t = text.trim();
  if (t.startsWith("```")) {
    const lines = t.split("\n");
    lines.shift();
    if (lines.length && lines[lines.length - 1].trim() === "```") lines.pop();
    return lines.join("\n").trim();
  }
  return t;
}

export function injectTheoremFallbacks(latex: string): string {
  // IMPORTANT: we do NOT try to detect "theorem-style already exists" perfectly;
  // we just ensure required environments exist *somehow*.
  const envs = [
    { name: "definition", title: "Definition" },
    { name: "theorem", title: "Theorem" },
    { name: "lemma", title: "Lemma" },
    { name: "proposition", title: "Proposition" },
    { name: "corollary", title: "Corollary" },
    { name: "example", title: "Example" },
    { name: "remark", title: "Remark" },
    { name: "obs", title: "Observation" },
  ];

  // Check which environments are USED in the document
  // Regex matches \begin{envname} with optional whitespace
  const needs = envs.filter((env) => {
    const pattern = new RegExp(`\\\\begin\\s*\\{${env.name}\\}`);
    return pattern.test(latex);
  });
  if (!needs.length) return latex;

  // Check which environments are already DEFINED via \newtheorem{envname}
  const alreadyDefined = new Set<string>();
  for (const env of needs) {
    // Accept both \newtheorem{env} and \newtheorem*{env}
    const defPattern = new RegExp(`\\\\newtheorem\\*?\\s*\\{${env.name}\\}`);
    if (defPattern.test(latex)) {
      alreadyDefined.add(env.name);
    }
  }

  // Filter to only environments that need to be injected
  const toInject = needs.filter((env) => !alreadyDefined.has(env.name));
  if (!toInject.length) return latex;

  // Find \begin{document}
  const beginDocMatch = latex.match(/\\begin\s*\{document\}/);
  if (!beginDocMatch || beginDocMatch.index === undefined) return latex;

  // Check if amsthm is already loaded (handles \usepackage{amsthm} and \usepackage{amsmath,amsthm,...})
  const hasAmsthm = /\\usepackage\s*(\[[^\]]*\])?\s*\{[^}]*amsthm[^}]*\}/.test(latex);

  // Build injection block with proper LaTeX formatting
  const injectionLines: string[] = [];
  injectionLines.push("% BN_THEOREM_FALLBACKS");

  if (!hasAmsthm) {
    injectionLines.push("\\usepackage{amsthm}");
  }

  // Simple direct \newtheorem definitions
  // We've already filtered out environments that are already defined
  for (const env of toInject) {
    injectionLines.push(`\\newtheorem{${env.name}}{${env.title}}`);
  }

  const insertAt = beginDocMatch.index;
  return `${latex.slice(0, insertAt)}${injectionLines.join("\n")}\n\n${latex.slice(insertAt)}`;
}

export function stripDuplicateNewtheoremDefinitions(latex: string): string {
  const seen = new Set<string>();

  // Line-oriented on purpose: the common case is one-line \newtheorem declarations.
  return latex.replace(
    /^([ \t]*)\\newtheorem\*?\s*\{([A-Za-z@][A-Za-z0-9@:_-]*)\}([^\n]*)$/gm,
    (full, indent: string, envName: string) => {
      if (!envName) return full;
      if (!seen.has(envName)) {
        seen.add(envName);
        return full;
      }
      return `${indent}% BN_REMOVED_DUPLICATE_NEWTHEOREM{${envName}} ${full.trimStart()}`;
    }
  );
}

export function injectCommonMathFallbacks(latex: string): string {
  // Find \begin{document}
  const beginDocMatch = latex.match(/\\begin\s*\{document\}/);
  if (!beginDocMatch || beginDocMatch.index === undefined) return latex;

  const marker = "% BN_MATH_FALLBACKS";
  if (latex.includes(marker)) return latex;

  // Check for usage of custom math commands
  const wantsAbs = /\\abs\s*\{/.test(latex);
  const wantsNorm = /\\norm\s*\{/.test(latex);
  const wantsColoneqq = /\\coloneqq\b/.test(latex);
  const wantsGenerated = /\\generated\s*\{/.test(latex);
  const wantsSlashed = /\\slashed\s*\{/.test(latex);

  const defs: string[] = [marker];
  if (wantsAbs) defs.push("\\providecommand{\\abs}[1]{\\left|#1\\right|}");
  if (wantsNorm) defs.push("\\providecommand{\\norm}[1]{\\left\\|#1\\right\\|}");
  if (wantsColoneqq) defs.push("\\providecommand{\\coloneqq}{\\mathrel{:=}}");
  if (wantsGenerated) defs.push("\\providecommand{\\generated}[1]{(\\min\\{#1\\},\\max\\{#1\\})}");
  if (wantsSlashed) defs.push("\\providecommand{\\slashed}[1]{\\not\\!#1}");

  if (defs.length === 1) return latex;

  const injection = `${defs.join("\n")}\n`;
  const insertAt = beginDocMatch.index;
  return `${latex.slice(0, insertAt)}${injection}\n${latex.slice(insertAt)}`;
}

// Display math environments that can be opened by the AI
const DISPLAY_MATH_ENVS = new Set([
  "equation", "equation*", "align", "align*",
  "gather", "gather*", "multline", "multline*", "flalign", "flalign*",
]);

// Nested environments that must be closed before the outer display math ends
const NESTED_MATH_ENVS = new Set(["cases", "pmatrix", "bmatrix", "vmatrix", "array", "split", "aligned"]);

/**
 * Fix two common AI-generated LaTeX math errors:
 *  1. Unclosed \[ blocks: \[ ... \end{envname} without the matching \]
 *  2. Unclosed nested math environments: \begin{cases} ended by \end{equation} instead of \end{cases}
 */
export function fixUnclosedDisplayMath(latex: string): string {
  const lines = latex.split("\n");
  const result: string[] = [];
  let inDisplayMath = false;         // inside \[ ... \]
  let displayMathEnv: string | null = null; // inside \begin{equation} etc.
  const nestedStack: string[] = [];  // nested envs like cases, pmatrix inside display math

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect \[
    if (trimmed === "\\[") {
      inDisplayMath = true;
      result.push(line);
      continue;
    }

    // Detect \]
    if (trimmed === "\\]") {
      inDisplayMath = false;
      nestedStack.length = 0;
      result.push(line);
      continue;
    }

    // Detect \begin{envname}
    const beginMatch = trimmed.match(/^\\begin\{([^}]+)\}/);
    if (beginMatch) {
      const env = beginMatch[1];
      if (DISPLAY_MATH_ENVS.has(env)) {
        displayMathEnv = env;
        nestedStack.length = 0;
      } else if ((inDisplayMath || displayMathEnv) && NESTED_MATH_ENVS.has(env)) {
        nestedStack.push(env);
      }
      result.push(line);
      continue;
    }

    // Detect \end{envname}
    const endMatch = trimmed.match(/^\\end\{([^}]+)\}/);
    if (endMatch) {
      const env = endMatch[1];

      // Case 1: \] was missing — \end{something} while inside \[
      if (inDisplayMath && !NESTED_MATH_ENVS.has(env)) {
        result.push("\\]");
        inDisplayMath = false;
        nestedStack.length = 0;
      }

      // Case 2: closing a display math env but nested envs are still open
      if (displayMathEnv && DISPLAY_MATH_ENVS.has(env)) {
        while (nestedStack.length > 0) {
          result.push(`\\end{${nestedStack.pop()}}`);
        }
        displayMathEnv = null;
      }

      // Case 3: mismatched nested — e.g. \end{equation} while we expected \end{cases}
      if (displayMathEnv && !DISPLAY_MATH_ENVS.has(env) && NESTED_MATH_ENVS.has(nestedStack[nestedStack.length - 1] ?? "")) {
        // env doesn't match the top of stack — pop and close properly
        while (nestedStack.length > 0 && nestedStack[nestedStack.length - 1] !== env) {
          result.push(`\\end{${nestedStack.pop()}}`);
        }
        if (nestedStack.length > 0) nestedStack.pop();
      }

      result.push(line);
      continue;
    }

    result.push(line);
  }

  return result.join("\n");
}

// Theorem-like environments that the AI may forget to close before \end{multicols} / \end{document}
const CLOSEABLE_ENVS = new Set([
  "definition", "theorem", "lemma", "proposition", "corollary",
  "example", "example*", "exercise", "exercise*", "remark", "obs",
  "problem", "givendata", "approach", "solution", "proof",
  "workedexample", "keypoint", "warning",
  "tcolorbox", "minipage",
]);

/**
 * Ensure common theorem/box environments are closed before \end{multicols}, \end{multicols*},
 * or \end{document}, where LaTeX would otherwise error with "ended by \end{multicols}".
 */
export function fixUnclosedEnvironments(latex: string): string {
  const lines = latex.split("\n");
  const result: string[] = [];
  const envStack: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    const beginMatch = trimmed.match(/^\\begin\{([^}]+)\}/);
    if (beginMatch && CLOSEABLE_ENVS.has(beginMatch[1])) {
      envStack.push(beginMatch[1]);
      result.push(line);
      continue;
    }

    const endMatch = trimmed.match(/^\\end\{([^}]+)\}/);
    if (endMatch) {
      const closing = endMatch[1];
      if (CLOSEABLE_ENVS.has(closing)) {
        // Pop it from the stack (ignore mismatched pops)
        const idx = envStack.lastIndexOf(closing);
        if (idx !== -1) envStack.splice(idx, 1);
        result.push(line);
        continue;
      }
      // Closing a container env (multicols, document) — drain any unclosed inner envs first
      if (closing === "multicols" || closing === "multicols*" || closing === "document") {
        while (envStack.length > 0) {
          result.push(`\\end{${envStack.pop()}}`);
        }
      }
      result.push(line);
      continue;
    }

    result.push(line);
  }

  return result.join("\n");
}

// Tabular environments where & is valid as a column separator
const TABULAR_ENVS = new Set(["tabular", "tabularx", "array", "longtable", "tabu", "matrix",
  "pmatrix", "bmatrix", "vmatrix", "Bmatrix", "Vmatrix", "smallmatrix",
  "align", "align*", "alignat", "alignat*", "flalign", "flalign*",
  "cases", "rcases", "dcases", "split", "aligned", "gathered"]);

/**
 * Escape bare & characters in running text (titles, section names, prose).
 * Only applies AFTER \begin{document} and only on lines that are not LaTeX
 * command invocations (i.e., lines that don't start with \, %, or {\ ).
 * Skips lines inside tabular/math alignment environments where & is a column separator.
 */
export function escapeAmpersandsInText(latex: string): string {
  const lines = latex.split("\n");
  const result: string[] = [];
  let inDocument = false;
  let inTabular = false;
  let depth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^\\begin\s*\{document\}/.test(trimmed)) inDocument = true;
    if (/^\\end\s*\{document\}/.test(trimmed)) inDocument = false;

    const beginMatch = trimmed.match(/^\\begin\{([^}]+)\}/);
    if (beginMatch && TABULAR_ENVS.has(beginMatch[1])) {
      inTabular = true;
      depth++;
    }
    const endMatch = trimmed.match(/^\\end\{([^}]+)\}/);
    if (endMatch && TABULAR_ENVS.has(endMatch[1])) {
      depth = Math.max(0, depth - 1);
      if (depth === 0) inTabular = false;
    }

    const isCommandLine = trimmed.startsWith("\\") || trimmed.startsWith("%");
    const shouldEscape = inDocument && !inTabular && !isCommandLine && line.includes("&");

    if (shouldEscape) {
      result.push(line.replace(/(?<!\\)&/g, "\\&"));
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

export function keepLandscapeFooterInsideColumns(latex: string): string {
  const isLandscape3Col = /\\begin\s*\{multicols\*\}\s*\{3\}/.test(latex);
  if (!isLandscape3Col || !latex.includes("made with BetterNotes-AI")) return latex;

  const footerPattern =
    /\s*(?:%[^\n]*BetterNotes-AI[^\n]*\n)?\\begin\s*\{flushright\}\s*\\(?:tiny|scriptsize|footnotesize|small)?\s*\\textit\s*\{made with BetterNotes-AI\}\s*\\end\s*\{flushright\}\s*/g;

  let removedFooter = false;
  const withoutFooter = latex.replace(footerPattern, () => {
    removedFooter = true;
    return "\n";
  });

  if (!removedFooter) return latex;

  const footer = [
    "",
    "% made with BetterNotes-AI",
    "\\begin{flushright}\\scriptsize \\textit{made with BetterNotes-AI}\\end{flushright}",
    "",
  ].join("\n");

  return withoutFooter.replace(
    /\\end\s*\{multicols\*\}/,
    `${footer}\\end{multicols*}`
  );
}

export function applyLatexFallbacks(latex: string): string {
  return keepLandscapeFooterInsideColumns(
    injectCommonMathFallbacks(
      injectTheoremFallbacks(
        stripDuplicateNewtheoremDefinitions(
          fixUnclosedEnvironments(
            fixUnclosedDisplayMath(
              escapeAmpersandsInText(latex)
            )
          )
        )
      )
    )
  );
}

/* -------------------------
   compile
------------------------- */

export interface ImageFile {
  filename: string;
  buffer: Buffer;
}

export async function compileLatexToPdf(
  latexSourceRaw: string,
  opts: { timeoutMs: number },
  imageFiles?: ImageFile[]
): Promise<{ pdf: Buffer; log: string; latexPatched: string }> {
  const latexSource = applyLatexFallbacks(latexSourceRaw);

  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "betternotes-tex-"));
  const texPath = path.join(workDir, "main.tex");
  const pdfPath = path.join(workDir, "main.pdf");
  const texLogPath = path.join(workDir, "main.log");

  await fs.promises.writeFile(texPath, latexSource, "utf8");

  // Write image files into the work directory so \includegraphics can find them
  if (imageFiles && imageFiles.length > 0) {
    await Promise.all(
      imageFiles.map((img) =>
        fs.promises.writeFile(path.join(workDir, img.filename), img.buffer)
      )
    );
  }

  let log = "";
  try {
    const hasPdflatex = await commandExists("pdflatex");
    const hasLatexmk = await commandExists("latexmk");

    if (hasPdflatex) {
      for (let i = 0; i < 2; i++) {
        try {
          const { stdout, stderr } = await execFileAsync(
            "pdflatex",
            ["-interaction=nonstopmode", "-halt-on-error", "-file-line-error", "main.tex"],
            { cwd: workDir, timeout: opts.timeoutMs, maxBuffer: 20 * 1024 * 1024 }
          );
          log += stdout ?? "";
          log += stderr ?? "";
        } catch (e: any) {
          const extra = extractExecOutput(e);
          log += extra.stdout ?? "";
          log += extra.stderr ?? "";
          break;
        }
      }
    } else if (hasLatexmk) {
      try {
        const { stdout, stderr } = await execFileAsync(
          "latexmk",
          ["-pdf", "-bibtex-", "-interaction=nonstopmode", "-halt-on-error", "-file-line-error", "main.tex"],
          { cwd: workDir, timeout: opts.timeoutMs, maxBuffer: 20 * 1024 * 1024 }
        );
        log += stdout ?? "";
        log += stderr ?? "";
      } catch (e: any) {
        const extra = extractExecOutput(e);
        log += extra.stdout ?? "";
        log += extra.stderr ?? "";
      }
    } else {
      throw makeHttpError(
        "[LATEX_TOOLING_MISSING] Neither latexmk nor pdflatex found in PATH. Install TeX Live or use the Docker image.",
        500,
        undefined,
        "LATEX_TOOLING_MISSING"
      );
    }

    if (!fs.existsSync(pdfPath)) {
      if (fs.existsSync(texLogPath)) {
        log += "\n\n----- main.log -----\n";
        log += await fs.promises.readFile(texLogPath, "utf8");
      }

      const trimmed = trimHugeLog(log);
      const missingPackage = detectMissingStyPackage(trimmed);
      if (missingPackage) {
        throw makeHttpError(
          buildMissingPackageMessage(missingPackage),
          422,
          trimmed,
          "LATEX_MISSING_PACKAGE"
        );
      }
      const isTimeout = trimmed.includes("Timeout") || trimmed.includes("ETIMEDOUT");
      throw makeHttpError(
        "LaTeX compilation failed.",
        isTimeout ? 408 : 422,
        trimmed,
        isTimeout ? "LATEX_TIMEOUT" : "LATEX_COMPILE_FAILED"
      );
    }

    const pdf = await fs.promises.readFile(pdfPath);

    if (fs.existsSync(texLogPath)) {
      const mainLog = await fs.promises.readFile(texLogPath, "utf8");
      log += "\n\n----- main.log -----\n" + mainLog;
    }

    return { pdf, log: trimHugeLog(log), latexPatched: latexSource };
  } finally {
    try {
      await fs.promises.rm(workDir, { recursive: true, force: true });
    } catch { }
  }
}


/* -------------------------
   multi-file project compile
------------------------- */

export interface ProjectFile {
  path: string;   // e.g. "main.tex", "chapters/ch1.tex", "figures/plot.png"
  content: string; // text content OR base64 for binary
  isBinary?: boolean;
}

/**
 * Compile a multi-file LaTeX project.
 * Writes all files to a temp directory preserving subdirectory structure,
 * then runs latexmk/pdflatex on the specified main file.
 */
export async function compileMultiFileProject(
  files: ProjectFile[],
  mainFile: string,
  opts: { timeoutMs: number }
): Promise<{ pdf: Buffer; log: string }> {
  if (!files.length) {
    throw makeHttpError("No files provided.", 400, undefined, "NO_FILES");
  }
  if (!files.some((f) => f.path === mainFile)) {
    throw makeHttpError(
      `Main file "${mainFile}" not found in provided files.`,
      400,
      undefined,
      "MAIN_FILE_NOT_FOUND"
    );
  }

  const workDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "betternotes-project-"));
  const pdfName = mainFile.replace(/\.tex$/, ".pdf");
  const logName = mainFile.replace(/\.tex$/, ".log");

  try {
    // Write all files to the temp directory
    for (const file of files) {
      const absPath = path.join(workDir, file.path);
      const dir = path.dirname(absPath);
      await fs.promises.mkdir(dir, { recursive: true });

      if (file.isBinary) {
        // Binary files are base64-encoded
        const buf = Buffer.from(file.content, "base64");
        await fs.promises.writeFile(absPath, buf);
      } else {
        // Text files — apply fallbacks only to .tex files
        let content = file.content;
        if (file.path.endsWith(".tex")) {
          content = applyLatexFallbacks(content);
        }
        await fs.promises.writeFile(absPath, content, "utf8");
      }
    }

    // Compile
    let log = "";
    const hasPdflatex = await commandExists("pdflatex");
    const hasLatexmk = await commandExists("latexmk");
    const mainDir = path.dirname(path.join(workDir, mainFile));
    const mainBasename = path.basename(mainFile);

    if (hasPdflatex) {
      for (let i = 0; i < 2; i++) {
        try {
          const { stdout, stderr } = await execFileAsync(
            "pdflatex",
            ["-interaction=nonstopmode", "-halt-on-error", "-file-line-error", mainBasename],
            { cwd: mainDir, timeout: opts.timeoutMs, maxBuffer: 20 * 1024 * 1024 }
          );
          log += stdout ?? "";
          log += stderr ?? "";
        } catch (e: any) {
          const extra = extractExecOutput(e);
          log += extra.stdout ?? "";
          log += extra.stderr ?? "";
          break;
        }
      }
    } else if (hasLatexmk) {
      try {
        const { stdout, stderr } = await execFileAsync(
          "latexmk",
          ["-pdf", "-bibtex-", "-interaction=nonstopmode", "-halt-on-error", "-file-line-error", mainBasename],
          { cwd: mainDir, timeout: opts.timeoutMs, maxBuffer: 20 * 1024 * 1024 }
        );
        log += stdout ?? "";
        log += stderr ?? "";
      } catch (e: any) {
        const extra = extractExecOutput(e);
        log += extra.stdout ?? "";
        log += extra.stderr ?? "";
      }
    } else {
      throw makeHttpError(
        "[LATEX_TOOLING_MISSING] Neither latexmk nor pdflatex found.",
        500,
        undefined,
        "LATEX_TOOLING_MISSING"
      );
    }

    const pdfPath = path.join(mainDir, path.basename(pdfName));
    const texLogPath = path.join(mainDir, path.basename(logName));

    if (!fs.existsSync(pdfPath)) {
      if (fs.existsSync(texLogPath)) {
        log += "\n\n----- main.log -----\n";
        log += await fs.promises.readFile(texLogPath, "utf8");
      }
      const trimmed = trimHugeLog(log);
      const missingPackage = detectMissingStyPackage(trimmed);
      if (missingPackage) {
        throw makeHttpError(
          buildMissingPackageMessage(missingPackage),
          422,
          trimmed,
          "LATEX_MISSING_PACKAGE"
        );
      }
      const isTimeout = trimmed.includes("Timeout") || trimmed.includes("ETIMEDOUT");
      throw makeHttpError(
        "Multi-file LaTeX compilation failed.",
        isTimeout ? 408 : 422,
        trimmed,
        isTimeout ? "LATEX_TIMEOUT" : "LATEX_COMPILE_FAILED"
      );
    }

    const pdf = await fs.promises.readFile(pdfPath);

    if (fs.existsSync(texLogPath)) {
      const mainLog = await fs.promises.readFile(texLogPath, "utf8");
      log += "\n\n----- main.log -----\n" + mainLog;
    }

    return { pdf, log: trimHugeLog(log) };
  } finally {
    try {
      await fs.promises.rm(workDir, { recursive: true, force: true });
    } catch { }
  }
}
