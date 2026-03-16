import { useRef, useState, useCallback } from "react";

export function useResizers() {
    // ── Split-view (LaTeX/PDF) ──
    const [splitRatio, setSplitRatio] = useState(50);
    const splitContainerRef = useRef<HTMLDivElement | null>(null);
    const isDraggingRef = useRef(false);

    const onSplitMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingRef.current = true;
        const startX = e.clientX;
        const startRatio = splitRatio;
        const container = splitContainerRef.current;
        if (!container) return;
        const containerWidth = container.getBoundingClientRect().width;

        function onMove(ev: MouseEvent) {
            if (!isDraggingRef.current) return;
            const delta = ev.clientX - startX;
            const newRatio = Math.min(80, Math.max(20, startRatio + (delta / containerWidth) * 100));
            setSplitRatio(newRatio);
        }
        function onUp() {
            isDraggingRef.current = false;
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        }
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }, [splitRatio]);

    // ── Chat panel (right column) ──
    const [chatCollapsed, setChatCollapsed] = useState(false);
    const [chatWidth, setChatWidth] = useState(300);
    const chatResizingRef = useRef(false);

    const onChatStripMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        let dragged = false;
        const startWidth = chatWidth;

        function onMove(ev: MouseEvent) {
            if (Math.abs(ev.clientX - startX) > 3) {
                dragged = true;
                document.body.style.cursor = "col-resize";
                document.body.style.userSelect = "none";
            }
            if (!dragged) return;
            const delta = startX - ev.clientX; // drag left = wider
            setChatWidth(Math.min(520, Math.max(220, startWidth + delta)));
        }
        function onUp() {
            if (!dragged) setChatCollapsed((c) => !c);
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }, [chatWidth]);

    // ── Files panel (bottom right) ──
    const [filesCollapsed, setFilesCollapsed] = useState(false);
    const [filesHeight, setFilesHeight] = useState(192);
    const filesResizingRef = useRef(false);
    const filesPanelRef = useRef<HTMLDivElement | null>(null);

    const onFilesResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        filesResizingRef.current = true;
        const startY = e.clientY;
        const startHeight = filesHeight;
        function onMove(ev: MouseEvent) {
            if (!filesResizingRef.current) return;
            const delta = startY - ev.clientY; // dragging up = bigger
            const newHeight = Math.min(480, Math.max(80, startHeight + delta));
            setFilesHeight(newHeight);
        }
        function onUp() {
            filesResizingRef.current = false;
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        }
        document.body.style.cursor = "row-resize";
        document.body.style.userSelect = "none";
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }, [filesHeight]);

    // ── Output files panel collapse ──
    const [outputFilesCollapsed, setOutputFilesCollapsed] = useState(false);

    return {
        splitRatio,
        splitContainerRef,
        onSplitMouseDown,
        chatCollapsed,
        setChatCollapsed,
        chatWidth,
        onChatStripMouseDown,
        filesCollapsed,
        setFilesCollapsed,
        filesHeight,
        filesPanelRef,
        onFilesResizeMouseDown,
        outputFilesCollapsed,
        setOutputFilesCollapsed,
    };
}
