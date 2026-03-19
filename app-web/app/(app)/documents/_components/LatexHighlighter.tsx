'use client';

import React, { useCallback, useMemo, useRef } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}

// Token types
type TokenType = 'command' | 'brace' | 'math' | 'comment' | 'plain';
interface Token { type: TokenType; text: string }

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    // Comment: % to end of line
    if (src[i] === '%') {
      let j = i + 1;
      while (j < src.length && src[j] !== '\n') j++;
      if (j < src.length) j++; // include newline
      tokens.push({ type: 'comment', text: src.slice(i, j) });
      i = j;
      continue;
    }
    // Display math: $$...$$
    if (src[i] === '$' && src[i + 1] === '$') {
      let j = i + 2;
      while (j < src.length - 1 && !(src[j] === '$' && src[j + 1] === '$')) j++;
      j += 2;
      tokens.push({ type: 'math', text: src.slice(i, j) });
      i = j;
      continue;
    }
    // Inline math: $...$
    if (src[i] === '$') {
      let j = i + 1;
      while (j < src.length && src[j] !== '$' && src[j] !== '\n') j++;
      if (j < src.length && src[j] === '$') j++;
      tokens.push({ type: 'math', text: src.slice(i, j) });
      i = j;
      continue;
    }
    // \command
    if (src[i] === '\\') {
      let j = i + 1;
      while (j < src.length && /[a-zA-Z*]/.test(src[j])) j++;
      if (j === i + 1) j++; // single special char like \\
      tokens.push({ type: 'command', text: src.slice(i, j) });
      i = j;
      continue;
    }
    // Braces
    if (src[i] === '{' || src[i] === '}') {
      tokens.push({ type: 'brace', text: src[i] });
      i++;
      continue;
    }
    // Plain — accumulate until next special char
    let j = i + 1;
    while (j < src.length && !['%', '$', '\\', '{', '}'].includes(src[j])) j++;
    tokens.push({ type: 'plain', text: src.slice(i, j) });
    i = j;
  }
  return tokens;
}

const COLOR: Record<TokenType, string> = {
  command: '#fb923c',   // orange
  brace:   '#64748b',   // slate
  math:    '#86efac',   // green
  comment: '#c4b5fd',   // violet
  plain:   '#e2e8f0',   // light gray
};

const ITALIC: Record<TokenType, boolean> = {
  command: false,
  brace: false,
  math: false,
  comment: true,
  plain: false,
};

export function LatexHighlighter({ value, onChange, readOnly = false }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  // Sync scroll between textarea and highlight layer
  const syncScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const tokens = useMemo(() => tokenize(value), [value]);

  const rendered = tokens.map((t, idx) => (
    <span
      key={idx}
      style={{
        color: COLOR[t.type],
        fontStyle: ITALIC[t.type] ? 'italic' : 'normal',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {t.text}
    </span>
  ));

  // Shared styles for both layers
  const sharedStyle: React.CSSProperties = {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
    fontSize: '12px',
    lineHeight: '1.6',
    padding: '1rem',
    margin: 0,
    border: 'none',
    outline: 'none',
    overflowX: 'auto',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    tabSize: 2,
  };

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden" style={{ background: 'rgba(0,0,0,0.25)' }}>
      {/* Highlight layer — renders colored spans, sits behind textarea */}
      <div
        ref={highlightRef}
        aria-hidden
        style={{
          ...sharedStyle,
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        {rendered}
        {/* Trailing newline to avoid last-line misalignment */}
        {'\n'}
      </div>

      {/* Textarea — transparent text, sits on top for interaction */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        onScroll={syncScroll}
        readOnly={readOnly}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        style={{
          ...sharedStyle,
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          background: 'transparent',
          color: 'transparent',
          WebkitTextFillColor: 'transparent',
          caretColor: '#fff',
          resize: 'none',
          zIndex: 1,
        }}
      />
    </div>
  );
}
