'use client';

// ---------------------------------------------------------------------------
// SubChatBubble — floating pill for a minimized sub-chat
// ---------------------------------------------------------------------------

export interface SubChatBubbleProps {
  subChatId: string;
  sessionId: string;
  title: string;
  onExpand: () => void;
  onDelete: () => void;
}

export function SubChatBubble({
  title,
  onExpand,
  onDelete,
}: SubChatBubbleProps) {
  return (
    <div className="flex items-center gap-0 rounded-full border border-white/15
      bg-[#1a1a1a] shadow-lg shadow-black/40 overflow-hidden max-w-[220px]
      hover:border-orange-500/30 transition-colors group">

      {/* Expand button (main area) */}
      <button
        onClick={onExpand}
        className="flex items-center gap-2 pl-3 pr-2 py-2 flex-1 min-w-0
          text-white/70 hover:text-white transition-colors"
        title="Expand"
      >
        {/* Chat icon */}
        <svg
          className="w-3.5 h-3.5 shrink-0 text-orange-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
          />
        </svg>

        {/* Title */}
        <span className="text-xs font-medium truncate">{title}</span>
      </button>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        title="Delete sub-chat"
        className="shrink-0 w-7 h-full flex items-center justify-center
          text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
