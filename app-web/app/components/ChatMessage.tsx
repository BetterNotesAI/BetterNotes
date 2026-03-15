"use client";

import { useState } from "react";

type MessageType = "normal" | "error" | "success" | "warning";

function detectType(content: string): MessageType {
    const t = content.toLowerCase().trim();
    if (t.startsWith("error:") || t.includes("timed out")) return "error";
    if (
        t.startsWith("done.") ||
        t.includes("successfully") ||
        t.includes("preview updated") ||
        t.includes("applied ai fix")
    ) return "success";
    if (
        t.includes("compilation failed") ||
        t.includes("no changes detected") ||
        t.includes("fix with ai")
    ) return "warning";
    return "normal";
}

// Renders **bold** and `inline code` within a string
function renderInline(text: string, keyPrefix: string): React.ReactNode {
    const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    const parts: React.ReactNode[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    let i = 0;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > last) parts.push(text.slice(last, match.index));
        const raw = match[0];
        if (raw.startsWith("**")) {
            parts.push(<strong key={`${keyPrefix}-b${i++}`} className="font-semibold text-white">{raw.slice(2, -2)}</strong>);
        } else {
            parts.push(<code key={`${keyPrefix}-c${i++}`} className="rounded px-1 py-0.5 bg-white/10 font-mono text-[11px] text-amber-200">{raw.slice(1, -1)}</code>);
        }
        last = match.index + raw.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return <>{parts}</>;
}

function MarkdownContent({ text }: { text: string }) {
    // Split code blocks first
    const codeBlockRegex = /```[\s\S]*?```/g;
    const segments: { type: "code" | "text"; content: string }[] = [];
    let last = 0;
    let match: RegExpExecArray | null;
    while ((match = codeBlockRegex.exec(text)) !== null) {
        if (match.index > last) segments.push({ type: "text", content: text.slice(last, match.index) });
        const inner = match[0].replace(/^```[^\n]*\n?/, "").replace(/```$/, "").trim();
        segments.push({ type: "code", content: inner });
        last = match.index + match[0].length;
    }
    if (last < text.length) segments.push({ type: "text", content: text.slice(last) });

    return (
        <div className="space-y-1.5">
            {segments.map((seg, si) => {
                if (seg.type === "code") {
                    return (
                        <pre key={si} className="overflow-x-auto rounded-lg border border-white/8 bg-black/40 px-2.5 py-2 text-xs text-white/80 font-mono">
                            {seg.content}
                        </pre>
                    );
                }

                const lines = seg.content.split("\n");
                const nodes: React.ReactNode[] = [];
                type ListKind = "ul" | "ol";
                let listItems: string[] = [];
                let listKind: ListKind = "ul";
                let key = 0;

                const flushList = () => {
                    if (listItems.length === 0) return;
                    if (listKind === "ol") {
                        nodes.push(
                            <ol key={`${si}-l${key++}`} className="list-decimal list-inside space-y-0.5">
                                {listItems.map((item, j) => (
                                    <li key={j}>{renderInline(item, `${si}-l${key}-${j}`)}</li>
                                ))}
                            </ol>
                        );
                    } else {
                        nodes.push(
                            <ul key={`${si}-l${key++}`} className="list-disc list-inside space-y-0.5">
                                {listItems.map((item, j) => (
                                    <li key={j}>{renderInline(item, `${si}-l${key}-${j}`)}</li>
                                ))}
                            </ul>
                        );
                    }
                    listItems = [];
                };

                const orderedRe = /^\d+\.\s+(.+)/;

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) { flushList(); continue; }

                    const orderedMatch = orderedRe.exec(trimmed);
                    if (orderedMatch) {
                        if (listItems.length > 0 && listKind !== "ol") flushList();
                        listKind = "ol";
                        listItems.push(orderedMatch[1]);
                    } else if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
                        if (listItems.length > 0 && listKind !== "ul") flushList();
                        listKind = "ul";
                        listItems.push(trimmed.slice(2));
                    } else if (trimmed.startsWith("## ")) {
                        flushList();
                        nodes.push(
                            <p key={`${si}-h${key++}`} className="font-semibold text-white leading-relaxed mt-1">
                                {renderInline(trimmed.slice(3), `${si}-h${key}`)}
                            </p>
                        );
                    } else if (trimmed.startsWith("# ")) {
                        flushList();
                        nodes.push(
                            <p key={`${si}-h${key++}`} className="font-bold text-white leading-relaxed mt-1">
                                {renderInline(trimmed.slice(2), `${si}-h${key}`)}
                            </p>
                        );
                    } else {
                        flushList();
                        nodes.push(
                            <p key={`${si}-p${key++}`} className="leading-relaxed">
                                {renderInline(trimmed, `${si}-p${key}`)}
                            </p>
                        );
                    }
                }
                flushList();

                return <div key={si}>{nodes}</div>;
            })}
        </div>
    );
}

interface ChatMessageProps {
    role: "user" | "assistant";
    content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
    const [copied, setCopied] = useState(false);

    const type = role === "assistant" ? detectType(content) : "normal";

    const bubbleClass = role === "user"
        ? "ml-auto bg-white/10 border-white/15 text-white"
        : type === "error"
            ? "mr-auto bg-red-500/10 border-red-400/20 text-red-100"
            : type === "success"
                ? "mr-auto bg-emerald-500/[0.08] border-emerald-400/20 text-emerald-100"
                : type === "warning"
                    ? "mr-auto bg-amber-500/[0.08] border-amber-400/20 text-amber-100"
                    : "mr-auto bg-black/20 border-white/8 text-white/90";

    function handleCopy() {
        navigator.clipboard.writeText(content);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    }

    return (
        <div className={`group relative max-w-[92%] rounded-2xl px-3 py-2 text-sm border ${bubbleClass}`}>
            {role === "user" ? (
                <span className="leading-relaxed">{content}</span>
            ) : (
                <MarkdownContent text={content} />
            )}
            {role === "assistant" && (
                <button
                    onClick={handleCopy}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity rounded p-0.5 text-white/20 hover:text-white/60 hover:bg-white/10"
                    title="Copiar"
                >
                    {copied ? (
                        <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                    ) : (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                        </svg>
                    )}
                </button>
            )}
        </div>
    );
}
