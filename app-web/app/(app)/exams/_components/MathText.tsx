'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Repair control characters that arise when the AI generates LaTeX commands
 * (\frac, \vec, \beta…) with a single backslash inside a JSON string.
 * JSON parsers convert \f → form-feed (ASCII 12), \v → vertical-tab, \b → backspace.
 * NOTE: /[\b]/ (char class) matches backspace; /\b/ (outside class) is word-boundary!
 */
function fixLatexControlChars(s: string): string {
  return s
    .replace(/\f([a-zA-Z])/g, '\\f$1')
    .replace(/\t([a-zA-Z])/g, '\\t$1')
    .replace(/\v([a-zA-Z])/g, '\\v$1')
    .replace(/[\b]([a-zA-Z])/g, '\\b$1');
}

/**
 * Renders a string that may contain inline math delimited by $...$.
 * Segments outside delimiters are rendered as plain text.
 * Falls back gracefully if KaTeX fails to parse.
 */
export default function MathText({ text, className }: { text: string; className?: string }) {
  // Fix any LaTeX control-char corruption before splitting (covers old DB data too)
  const fixed = fixLatexControlChars(text);
  // Split on $...$ — captures the delimiter so we can identify math segments
  const parts = fixed.split(/(\$[^$\n]+\$)/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          const math = part.slice(1, -1);
          try {
            const html = katex.renderToString(math, {
              throwOnError: false,
              displayMode: false,
              output: 'html',
            });
            return <span key={i} dangerouslySetInnerHTML={{ __html: html }} />;
          } catch {
            return <span key={i}>{part}</span>;
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
