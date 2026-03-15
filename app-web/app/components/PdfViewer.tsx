"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfViewerProps {
    url: string;
    zoom?: number; // percentage, 100 = 100%
    targetPage?: number;
    onNumPages?: (n: number) => void;
    onPageChange?: (page: number) => void;
}

export default function PdfViewer({ url, zoom = 100, targetPage, onNumPages, onPageChange }: PdfViewerProps) {
    const [numPages, setNumPages] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
    const ratiosRef = useRef<number[]>([]);

    function handleLoadSuccess({ numPages: n }: { numPages: number }) {
        setNumPages(n);
        setError(null);
        ratiosRef.current = new Array(n).fill(0);
        onNumPages?.(n);
    }

    // Track which page is most visible via IntersectionObserver
    const observerRef = useRef<IntersectionObserver | null>(null);

    const setupObserver = useCallback(() => {
        observerRef.current?.disconnect();
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    const idx = parseInt(entry.target.getAttribute("data-page-index") ?? "0", 10);
                    ratiosRef.current[idx] = entry.intersectionRatio;
                });
                // Find page with highest visibility
                let best = 0;
                ratiosRef.current.forEach((r, i) => { if (r > ratiosRef.current[best]) best = i; });
                onPageChange?.(best + 1);
            },
            { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1.0] }
        );
        pageRefs.current.forEach((el) => { if (el) observerRef.current!.observe(el); });
    }, [onPageChange]);

    useEffect(() => {
        if (numPages === 0) return;
        setupObserver();
        return () => observerRef.current?.disconnect();
    }, [numPages, setupObserver]);

    // Scroll to targetPage when it changes
    useEffect(() => {
        if (!targetPage || targetPage < 1 || targetPage > numPages) return;
        const el = pageRefs.current[targetPage - 1];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [targetPage, numPages]);

    return (
        <div className="w-full h-full overflow-auto relative flex flex-col items-center py-6">
            {/* Fixed background so it doesn't scroll/repeat with long PDFs */}
            <div className="pointer-events-none fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-neutral-950" />
                <div className="absolute inset-0 bg-[radial-gradient(900px_600px_at_35%_10%,rgba(99,102,241,0.22),transparent_60%),radial-gradient(900px_600px_at_75%_30%,rgba(236,72,153,0.18),transparent_60%),radial-gradient(900px_600px_at_70%_85%,rgba(34,197,94,0.12),transparent_60%)]" />
            </div>
            <Document
                file={url}
                onLoadSuccess={handleLoadSuccess}
                onLoadError={() => setError("Failed to load PDF.")}
                loading={
                    <div className="flex items-center justify-center h-32 text-white/30 text-sm">Loading…</div>
                }
            >
                {error ? (
                    <div className="text-white/40 text-sm">{error}</div>
                ) : (
                    Array.from({ length: numPages }, (_, i) => (
                        <div
                            key={i + 1}
                            ref={(el) => { pageRefs.current[i] = el; }}
                            data-page-index={i}
                            className="mb-6 shadow-[0_4px_32px_rgba(0,0,0,0.6)]"
                        >
                            <Page
                                pageNumber={i + 1}
                                scale={zoom / 100}
                                renderAnnotationLayer
                                renderTextLayer
                            />
                        </div>
                    ))
                )}
            </Document>
        </div>
    );
}
