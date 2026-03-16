"use client";

import { ThinkingBar } from "@/components/prompt-kit/thinking-bar";

type ChatThinkingBubbleProps = {
  text: string;
  steps?: { label: string; patterns: RegExp[] }[];
  activeStepIndex?: number;
  className?: string;
};

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function ChatThinkingBubble({
  text,
  steps = [],
  activeStepIndex = 0,
  className,
}: ChatThinkingBubbleProps) {
  void steps;
  void activeStepIndex;

  return (
    <div className={joinClasses(className)}>
      <ThinkingBar text={text} />
    </div>
  );
}
