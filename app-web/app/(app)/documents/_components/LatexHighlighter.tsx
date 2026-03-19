'use client';

import React, { useCallback, useMemo, useRef } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}

// Token types — mirrors v1 color scheme
type TokenType = 'command' | 'brace' | 'braceContent' | 'math' | 'comment' | 'plain';
interface Token { type: TokenType; text: string }

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let braceDepth = 0;

  while (i < src.length) {
    // Comment: % to end of line
    if (src[i] === '%') {
      let j = i + 1;
      while (j < src.length && src[j] !== '\n') j++;
      if (j < src.length) j++;
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

    // LaTeX math delimiters: \(...\) and \[...\]
    if (src[i] === '\\' && i + 1 < src.length && (src[i + 1] === '(' || src[i + 1] === '[')) {
      const closeChar = src[i + 1] === '(' ? ')' : ']';
      let j = i + 2;
      while (j < src.length - 1 && !(src[j] === '\\' && src[j + 1] === closeChar)) j++;
      if (j < src.length - 1) j += 2;
      tokens.push({ type: 'math', text: src.slice(i, j) });
      i = j;
      continue;
    }

    // \command (after math delimiters so \( \[ are handled above)
    if (src[i] === '\\') {
      let j = i + 1;
      while (j < src.length && /[a-zA-Z*]/.test(src[j])) j++;
      if (j === i + 1) j++;
      tokens.push({ type: 'command', text: src.slice(i, j) });
      i = j;
      continue;
    }

    // Opening brace
    if (src[i] === '{') {
      tokens.push({ type: 'brace', text: '{' });
      braceDepth++;
      i++;
      continue;
    }

    // Closing brace
    if (src[i] === '}') {
      if (braceDepth > 0) braceDepth--;
      tokens.push({ type: 'brace', text: '}' });
      i++;
      continue;
    }

    // Plain text — cyan when inside braces, muted gray at top level
    let j = i + 1;
    while (j < src.length && !['%', '$', '\\', '{', '}'].includes(src[j])) j++;
    tokens.push({ type: braceDepth > 0 ? 'braceContent' : 'plain', text: src.slice(i, j) });
    i = j;
  }
  return tokens;
}

const COLOR: Record<TokenType, string> = {
  command:      '#fb923c',  // orange  — \commands
  brace:        '#64748b',  // slate   — { }
  braceContent: '#67e8f9',  // cyan    — {content inside braces}
  math:         '#86efac',  // green   — $math$ \(...\) \[...\]
  comment:      '#c4b5fd',  // violet  — % comments
  plain:        '#94a3b8',  // muted blue-gray — top-level text
};

const ITALIC: Record<TokenType, boolean> = {
  command:      false,
  brace:        false,
  braceContent: false,
  math:         false,
  comment:      true,
  plain:        false,
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
