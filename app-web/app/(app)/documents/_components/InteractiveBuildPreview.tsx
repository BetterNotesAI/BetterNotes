'use client';

import { useEffect, useMemo, useState } from 'react';
import { getTemplateProfile } from '@/lib/template-profiles';

type BuildPhase = 'calling_ai' | 'compiling' | 'uploading' | null;

interface InteractiveBuildPreviewProps {
  templateId?: string;
  phase: BuildPhase;
}

interface SkeletonSlot {
  key: string;
  kind: 'title' | 'line' | 'formula' | 'box';
  widthPct: number;
  heightPx: number;
}

function hashSeed(value: string): number {
  let seed = 2166136261;
  for (let i = 0; i < value.length; i++) {
    seed ^= value.charCodeAt(i);
    seed = Math.imul(seed, 16777619);
  }
  return seed >>> 0;
}

function makeRng(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = Math.imul(state, 1664525) + 1013904223;
    return ((state >>> 0) & 0xffffffff) / 0x100000000;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildColumnsSkeleton(templateId: string | undefined, columnCount: number): SkeletonSlot[][] {
  const seedBase = hashSeed(`${templateId ?? 'default'}:${columnCount}`);
  const rowsPerColumn = columnCount >= 3 ? 12 : columnCount === 2 ? 10 : 11;
  const columns: SkeletonSlot[][] = [];

  for (let columnIndex = 0; columnIndex < columnCount; columnIndex++) {
    const rng = makeRng(seedBase + columnIndex * 9973);
    const slots: SkeletonSlot[] = [];

    slots.push({
      key: `${columnIndex}-0`,
      kind: 'title',
      widthPct: clamp(50 + Math.round(rng() * 30), 48, 84),
      heightPx: 16,
    });

    for (let row = 1; row < rowsPerColumn; row++) {
      const pick = rng();
      let kind: SkeletonSlot['kind'];
      if (pick < 0.14) kind = 'formula';
      else if (pick < 0.25) kind = 'box';
      else kind = 'line';

      const heightPx =
        kind === 'box'
          ? 28 + Math.round(rng() * 14)
          : kind === 'formula'
            ? 13 + Math.round(rng() * 4)
            : 8 + Math.round(rng() * 2);

      const widthPct =
        kind === 'box'
          ? 100
          : clamp(62 + Math.round(rng() * 38), 60, 100);

      slots.push({
        key: `${columnIndex}-${row}`,
        kind,
        widthPct,
        heightPx,
      });
    }

    columns.push(slots);
  }

  return columns;
}

function getStageLabel(phase: BuildPhase): string {
  if (phase === 'uploading') return 'Polishing and preparing final output...';
  if (phase === 'compiling') return 'Assembling columns and layout...';
  return 'Drafting content and structure...';
}

function getPhaseStepMs(phase: BuildPhase): number {
  if (phase === 'uploading') return 90;
  if (phase === 'compiling') return 140;
  return 240;
}

function getPhaseStepSize(phase: BuildPhase): number {
  if (phase === 'uploading') return 2;
  if (phase === 'compiling') return 2;
  return 1;
}

function getProgressFromPhase(phase: BuildPhase, visible: number, total: number): number {
  if (total <= 0) return 0;
  const fraction = visible / total;
  if (phase === 'uploading') return 88 + fraction * 10;
  if (phase === 'compiling') return 58 + fraction * 28;
  return 12 + fraction * 44;
}

export default function InteractiveBuildPreview({
  templateId,
  phase,
}: InteractiveBuildPreviewProps) {
  const profile = useMemo(() => getTemplateProfile(templateId), [templateId]);
  const columnCount = Math.max(1, profile.layout.columnCount);
  const columns = useMemo(
    () => buildColumnsSkeleton(templateId, columnCount),
    [templateId, columnCount],
  );

  const revealOrder = useMemo(() => {
    const maxRows = columns.reduce((max, column) => Math.max(max, column.length), 0);
    const orderedKeys: string[] = [];
    for (let row = 0; row < maxRows; row++) {
      for (let col = 0; col < columns.length; col++) {
        const slot = columns[col][row];
        if (slot) orderedKeys.push(slot.key);
      }
    }
    return orderedKeys;
  }, [columns]);

  const revealIndex = useMemo(() => {
    const map = new Map<string, number>();
    revealOrder.forEach((key, index) => map.set(key, index));
    return map;
  }, [revealOrder]);

  const totalSlots = revealOrder.length;
  const [visibleSlots, setVisibleSlots] = useState(1);

  useEffect(() => {
    setVisibleSlots(1);
  }, [templateId, columnCount]);

  useEffect(() => {
    const stepMs = getPhaseStepMs(phase);
    const stepSize = getPhaseStepSize(phase);
    const timer = window.setInterval(() => {
      setVisibleSlots((prev) => {
        if (prev >= totalSlots) return prev;
        return Math.min(totalSlots, prev + stepSize);
      });
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [phase, totalSlots]);

  const [arW, arH] = profile.geometry.aspectRatio.split('/').map((part) => parseFloat(part.trim()));
  const sheetHeightPx = Math.round(profile.geometry.widthPx * (arH / arW));
  const progress = Math.round(getProgressFromPhase(phase, visibleSlots, totalSlots));
  const stageLabel = getStageLabel(phase);
  const stageIndex = phase === 'uploading' ? 2 : phase === 'compiling' ? 1 : 0;

  return (
    <div className="flex-1 overflow-auto px-6 py-6">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col items-center gap-3">
        <div className="w-full max-w-[980px] flex items-center justify-between text-[11px] text-white/55">
          <span>{stageLabel}</span>
          <span className="tabular-nums text-white/70">{progress}%</span>
        </div>

        <div className="w-full max-w-[980px] h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-400/80 via-sky-300/70 to-emerald-300/70 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="w-full max-w-[980px] flex items-center gap-2 text-[10px] text-white/50">
          {['Draft', 'Layout', 'Finalize'].map((label, index) => {
            const active = index <= stageIndex;
            return (
              <span
                key={label}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  active
                    ? 'text-indigo-200 border-indigo-300/45 bg-indigo-500/20'
                    : 'text-white/35 border-white/10 bg-white/5'
                }`}
              >
                {label}
              </span>
            );
          })}
        </div>

        <div className="w-full flex justify-center pt-1">
          <div
            className="relative bg-white shadow-[0_4px_32px_rgba(0,0,0,0.18)] overflow-hidden"
            style={{
              width: `min(100%, ${profile.geometry.widthPx}px)`,
              minHeight: sheetHeightPx,
              paddingTop: `${profile.geometry.margins.top}rem`,
              paddingRight: `${profile.geometry.margins.right}rem`,
              paddingBottom: `${profile.geometry.margins.bottom}rem`,
              paddingLeft: `${profile.geometry.margins.left}rem`,
              boxSizing: 'border-box',
            }}
          >
            <div
              className="relative h-full"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                columnGap: profile.layout.columnGap,
              }}
            >
              {columns.map((slots, columnIndex) => (
                <div
                  key={columnIndex}
                  className="relative flex flex-col gap-1.5 pr-0.5"
                  style={{
                    borderRight:
                      profile.layout.showColumnRule && columnIndex < columnCount - 1
                        ? `${profile.layout.columnRuleWidth} solid rgba(120, 120, 120, 0.55)`
                        : 'none',
                  }}
                >
                  {slots.map((slot) => {
                    const orderIndex = revealIndex.get(slot.key) ?? 0;
                    const isVisible = orderIndex < visibleSlots;
                    return (
                      <div
                        key={slot.key}
                        className={`ibp-slot ibp-${slot.kind} ${isVisible ? 'ibp-visible' : 'ibp-hidden'}`}
                        style={{
                          width: `${slot.widthPct}%`,
                          minHeight: `${slot.heightPx}px`,
                          animationDelay: `${(orderIndex % 10) * 40}ms`,
                        }}
                      >
                        <span className="ibp-shimmer" />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ibp-slot {
          position: relative;
          overflow: hidden;
          border-radius: 4px;
          border: 1px solid rgba(184, 184, 184, 0.7);
          background: rgba(236, 236, 236, 0.85);
          transform-origin: top left;
          transition: opacity 280ms ease, transform 280ms ease;
        }
        .ibp-hidden {
          opacity: 0;
          transform: translateY(5px);
        }
        .ibp-visible {
          opacity: 1;
          transform: translateY(0);
          animation: ibpFadeIn 360ms ease both;
        }
        .ibp-title {
          margin-bottom: 2px;
          background: rgba(221, 221, 221, 0.95);
        }
        .ibp-line {
          border-color: rgba(196, 196, 196, 0.7);
        }
        .ibp-formula {
          border-color: rgba(173, 198, 236, 0.75);
          background: rgba(228, 238, 250, 0.82);
        }
        .ibp-box {
          border-color: rgba(168, 215, 173, 0.75);
          background: rgba(226, 246, 230, 0.82);
        }
        .ibp-shimmer {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            110deg,
            rgba(255, 255, 255, 0) 25%,
            rgba(255, 255, 255, 0.55) 50%,
            rgba(255, 255, 255, 0) 75%
          );
          transform: translateX(-100%);
          animation: ibpShimmer 1.45s ease-in-out infinite;
        }
        @keyframes ibpShimmer {
          100% {
            transform: translateX(120%);
          }
        }
        @keyframes ibpFadeIn {
          from {
            opacity: 0;
            transform: translateY(6px) scale(0.985);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
