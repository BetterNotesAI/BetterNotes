"use client";

import { ThinkingBar } from "@/components/prompt-kit/thinking-bar";

type ChatThinkingBubbleProps = {
  text: string;
  className?: string;
};

function joinClasses(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function ChatThinkingBubble({ text, className }: ChatThinkingBubbleProps) {
  return (
    <div className={joinClasses(className)}>
      <ThinkingBar text={text} />
    </div>
  );
}
