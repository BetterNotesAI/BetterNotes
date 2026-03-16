"use client";

import CodeMirror from "@uiw/react-codemirror";
import { StreamLanguage, HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";
import { Extension } from "@codemirror/state";

// ── Custom LaTeX tokenizer ───────────────────────────────────────────
type LatexMode = "normal" | "math_inline" | "math_display";
interface LatexState { mode: LatexMode; braceDepth: number; }

const customLatex = StreamLanguage.define<LatexState>({
    name: "latex",
    startState: () => ({ mode: "normal", braceDepth: 0 }),
    copyState: (s) => ({ ...s }),

    token(stream, state) {
        // ── Inside inline math $...$ ────────────────────────────────
        if (state.mode === "math_inline") {
            if (stream.peek() === "$") { stream.next(); state.mode = "normal"; return "atom"; }
            if (stream.peek() === "\\") { stream.next(); stream.match(/[a-zA-Z@]+\*?/) || stream.next(); return "atom"; }
            stream.match(/^[^$\\]+/);
            return "atom";
        }

        // ── Inside display math $$...$$ or \[...\] ──────────────────
        if (state.mode === "math_display") {
            if (stream.match("$$") || stream.match("\\]")) { state.mode = "normal"; return "atom"; }
            if (stream.peek() === "\\") { stream.next(); stream.match(/[a-zA-Z@]+\*?/) || stream.next(); return "atom"; }
            stream.match(/^[^$\\]+/);
            return "atom";
        }

        // ── Normal mode ─────────────────────────────────────────────

        // Comment: % to end of line
        if (stream.peek() === "%") { stream.skipToEnd(); return "comment"; }

        // Display math: $$
        if (stream.match("$$")) { state.mode = "math_display"; return "atom"; }

        // Display math: \[
        if (stream.match("\\[")) { state.mode = "math_display"; return "atom"; }

        // Inline math: $
        if (stream.peek() === "$") { stream.next(); state.mode = "math_inline"; return "atom"; }

        // LaTeX commands: \word or \\ etc.
        if (stream.peek() === "\\") {
            stream.next();
            stream.match(/[a-zA-Z@]+\*?/) || stream.next();
            return "keyword";
        }

        // Open brace
        if (stream.peek() === "{") { stream.next(); state.braceDepth++; return "bracket"; }

        // Close brace
        if (stream.peek() === "}") { stream.next(); state.braceDepth = Math.max(0, state.braceDepth - 1); return "bracket"; }

        // Content inside braces → string (cyan italic)
        if (state.braceDepth > 0) {
            stream.match(/^[^{}\\$%\n]+/);
            return "string";
        }

        // Plain text
        stream.match(/^[^\\{$%\n]+/) || stream.next();
        return null;
    },

    blankLine(_state) { /* preserve math state across blank lines for display math */ },
    languageData: { commentTokens: { line: "%" } },
});

// ── Highlight colours ────────────────────────────────────────────────
const latexHighlight = HighlightStyle.define([
    { tag: tags.keyword, color: "#fb923c" },                             // \commands — orange
    { tag: tags.string,  color: "#67e8f9", fontStyle: "italic" },        // {content} — cyan italic
    { tag: tags.atom,    color: "#86efac" },                             // math $...$ — green
    { tag: tags.comment, color: "#c4b5fd", fontStyle: "italic" },        // % comments — violet italic
    { tag: tags.bracket, color: "#64748b" },                             // { } — muted
]);

// ── Editor theme (structural styles) ────────────────────────────────
const latexTheme = EditorView.theme({
    "&": {
        backgroundColor: "transparent",
        height: "100%",
        fontSize: "13px",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
        color: "#e2e8f0",
    },
    ".cm-scroller": { overflow: "auto" },
    ".cm-content": { caretColor: "#fff", minHeight: "100%", padding: "16px" },
    ".cm-cursor": { borderLeftColor: "#fff" },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.04)" },
    ".cm-activeLineGutter": { backgroundColor: "rgba(255,255,255,0.04)" },
    ".cm-gutters": {
        backgroundColor: "rgba(0,0,0,0.15)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        color: "rgba(255,255,255,0.2)",
    },
    ".cm-lineNumbers .cm-gutterElement": { paddingRight: "12px" },
    ".cm-selectionBackground": { backgroundColor: "rgba(99,102,241,0.3) !important" },
    "::selection": { backgroundColor: "rgba(99,102,241,0.3)" },
}, { dark: true });

const extensions: Extension[] = [
    customLatex,
    syntaxHighlighting(latexHighlight),
    latexTheme,
    EditorView.lineWrapping,
];

interface LatexEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
}

export default function LatexEditor({ value, onChange, placeholder }: LatexEditorProps) {
    return (
        <CodeMirror
            value={value}
            onChange={onChange}
            extensions={extensions}
            basicSetup={{
                lineNumbers: true,
                highlightActiveLine: true,
                bracketMatching: true,
                autocompletion: false,
                foldGutter: false,
                dropCursor: false,
                allowMultipleSelections: false,
                indentOnInput: true,
                syntaxHighlighting: false,
            }}
            placeholder={placeholder}
            style={{ height: "100%" }}
            theme="none"
        />
    );
}
