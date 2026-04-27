'use client';

import { useEffect, useState, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DayEntry {
  date: string; // "YYYY-MM-DD"
  count: number;
}

interface Tooltip {
  text: string;
  x: number;
  y: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTooltipDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function getMonthLabels(days: DayEntry[]): { label: string; startIndex: number }[] {
  if (days.length === 0) return [];

  const labels: { label: string; startIndex: number }[] = [];
  let lastMonth = -1;

  days.forEach((d, i) => {
    const month = Number(d.date.split('-')[1]);
    if (month !== lastMonth) {
      const [, m] = d.date.split('-').map(Number);
      const label = new Date(Date.UTC(2000, m - 1, 1)).toLocaleDateString('en-US', {
        timeZone: 'UTC',
        month: 'short',
      });
      labels.push({ label, startIndex: i });
      lastMonth = month;
    }
  });

  return labels;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContributionsHeatmap({ userId }: { userId: string }) {
  const [days, setDays] = useState<DayEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    setIsLoading(true);
    fetch(`/api/profile/${userId}/contributions`)
      .then((r) => r.json())
      .then((data: DayEntry[]) => setDays(Array.isArray(data) ? data : []))
      .catch(() => setDays([]))
      .finally(() => setIsLoading(false));
  }, [userId]);

  const activeDays = days.filter((d) => d.count > 0).length;
  const monthLabels = getMonthLabels(days);
  const showMonthLabels = monthLabels.length > 1;

  // Dismiss tooltip when mouse leaves the whole container
  function handleContainerLeave() {
    setTooltip(null);
  }

  function handleSquareMouseEnter(
    e: React.MouseEvent<HTMLButtonElement>,
    day: DayEntry
  ) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const containerRect = containerRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    const x = rect.left - containerRect.left + rect.width / 2;
    const y = rect.top - containerRect.top;

    const label =
      day.count === 0
        ? `No activity · ${formatTooltipDate(day.date)}`
        : `${day.count} contribution${day.count === 1 ? '' : 's'} · ${formatTooltipDate(day.date)}`;

    setTooltip({ text: label, x, y });
  }

  function handleSquareMouseLeave() {
    setTooltip(null);
  }

  if (isLoading) {
    return (
      <section className="px-6 py-5 border-t border-white/8">
        <div className="max-w-5xl mx-auto">
          <div className="h-4 w-48 rounded bg-white/8 animate-pulse mb-4" />
          <div className="flex gap-1.5">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="w-6 h-6 rounded-md bg-white/6 animate-pulse shrink-0"
                style={{ animationDelay: `${i * 20}ms` }}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (days.length === 0) return null;

  return (
    <section className="px-6 py-5 border-t border-white/8">
      <div className="max-w-5xl mx-auto">

        {/* Section header */}
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-semibold text-white/70">
            Contributions
            <span className="text-white/30 font-normal ml-1">— last 30 days</span>
          </h2>
          {activeDays > 0 && (
            <span className="text-[10px] font-medium text-indigo-300 bg-indigo-500/15 border border-indigo-400/25 rounded-full px-2 py-0.5">
              {activeDays} active {activeDays === 1 ? 'day' : 'days'}
            </span>
          )}
        </div>

        {/* Heatmap grid */}
        <div
          ref={containerRef}
          className="relative"
          onMouseLeave={handleContainerLeave}
        >
          {/* Month labels — only shown when the 30-day window spans two months */}
          {showMonthLabels && (
            <div className="relative h-4 mb-1">
              {monthLabels.map(({ label, startIndex }) => (
                <span
                  key={label + startIndex}
                  className="absolute text-[10px] text-white/30 leading-none"
                  // Each square is w-6 (24px) + gap-1.5 (6px) = 30px per cell
                  style={{ left: `${startIndex * 30}px` }}
                >
                  {label}
                </span>
              ))}
            </div>
          )}

          {/* Squares row */}
          <div className="flex gap-1.5 flex-wrap">
            {days.map((day) => {
              const active = day.count > 0;
              return (
                <button
                  key={day.date}
                  type="button"
                  aria-label={`${day.count} contributions on ${formatTooltipDate(day.date)}`}
                  onMouseEnter={(e) => handleSquareMouseEnter(e, day)}
                  onMouseLeave={handleSquareMouseLeave}
                  className={[
                    'w-6 h-6 rounded-md shrink-0 transition-all duration-150 cursor-default focus:outline-none',
                    active
                      ? 'bg-indigo-500/70 border border-indigo-400/50 hover:bg-indigo-400/80 hover:border-indigo-300/60'
                      : 'bg-white/8 border border-white/10 hover:bg-white/14 hover:border-white/20',
                  ].join(' ')}
                />
              );
            })}
          </div>

          {/* Floating tooltip */}
          {tooltip && (
            <div
              className="absolute z-50 pointer-events-none -translate-x-1/2 -translate-y-full"
              style={{ left: tooltip.x, top: tooltip.y - 6 }}
            >
              <div className="bg-neutral-900 border border-white/15 rounded-lg px-2.5 py-1.5 shadow-xl shadow-black/40 whitespace-nowrap">
                <p className="text-[11px] text-white/80">{tooltip.text}</p>
              </div>
              {/* Caret */}
              <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0
                border-l-4 border-r-4 border-t-4
                border-l-transparent border-r-transparent border-t-neutral-900" />
            </div>
          )}
        </div>

      </div>
    </section>
  );
}
