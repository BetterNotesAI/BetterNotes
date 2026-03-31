'use client';

import katex from 'katex';
import 'katex/dist/katex.min.css';

/**
 * Renders a string that may contain inline math delimited by $...$.
 * Segments outside delimiters are rendered as plain text.
 * Falls back gracefully if KaTeX fails to parse.
 */
export default function MathText({ text, className }: { text: string; className?: string }) {
  // Split on $...$ — captures the delimiter so we can identify math segments
  const parts = text.split(/(\$[^$\n]+\$)/g);

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
