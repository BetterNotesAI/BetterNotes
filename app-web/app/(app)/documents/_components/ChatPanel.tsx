'use client';

import { useEffect, useRef, useState } from 'react';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  version_id?: string | null;
  version_number?: number | null;
  created_at: string;
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isDraft: boolean;
  onSend: (content: string) => void;
  placeholder?: string;
  loadingLabel?: string;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const hours = d.getHours().toString().padStart(2, '0');
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

const LOADING_PHASES = [
  { label: 'Generating LaTeX...', duration: 4000 },
  { label: 'Compiling PDF...', duration: null },
] as const;

export function ChatPanel({ messages, isLoading, isDraft, onSend, placeholder, loadingLabel }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isLoading) {
      setLoadingPhaseIndex(0);
      return;
    }
    const timer = setTimeout(() => {
      setLoadingPhaseIndex(1);
    }, 4000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }

  const defaultPlaceholder = isDraft
    ? 'Describe the document you want to create...'
    : (placeholder ?? 'Ask for changes...');

  return (
    <div className="flex flex-col h-full bg-black/20 border-l border-white/10 backdrop-blur-sm">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 shrink-0">
        <h2 className="text-sm font-semibold text-white/80">Chat</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 && !isLoading && (
          <div className="text-center text-white/30 text-sm mt-8 space-y-2">
            <p className="text-white/50 font-medium">
              {isDraft ? 'What would you like to create?' : 'Continue the conversation'}
            </p>
            <p className="text-xs">
              {isDraft
                ? 'Describe your document and the AI will generate it for you.'
                : 'Ask the AI to modify or extend your document.'}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/10 text-white/90'
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
            </div>

            <p className={`text-xs text-white/25 mt-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              {formatTime(msg.created_at)}
            </p>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/10 border border-white/10 rounded-2xl px-4 py-3 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/70 animate-pulse" style={{ animationDuration: '1s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/70 animate-pulse" style={{ animationDuration: '1s', animationDelay: '0.2s' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/70 animate-pulse" style={{ animationDuration: '1s', animationDelay: '0.4s' }} />
                </div>
                <span className="text-xs text-white/50 font-medium">
                  {LOADING_PHASES[loadingPhaseIndex].label}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2">
                {LOADING_PHASES.map((_, i) => (
                  <div
                    key={i}
                    className={`h-0.5 rounded-full transition-all duration-500 ${
                      i <= loadingPhaseIndex
                        ? 'bg-indigo-400/60 w-6'
                        : 'bg-white/15 w-4'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/10 shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={defaultPlaceholder}
            rows={1}
            disabled={isLoading}
            className="flex-1 bg-black/20 text-white/90 text-sm rounded-xl px-3 py-2.5 resize-none
              placeholder-white/30 border border-white/15 focus:outline-none focus:border-indigo-500/60
              transition-colors disabled:opacity-50 min-h-[40px] max-h-[160px]"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl
              bg-white text-neutral-950 hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors"
            aria-label="Send"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-white/25 mt-1.5">
          Enter to send &middot; Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
